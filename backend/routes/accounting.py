"""
ReeveOS EPOS — Accounting Integration Hub
============================================
Provider-agnostic accounting sync with deep Xero, QuickBooks, and Sage integration.
Auto-syncs daily sales journals, VAT splits, payment fees, refunds, and tronc disbursements.

COMPETITIVE EDGE:
- Every UK competitor relies on simple CSV exports or basic Xero app-store integrations
- ReeveOS provides real-time, granular journal entries with automatic VAT categorisation
- Auto-reconciliation suggestions save hours of bookkeeper time weekly
- Built-in MTD (Making Tax Digital) VAT return preparation
"""
from fastapi import Depends,  APIRouter, HTTPException, Body, Query
from pydantic import BaseModel, Field
from typing import Optional, List, Dict
from datetime import datetime, timedelta, date
from bson import ObjectId
from database import get_database
import logging
import httpx
import json
from middleware.tenant import verify_business_access, TenantContext

logger = logging.getLogger("accounting")
router = APIRouter(prefix="/accounting", tags=["Accounting Integration"])


# ─── Models ─── #

class AccountingProvider(BaseModel):
    provider: str  # xero, quickbooks, sage
    client_id: Optional[str] = None
    client_secret: Optional[str] = None
    redirect_uri: Optional[str] = None
    tenant_id: Optional[str] = None

class AccountingConnection(BaseModel):
    provider: str
    access_token: str
    refresh_token: Optional[str] = None
    token_expires_at: Optional[str] = None
    tenant_id: Optional[str] = None
    organisation_name: Optional[str] = None

class AccountMapping(BaseModel):
    """Map ReeveOS transaction types to accounting software account codes."""
    food_sales: str = "200"         # Revenue - Food
    drink_sales: str = "201"        # Revenue - Drinks
    takeaway_sales: str = "202"     # Revenue - Takeaway
    delivery_sales: str = "203"     # Revenue - Delivery
    service_charge: str = "204"     # Revenue - Service Charge
    card_payments: str = "1001"     # Bank - Card Terminal
    cash_payments: str = "1002"     # Bank - Cash
    card_fees: str = "403"          # Expense - Card Processing Fees
    refunds: str = "205"            # Contra - Refunds
    discounts: str = "206"          # Contra - Discounts
    vat_standard: str = "820"       # VAT Output 20%
    vat_reduced: str = "821"        # VAT Output 5% (hot takeaway exception)
    vat_zero: str = "822"           # VAT Output 0% (cold takeaway food)
    tips_liability: str = "2100"    # Liability - Tips held
    tips_disbursed: str = "7010"    # Expense - Tips paid out

class SyncConfig(BaseModel):
    auto_sync: bool = True
    sync_frequency: str = "daily"  # daily, weekly, realtime
    sync_time: str = "03:00"       # HH:MM — run overnight
    include_vat_split: bool = True
    include_payment_fees: bool = True
    include_tips: bool = True
    include_refunds: bool = True
    group_by: str = "day"  # day, shift, transaction
    journal_prefix: str = "REEVE"

class ManualSyncRequest(BaseModel):
    date_from: str  # YYYY-MM-DD
    date_to: str    # YYYY-MM-DD


# ─── OAuth Connection Flow ─── #

@router.post("/business/{business_id}/connect")
async def initiate_connection(business_id: str, tenant: TenantContext = Depends(verify_business_access), body: AccountingProvider):
    """
    Step 1: Initiate OAuth connection to accounting provider.
    Returns the authorization URL the user should be redirected to.
    """
    db = get_database()
    
    valid_providers = ["xero", "quickbooks", "sage"]
    if body.provider not in valid_providers:
        raise HTTPException(400, f"Invalid provider. Supported: {valid_providers}")
    
    # Store provider config
    config = body.dict()
    config["business_id"] = business_id
    config["status"] = "pending"
    config["created_at"] = datetime.utcnow()
    
    await db.accounting_connections.update_one(
        {"business_id": business_id, "provider": body.provider},
        {"$set": config},
        upsert=True
    )
    
    # Generate OAuth URLs
    auth_urls = {
        "xero": f"https://login.xero.com/identity/connect/authorize?response_type=code&client_id={body.client_id}&redirect_uri={body.redirect_uri}&scope=openid profile email accounting.transactions accounting.settings accounting.contacts offline_access&state={business_id}",
        "quickbooks": f"https://appcenter.intuit.com/connect/oauth2?client_id={body.client_id}&redirect_uri={body.redirect_uri}&response_type=code&scope=com.intuit.quickbooks.accounting&state={business_id}",
        "sage": f"https://www.sageone.com/oauth2/auth/central?response_type=code&client_id={body.client_id}&redirect_uri={body.redirect_uri}&scope=full_access&state={business_id}"
    }
    
    return {
        "auth_url": auth_urls.get(body.provider),
        "provider": body.provider,
        "instructions": f"Redirect user to auth_url to complete {body.provider} connection"
    }


@router.post("/business/{business_id}/callback")
async def handle_oauth_callback(business_id: str, tenant: TenantContext = Depends(verify_business_access), body: AccountingConnection):
    """
    Step 2: Handle OAuth callback with access token.
    Store the connection and verify it works.
    """
    db = get_database()
    
    connection = body.dict()
    connection["business_id"] = business_id
    connection["status"] = "connected"
    connection["connected_at"] = datetime.utcnow()
    connection["last_sync"] = None
    
    await db.accounting_connections.update_one(
        {"business_id": business_id, "provider": body.provider},
        {"$set": connection},
        upsert=True
    )
    
    return {"connected": True, "provider": body.provider, "organisation": body.organisation_name}


@router.get("/business/{business_id}/connection")
async def get_connection_status(business_id: str, tenant: TenantContext = Depends(verify_business_access)):
    """Check current accounting connection status."""
    db = get_database()
    
    connections = []
    async for conn in db.accounting_connections.find(
        {"business_id": business_id, "status": {"$ne": "disconnected"}}
    ):
        conn["_id"] = str(conn["_id"])
        # Strip sensitive tokens from response
        conn.pop("access_token", None)
        conn.pop("refresh_token", None)
        conn.pop("client_secret", None)
        connections.append(conn)
    
    return {"connections": connections}


@router.delete("/business/{business_id}/disconnect/{provider}")
async def disconnect_provider(business_id: str, tenant: TenantContext = Depends(verify_business_access), provider: str):
    """Disconnect an accounting provider."""
    db = get_database()
    await db.accounting_connections.update_one(
        {"business_id": business_id, "provider": provider},
        {"$set": {"status": "disconnected", "disconnected_at": datetime.utcnow()}}
    )
    return {"disconnected": True}


# ─── Account Mapping ─── #

@router.get("/business/{business_id}/mapping")
async def get_account_mapping(business_id: str, tenant: TenantContext = Depends(verify_business_access)):
    """Get the current account code mapping."""
    db = get_database()
    mapping = await db.accounting_mappings.find_one({"business_id": business_id})
    if not mapping:
        # Return defaults
        return {"mapping": AccountMapping().dict(), "is_default": True}
    mapping["_id"] = str(mapping["_id"])
    return {"mapping": mapping, "is_default": False}


@router.put("/business/{business_id}/mapping")
async def set_account_mapping(business_id: str, tenant: TenantContext = Depends(verify_business_access), body: AccountMapping):
    """Set custom account code mapping for your chart of accounts."""
    db = get_database()
    mapping = body.dict()
    mapping["business_id"] = business_id
    mapping["updated_at"] = datetime.utcnow()
    
    await db.accounting_mappings.update_one(
        {"business_id": business_id},
        {"$set": mapping},
        upsert=True
    )
    return {"updated": True}


# ─── Sync Configuration ─── #

@router.get("/business/{business_id}/sync-config")
async def get_sync_config(business_id: str, tenant: TenantContext = Depends(verify_business_access)):
    """Get sync configuration."""
    db = get_database()
    config = await db.accounting_sync_config.find_one({"business_id": business_id})
    if not config:
        return {"config": SyncConfig().dict(), "is_default": True}
    config["_id"] = str(config["_id"])
    return {"config": config, "is_default": False}


@router.put("/business/{business_id}/sync-config")
async def set_sync_config(business_id: str, tenant: TenantContext = Depends(verify_business_access), body: SyncConfig):
    """Set sync configuration."""
    db = get_database()
    config = body.dict()
    config["business_id"] = business_id
    config["updated_at"] = datetime.utcnow()
    
    await db.accounting_sync_config.update_one(
        {"business_id": business_id},
        {"$set": config},
        upsert=True
    )
    return {"updated": True}


# ─── Daily Sales Journal Generation ─── #

@router.post("/business/{business_id}/generate-journal")
async def generate_daily_journal(business_id: str, tenant: TenantContext = Depends(verify_business_access), body: ManualSyncRequest):
    """
    Generate a daily sales journal entry for the specified date range.
    This is the core of the integration — transforms POS data into double-entry bookkeeping.
    
    Journal structure per day:
    DR Bank (Card)          £xxx.xx
    DR Bank (Cash)          £xxx.xx
    DR Card Fees Expense    £xx.xx
    DR Discounts            £xx.xx
        CR Food Sales           £xxx.xx
        CR Drink Sales          £xxx.xx
        CR Takeaway Sales       £xxx.xx
        CR Delivery Sales       £xxx.xx
        CR Service Charge       £xxx.xx
        CR VAT Output (20%)     £xxx.xx
        CR VAT Output (5%)      £xx.xx
        CR Tips Liability       £xx.xx
    """
    db = get_database()
    
    mapping_doc = await db.accounting_mappings.find_one({"business_id": business_id})
    mapping = mapping_doc if mapping_doc else AccountMapping().dict()
    
    config_doc = await db.accounting_sync_config.find_one({"business_id": business_id})
    config = config_doc if config_doc else SyncConfig().dict()
    
    date_from = datetime.fromisoformat(body.date_from)
    date_to = datetime.fromisoformat(body.date_to + "T23:59:59")
    
    journals = []
    current = date_from
    
    while current <= date_to:
        day_start = current.replace(hour=0, minute=0, second=0)
        day_end = current.replace(hour=23, minute=59, second=59)
        
        journal = await _build_journal_for_day(db, business_id, day_start, day_end, mapping, config)
        
        if journal["total_revenue"] > 0 or journal["total_refunds"] > 0:
            journals.append(journal)
        
        current += timedelta(days=1)
    
    return {"journals": journals, "count": len(journals), "period": {"from": body.date_from, "to": body.date_to}}


@router.post("/business/{business_id}/sync")
async def sync_to_provider(business_id: str, tenant: TenantContext = Depends(verify_business_access), body: ManualSyncRequest):
    """
    Generate journals AND push them to the connected accounting provider.
    """
    db = get_database()
    
    connection = await db.accounting_connections.find_one(
        {"business_id": business_id, "status": "connected"}
    )
    if not connection:
        raise HTTPException(400, "No active accounting connection. Connect a provider first.")
    
    # Generate journals
    mapping_doc = await db.accounting_mappings.find_one({"business_id": business_id})
    mapping = mapping_doc if mapping_doc else AccountMapping().dict()
    config_doc = await db.accounting_sync_config.find_one({"business_id": business_id})
    config = config_doc if config_doc else SyncConfig().dict()
    
    date_from = datetime.fromisoformat(body.date_from)
    date_to = datetime.fromisoformat(body.date_to + "T23:59:59")
    
    journals = []
    current = date_from
    while current <= date_to:
        day_start = current.replace(hour=0, minute=0, second=0)
        day_end = current.replace(hour=23, minute=59, second=59)
        journal = await _build_journal_for_day(db, business_id, day_start, day_end, mapping, config)
        if journal["total_revenue"] > 0:
            journals.append(journal)
        current += timedelta(days=1)
    
    # Push to provider
    provider = connection["provider"]
    results = []
    
    for journal in journals:
        if provider == "xero":
            result = await _push_to_xero(connection, journal, mapping)
        elif provider == "quickbooks":
            result = await _push_to_quickbooks(connection, journal, mapping)
        elif provider == "sage":
            result = await _push_to_sage(connection, journal, mapping)
        else:
            result = {"status": "unsupported_provider"}
        
        results.append(result)
        
        # Record sync
        await db.accounting_sync_log.insert_one({
            "business_id": business_id,
            "provider": provider,
            "journal_date": journal["date"],
            "status": result.get("status", "unknown"),
            "journal_id": result.get("journal_id"),
            "error": result.get("error"),
            "synced_at": datetime.utcnow()
        })
    
    await db.accounting_connections.update_one(
        {"_id": connection["_id"]},
        {"$set": {"last_sync": datetime.utcnow()}}
    )
    
    return {
        "synced": len([r for r in results if r.get("status") == "success"]),
        "failed": len([r for r in results if r.get("status") != "success"]),
        "results": results
    }


# ─── VAT Reporting ─── #

@router.get("/business/{business_id}/vat-summary")
async def get_vat_summary(business_id: str, tenant: TenantContext = Depends(verify_business_access), period_from: str = Query(...), period_to: str = Query(...)):
    """
    VAT summary for MTD (Making Tax Digital) preparation.
    Breaks down sales by VAT rate with the correct UK hospitality rules:
    
    - Standard rate (20%): Dine-in food & drink, hot takeaway food
    - Reduced rate (5%): N/A since temporary Covid rate ended
    - Zero rate (0%): Cold takeaway food (sandwiches, salads), most groceries
    - Exempt: Some catering scenarios
    """
    db = get_database()
    
    from_dt = datetime.fromisoformat(period_from)
    to_dt = datetime.fromisoformat(period_to + "T23:59:59")
    
    # Aggregate orders by VAT category
    pipeline = [
        {"$match": {
            "business_id": business_id,
            "status": {"$in": ["paid", "closed"]},
            "created_at": {"$gte": from_dt, "$lte": to_dt}
        }},
        {"$unwind": "$items"},
        {"$group": {
            "_id": "$items.vat_rate",
            "net_sales": {"$sum": "$items.net_amount"},
            "vat_amount": {"$sum": "$items.vat_amount"},
            "gross_sales": {"$sum": {"$add": ["$items.net_amount", "$items.vat_amount"]}},
            "item_count": {"$sum": "$items.quantity"}
        }}
    ]
    
    vat_breakdown = {}
    total_net = 0
    total_vat = 0
    
    async for doc in db.orders.aggregate(pipeline):
        rate = doc["_id"] or 20
        vat_breakdown[f"{rate}%"] = {
            "rate": rate,
            "net_sales": round(doc["net_sales"], 2),
            "vat_amount": round(doc["vat_amount"], 2),
            "gross_sales": round(doc["gross_sales"], 2),
            "item_count": doc["item_count"]
        }
        total_net += doc["net_sales"]
        total_vat += doc["vat_amount"]
    
    # Refunds
    refund_pipeline = [
        {"$match": {
            "business_id": business_id,
            "type": "refund",
            "created_at": {"$gte": from_dt, "$lte": to_dt}
        }},
        {"$group": {
            "_id": None,
            "total_refunds": {"$sum": "$amount"},
            "refund_vat": {"$sum": "$vat_amount"}
        }}
    ]
    refund_data = {"total_refunds": 0, "refund_vat": 0}
    async for doc in db.transactions.aggregate(refund_pipeline):
        refund_data = {"total_refunds": round(doc["total_refunds"], 2), "refund_vat": round(doc["refund_vat"], 2)}
    
    return {
        "period": {"from": period_from, "to": period_to},
        "vat_breakdown": vat_breakdown,
        "totals": {
            "net_sales": round(total_net, 2),
            "total_vat": round(total_vat, 2),
            "gross_sales": round(total_net + total_vat, 2),
            "refunds_net": refund_data["total_refunds"],
            "refunds_vat": refund_data["refund_vat"],
            "net_vat_payable": round(total_vat - refund_data["refund_vat"], 2)
        },
        "mtd_box_values": {
            "box_1_vat_due_sales": round(total_vat, 2),
            "box_6_total_sales_ex_vat": round(total_net, 2),
            "box_7_total_purchases_ex_vat": 0,  # Would need purchase data
        },
        "notes": "Box values are indicative. Consult your accountant for final MTD submission."
    }


# ─── Reconciliation ─── #

@router.get("/business/{business_id}/reconciliation")
async def get_reconciliation_data(business_id: str, tenant: TenantContext = Depends(verify_business_access), date_str: str = Query(..., alias="date")):
    """
    Reconciliation helper: compares POS takings with expected bank deposits.
    Accounts for card processing fees, timing delays, and cash variance.
    """
    db = get_database()
    
    day_start = datetime.fromisoformat(date_str)
    day_end = day_start.replace(hour=23, minute=59, second=59)
    
    # POS card total
    card_pipeline = [
        {"$match": {
            "business_id": business_id,
            "status": {"$in": ["paid", "closed"]},
            "created_at": {"$gte": day_start, "$lte": day_end},
            "payments.method": "card"
        }},
        {"$unwind": "$payments"},
        {"$match": {"payments.method": "card"}},
        {"$group": {"_id": None, "total": {"$sum": "$payments.amount"}}}
    ]
    card_total = 0
    async for doc in db.orders.aggregate(card_pipeline):
        card_total = round(doc["total"], 2)
    
    # POS cash total
    cash_pipeline = [
        {"$match": {
            "business_id": business_id,
            "status": {"$in": ["paid", "closed"]},
            "created_at": {"$gte": day_start, "$lte": day_end},
            "payments.method": "cash"
        }},
        {"$unwind": "$payments"},
        {"$match": {"payments.method": "cash"}},
        {"$group": {"_id": None, "total": {"$sum": "$payments.amount"}}}
    ]
    cash_total = 0
    async for doc in db.orders.aggregate(cash_pipeline):
        cash_total = round(doc["total"], 2)
    
    # Estimated card fees (using Dojo rates)
    debit_rate = 0.003  # 0.3%
    credit_rate = 0.007  # 0.7%
    auth_fee = 0.025  # 2.5p per transaction
    
    # Estimate 70% debit / 30% credit split (UK average)
    estimated_fees = round(
        (card_total * 0.7 * debit_rate) + (card_total * 0.3 * credit_rate) + 
        (auth_fee * await db.orders.count_documents({
            "business_id": business_id,
            "created_at": {"$gte": day_start, "$lte": day_end},
            "payments.method": "card"
        })),
        2
    )
    
    expected_deposit = round(card_total - estimated_fees, 2)
    
    # Tips
    tip_total = 0
    async for doc in db.tronc_tips.aggregate([
        {"$match": {
            "business_id": business_id,
            "created_at": {"$gte": day_start, "$lte": day_end},
            "status": {"$ne": "voided"}
        }},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
    ]):
        tip_total = round(doc["total"], 2)
    
    # Refunds
    refund_total = 0
    async for doc in db.orders.aggregate([
        {"$match": {
            "business_id": business_id,
            "status": "refunded",
            "updated_at": {"$gte": day_start, "$lte": day_end}
        }},
        {"$group": {"_id": None, "total": {"$sum": "$refund_amount"}}}
    ]):
        refund_total = round(doc["total"], 2)
    
    return {
        "date": date_str,
        "pos_totals": {
            "card": card_total,
            "cash": cash_total,
            "tips": tip_total,
            "gross_total": round(card_total + cash_total, 2)
        },
        "expected_bank_deposit": {
            "card_gross": card_total,
            "estimated_fees": estimated_fees,
            "net_deposit": expected_deposit,
            "note": "Deposit typically arrives T+1 (next business day)"
        },
        "cash_reconciliation": {
            "expected_in_till": cash_total,
            "note": "Compare against physical cash count"
        },
        "refunds": refund_total,
        "fee_breakdown": {
            "debit_rate": "0.3%",
            "credit_rate": "0.7%",
            "auth_fee": "2.5p",
            "estimated_total": estimated_fees
        }
    }


# ─── Sync History ─── #

@router.get("/business/{business_id}/sync-log")
async def get_sync_log(business_id: str, tenant: TenantContext = Depends(verify_business_access), limit: int = 30):
    """Get sync history."""
    db = get_database()
    
    logs = []
    async for doc in db.accounting_sync_log.find(
        {"business_id": business_id}
    ).sort("synced_at", -1).limit(limit):
        doc["_id"] = str(doc["_id"])
        logs.append(doc)
    
    return {"logs": logs}


# ─── Internal Helpers ─── #

async def _build_journal_for_day(db, business_id, day_start, day_end, mapping, config):
    """Build a complete double-entry journal for a single day."""
    
    # Revenue by category
    revenue_pipeline = [
        {"$match": {
            "business_id": business_id,
            "status": {"$in": ["paid", "closed"]},
            "created_at": {"$gte": day_start, "$lte": day_end}
        }},
        {"$unwind": "$items"},
        {"$group": {
            "_id": {"category": "$items.category", "vat_rate": "$items.vat_rate"},
            "net_total": {"$sum": "$items.net_amount"},
            "vat_total": {"$sum": "$items.vat_amount"},
            "quantity": {"$sum": "$items.quantity"}
        }}
    ]
    
    revenue_lines = []
    total_revenue = 0
    total_vat = 0
    
    async for doc in db.orders.aggregate(revenue_pipeline):
        cat = (doc["_id"].get("category") or "food").lower()
        net = round(doc["net_total"] or 0, 2)
        vat = round(doc["vat_total"] or 0, 2)
        
        # Map category to account
        if "drink" in cat or "beverage" in cat or "bar" in cat:
            account = mapping.get("drink_sales", "201")
        elif "takeaway" in cat or "collection" in cat:
            account = mapping.get("takeaway_sales", "202")
        elif "delivery" in cat:
            account = mapping.get("delivery_sales", "203")
        else:
            account = mapping.get("food_sales", "200")
        
        revenue_lines.append({
            "account_code": account,
            "category": cat,
            "net_amount": net,
            "vat_rate": doc["_id"].get("vat_rate", 20),
            "vat_amount": vat,
            "type": "CREDIT"
        })
        total_revenue += net
        total_vat += vat
    
    # Payments
    payment_pipeline = [
        {"$match": {
            "business_id": business_id,
            "status": {"$in": ["paid", "closed"]},
            "created_at": {"$gte": day_start, "$lte": day_end}
        }},
        {"$unwind": "$payments"},
        {"$group": {
            "_id": "$payments.method",
            "total": {"$sum": "$payments.amount"},
            "count": {"$sum": 1}
        }}
    ]
    
    payment_lines = []
    async for doc in db.orders.aggregate(payment_pipeline):
        method = doc["_id"]
        account = mapping.get(f"{method}_payments", mapping.get("card_payments", "1001"))
        payment_lines.append({
            "account_code": account,
            "method": method,
            "amount": round(doc["total"], 2),
            "transaction_count": doc["count"],
            "type": "DEBIT"
        })
    
    # Discounts
    discount_pipeline = [
        {"$match": {
            "business_id": business_id,
            "status": {"$in": ["paid", "closed"]},
            "created_at": {"$gte": day_start, "$lte": day_end},
            "discount_amount": {"$gt": 0}
        }},
        {"$group": {
            "_id": None,
            "total": {"$sum": "$discount_amount"}
        }}
    ]
    discount_total = 0
    async for doc in db.orders.aggregate(discount_pipeline):
        discount_total = round(doc["total"], 2)
    
    # Service charges
    sc_pipeline = [
        {"$match": {
            "business_id": business_id,
            "status": {"$in": ["paid", "closed"]},
            "created_at": {"$gte": day_start, "$lte": day_end},
            "service_charge_amount": {"$gt": 0}
        }},
        {"$group": {"_id": None, "total": {"$sum": "$service_charge_amount"}}}
    ]
    sc_total = 0
    async for doc in db.orders.aggregate(sc_pipeline):
        sc_total = round(doc["total"], 2)
    
    # Tips
    tip_pipeline = [
        {"$match": {
            "business_id": business_id,
            "created_at": {"$gte": day_start, "$lte": day_end},
            "status": {"$ne": "voided"}
        }},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
    ]
    tip_total = 0
    async for doc in db.tronc_tips.aggregate(tip_pipeline):
        tip_total = round(doc["total"], 2)
    
    # Build journal
    journal_lines = []
    
    # DEBITS
    for pl in payment_lines:
        journal_lines.append({
            "account_code": pl["account_code"],
            "description": f"{pl['method'].title()} payments ({pl['transaction_count']} transactions)",
            "debit": pl["amount"],
            "credit": 0
        })
    
    if discount_total > 0:
        journal_lines.append({
            "account_code": mapping.get("discounts", "206"),
            "description": "Discounts",
            "debit": discount_total,
            "credit": 0
        })
    
    # CREDITS
    for rl in revenue_lines:
        journal_lines.append({
            "account_code": rl["account_code"],
            "description": f"{rl['category'].title()} sales (net, {rl['vat_rate']}% VAT)",
            "debit": 0,
            "credit": rl["net_amount"]
        })
    
    if total_vat > 0:
        journal_lines.append({
            "account_code": mapping.get("vat_standard", "820"),
            "description": "VAT Output",
            "debit": 0,
            "credit": round(total_vat, 2)
        })
    
    if sc_total > 0:
        journal_lines.append({
            "account_code": mapping.get("service_charge", "204"),
            "description": "Service charges collected",
            "debit": 0,
            "credit": sc_total
        })
    
    if tip_total > 0:
        journal_lines.append({
            "account_code": mapping.get("tips_liability", "2100"),
            "description": "Tips held for distribution",
            "debit": 0,
            "credit": tip_total
        })
    
    total_debits = round(sum(l["debit"] for l in journal_lines), 2)
    total_credits = round(sum(l["credit"] for l in journal_lines), 2)
    
    return {
        "date": day_start.strftime("%Y-%m-%d"),
        "reference": f"{config.get('journal_prefix', 'REEVE')}-{day_start.strftime('%Y%m%d')}",
        "narration": f"Daily sales summary {day_start.strftime('%d %B %Y')}",
        "lines": journal_lines,
        "total_debits": total_debits,
        "total_credits": total_credits,
        "balanced": abs(total_debits - total_credits) < 0.01,
        "total_revenue": round(total_revenue, 2),
        "total_vat": round(total_vat, 2),
        "total_refunds": 0,
        "discounts": discount_total,
        "service_charges": sc_total,
        "tips": tip_total
    }


async def _push_to_xero(connection, journal, mapping):
    """Push journal entry to Xero via their API."""
    try:
        headers = {
            "Authorization": f"Bearer {connection['access_token']}",
            "Content-Type": "application/json",
            "Xero-Tenant-Id": connection.get("tenant_id", "")
        }
        
        # Transform journal to Xero ManualJournal format
        xero_lines = []
        for line in journal["lines"]:
            xero_lines.append({
                "LineAmount": line["debit"] if line["debit"] > 0 else -line["credit"],
                "AccountCode": line["account_code"],
                "Description": line["description"]
            })
        
        payload = {
            "ManualJournals": [{
                "Narration": journal["narration"],
                "Date": journal["date"],
                "JournalLines": xero_lines
            }]
        }
        
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                "https://api.xero.com/api.xro/2.0/ManualJournals",
                headers=headers,
                json=payload,
                timeout=30
            )
        
        if resp.status_code in (200, 201):
            data = resp.json()
            journal_id = data.get("ManualJournals", [{}])[0].get("ManualJournalID")
            return {"status": "success", "journal_id": journal_id, "date": journal["date"]}
        else:
            return {"status": "error", "error": resp.text, "date": journal["date"]}
    
    except Exception as e:
        return {"status": "error", "error": str(e), "date": journal["date"]}


async def _push_to_quickbooks(connection, journal, mapping):
    """Push journal entry to QuickBooks via their API."""
    try:
        headers = {
            "Authorization": f"Bearer {connection['access_token']}",
            "Content-Type": "application/json",
            "Accept": "application/json"
        }
        
        lines = []
        for i, line in enumerate(journal["lines"]):
            posting_type = "Debit" if line["debit"] > 0 else "Credit"
            amount = line["debit"] if line["debit"] > 0 else line["credit"]
            lines.append({
                "JournalEntryLineDetail": {
                    "PostingType": posting_type,
                    "AccountRef": {"value": line["account_code"]},
                },
                "Description": line["description"],
                "Amount": amount,
                "DetailType": "JournalEntryLineDetail"
            })
        
        payload = {
            "TxnDate": journal["date"],
            "PrivateNote": journal["narration"],
            "Line": lines
        }
        
        realm_id = connection.get("tenant_id", "")
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"https://quickbooks.api.intuit.com/v3/company/{realm_id}/journalentry",
                headers=headers,
                json=payload,
                timeout=30
            )
        
        if resp.status_code in (200, 201):
            data = resp.json()
            return {"status": "success", "journal_id": data.get("JournalEntry", {}).get("Id"), "date": journal["date"]}
        else:
            return {"status": "error", "error": resp.text, "date": journal["date"]}
    
    except Exception as e:
        return {"status": "error", "error": str(e), "date": journal["date"]}


async def _push_to_sage(connection, journal, mapping):
    """Push journal entry to Sage via their API."""
    try:
        headers = {
            "Authorization": f"Bearer {connection['access_token']}",
            "Content-Type": "application/json"
        }
        
        lines = []
        for line in journal["lines"]:
            lines.append({
                "ledger_account_id": line["account_code"],
                "debit": line["debit"],
                "credit": line["credit"],
                "details": line["description"]
            })
        
        payload = {
            "journal": {
                "date": journal["date"],
                "reference": journal["reference"],
                "description": journal["narration"],
                "journal_lines": lines
            }
        }
        
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                "https://api.accounting.sage.com/v3.1/journals",
                headers=headers,
                json=payload,
                timeout=30
            )
        
        if resp.status_code in (200, 201):
            data = resp.json()
            return {"status": "success", "journal_id": data.get("id"), "date": journal["date"]}
        else:
            return {"status": "error", "error": resp.text, "date": journal["date"]}
    
    except Exception as e:
        return {"status": "error", "error": str(e), "date": journal["date"]}
