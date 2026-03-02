"""
Rezvo Agent API Routes
======================
Dashboard endpoints for monitoring the AI operations layer.
Manual task triggers, approval queue, audit log, stats.
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timedelta
from bson import ObjectId
from database import get_database

router = APIRouter(prefix="/agent", tags=["AI Agent"])


# ─── Models ─── #

class ManualTaskRequest(BaseModel):
    task: str  # Task name to trigger
    params: Optional[dict] = None

class ApprovalAction(BaseModel):
    action: str  # approve or reject
    note: Optional[str] = None

class AgentQuery(BaseModel):
    question: str
    tools: Optional[List[str]] = None


# ─── Dashboard Stats ─── #

@router.get("/stats")
async def get_agent_stats():
    """Get comprehensive agent dashboard stats."""
    db = get_database()
    now = datetime.utcnow()
    
    # Last 24h stats
    cutoff_24h = now - timedelta(hours=24)
    cutoff_7d = now - timedelta(days=7)
    
    # Task runs
    runs_24h = await db.agent_audit.count_documents({"created_at": {"$gte": cutoff_24h}})
    runs_7d = await db.agent_audit.count_documents({"created_at": {"$gte": cutoff_7d}})
    
    # Tokens used
    token_pipeline = [
        {"$match": {"created_at": {"$gte": cutoff_7d}}},
        {"$group": {"_id": None, "total": {"$sum": "$tokens_used"}}}
    ]
    token_result = await db.agent_audit.aggregate(token_pipeline).to_list(1)
    tokens_7d = token_result[0]["total"] if token_result else 0
    
    # Estimated cost (Haiku avg)
    cost_7d = (tokens_7d / 1_000_000) * 0.75
    
    # Task breakdown
    task_pipeline = [
        {"$match": {"created_at": {"$gte": cutoff_7d}}},
        {"$group": {
            "_id": "$task_type",
            "count": {"$sum": 1},
            "tokens": {"$sum": "$tokens_used"},
            "avg_duration": {"$avg": "$duration_seconds"},
        }},
        {"$sort": {"count": -1}},
    ]
    task_breakdown = []
    async for doc in db.agent_audit.aggregate(task_pipeline):
        task_breakdown.append({
            "task": doc["_id"],
            "runs": doc["count"],
            "tokens": doc["tokens"],
            "avg_duration_sec": round(doc["avg_duration"] or 0, 2),
        })
    
    # Pending approvals
    pending = await db.agent_approvals.count_documents({"status": "pending"})
    
    # Health
    latest_health = await db.health_snapshots.find_one(sort=[("created_at", -1)])
    
    # Task schedule status
    from agent.scheduler import get_task_status
    task_status = await get_task_status()
    
    # Emails sent by agent
    emails_24h = await db.email_log.count_documents({
        "sent_by": "agent", "sent_at": {"$gte": cutoff_24h}
    })
    
    # Leads created
    leads_7d = await db.sales_leads.count_documents({"created_at": {"$gte": cutoff_7d}})
    
    return {
        "runs_24h": runs_24h,
        "runs_7d": runs_7d,
        "tokens_7d": tokens_7d,
        "estimated_cost_7d_usd": round(cost_7d, 4),
        "task_breakdown": task_breakdown,
        "pending_approvals": pending,
        "latest_health": latest_health["result"] if latest_health else None,
        "task_schedule": task_status,
        "emails_sent_24h": emails_24h,
        "leads_7d": leads_7d,
    }


# ─── Audit Log ─── #

@router.get("/audit")
async def get_audit_log(limit: int = 50, task_type: str = None, hours_back: int = 24):
    """Get agent audit log — every task run with results."""
    db = get_database()
    query = {"created_at": {"$gte": datetime.utcnow() - timedelta(hours=hours_back)}}
    if task_type:
        query["task_type"] = task_type
    
    logs = []
    async for doc in db.agent_audit.find(query).sort("created_at", -1).limit(limit):
        doc["_id"] = str(doc["_id"])
        if "created_at" in doc:
            doc["created_at"] = doc["created_at"].isoformat()
        logs.append(doc)
    
    return {"logs": logs, "count": len(logs)}


# ─── Approval Queue ─── #

@router.get("/approvals")
async def get_pending_approvals():
    """Get actions pending human approval."""
    db = get_database()
    approvals = []
    async for doc in db.agent_approvals.find({"status": "pending"}).sort("created_at", -1):
        doc["_id"] = str(doc["_id"])
        if "created_at" in doc:
            doc["created_at"] = doc["created_at"].isoformat()
        approvals.append(doc)
    return {"approvals": approvals, "count": len(approvals)}


@router.post("/approvals/{approval_id}")
async def handle_approval(approval_id: str, body: ApprovalAction):
    """Approve or reject a pending agent action."""
    db = get_database()
    approval = await db.agent_approvals.find_one({"_id": ObjectId(approval_id)})
    if not approval:
        raise HTTPException(404, "Approval not found")
    if approval["status"] != "pending":
        raise HTTPException(400, "Already processed")
    
    if body.action == "approve":
        # Execute the blocked tool call
        from agent.tools.all_tools import register_all_tools
        from agent.runner import TOOL_HANDLERS
        
        if not TOOL_HANDLERS:
            register_all_tools()
        
        handler = TOOL_HANDLERS.get(approval["tool"])
        if handler:
            try:
                result = await handler(**approval["input"])
            except Exception as e:
                result = {"error": str(e)}
        else:
            result = {"error": "Handler not found"}
        
        await db.agent_approvals.update_one(
            {"_id": ObjectId(approval_id)},
            {"$set": {
                "status": "approved",
                "result": result,
                "note": body.note,
                "resolved_at": datetime.utcnow(),
            }}
        )
        return {"status": "approved", "result": result}
    
    else:
        await db.agent_approvals.update_one(
            {"_id": ObjectId(approval_id)},
            {"$set": {
                "status": "rejected",
                "note": body.note,
                "resolved_at": datetime.utcnow(),
            }}
        )
        return {"status": "rejected"}


# ─── Manual Task Triggers ─── #

@router.post("/run-task")
async def run_task_manually(req: ManualTaskRequest):
    """Manually trigger an agent task."""
    from agent.tasks.scheduled import (
        health_check, triage_tickets, moderate_reviews, daily_briefing,
        score_churn_risk, discover_leads, research_and_outreach_leads,
        process_dunning, generate_seo_content, process_onboarding_drip,
        learn_from_conversations,
    )
    from agent.tasks.outreach import (
        outreach_warmup_cycle, outreach_daily_advance,
        outreach_process_campaigns, outreach_health_scoring,
        outreach_campaign_status_check,
    )
    
    task_map = {
        "health_check": health_check,
        "ticket_triage": triage_tickets,
        "review_moderation": moderate_reviews,
        "daily_briefing": daily_briefing,
        "churn_scoring": score_churn_risk,
        "lead_discovery": discover_leads,
        "lead_research": research_and_outreach_leads,
        "dunning": process_dunning,
        "seo_content": generate_seo_content,
        "onboarding_drip": process_onboarding_drip,
        "knowledge_learning": learn_from_conversations,
        # Outreach engine tasks
        "outreach_warmup": outreach_warmup_cycle,
        "outreach_daily": outreach_daily_advance,
        "outreach_campaigns": outreach_process_campaigns,
        "outreach_health": outreach_health_scoring,
        "outreach_status": outreach_campaign_status_check,
    }
    
    func = task_map.get(req.task)
    if not func:
        raise HTTPException(400, f"Unknown task: {req.task}. Available: {list(task_map.keys())}")
    
    try:
        if req.params:
            result = await func(**req.params)
        else:
            result = await func()
        return {"task": req.task, "result": result}
    except Exception as e:
        raise HTTPException(500, f"Task failed: {str(e)}")


# ─── Ask the Agent ─── #

@router.post("/ask")
async def ask_agent(req: AgentQuery):
    """Ask the agent a question — it can use tools to gather data and answer."""
    try:
        from agent.runner import run_agent, MODEL_SONNET
        from agent.tools.all_tools import register_all_tools, TOOL_REGISTRY
        
        if not TOOL_REGISTRY:
            register_all_tools()
        
        result = await run_agent(
            task=req.question,
            tools=req.tools,
            model=MODEL_SONNET,
            max_turns=8,
            task_type="manual_query",
        )
        return result
    except Exception as e:
        return {"result": f"Agent error: {str(e)}", "tool_calls": [], "tokens_used": 0, "duration": 0}


# ─── Sales Pipeline ─── #

@router.get("/leads")
async def get_leads(status: str = None, min_score: int = None, limit: int = 30):
    """Get sales leads."""
    db = get_database()
    query = {}
    if status:
        query["status"] = status
    if min_score:
        query["score"] = {"$gte": min_score}
    
    leads = []
    async for doc in db.sales_leads.find(query).sort("score", -1).limit(limit):
        doc["_id"] = str(doc["_id"])
        if "created_at" in doc:
            doc["created_at"] = doc["created_at"].isoformat()
        if "updated_at" in doc:
            doc["updated_at"] = doc["updated_at"].isoformat()
        leads.append(doc)
    
    total = await db.sales_leads.count_documents(query)
    return {"leads": leads, "total": total}


@router.post("/leads/discover")
async def trigger_lead_discovery(city: str = "Nottingham", cuisine: str = None):
    """Manually trigger lead discovery for a city."""
    from agent.tasks.scheduled import discover_leads
    result = await discover_leads(city=city, cuisine=cuisine)
    return result


# ─── Churn Dashboard ─── #

@router.get("/churn")
async def get_churn_dashboard():
    """Get churn risk overview."""
    db = get_database()
    
    pipeline = [
        {"$group": {
            "_id": {
                "$cond": [
                    {"$gte": ["$score", 80]}, "critical",
                    {"$cond": [
                        {"$gte": ["$score", 60]}, "high",
                        {"$cond": [
                            {"$gte": ["$score", 40]}, "medium", "low"
                        ]}
                    ]}
                ]
            },
            "count": {"$sum": 1},
        }}
    ]
    
    # Simpler approach
    critical = await db.churn_scores.count_documents({"score": {"$gte": 80}})
    high = await db.churn_scores.count_documents({"score": {"$gte": 60, "$lt": 80}})
    medium = await db.churn_scores.count_documents({"score": {"$gte": 40, "$lt": 60}})
    low = await db.churn_scores.count_documents({"score": {"$lt": 40}})
    
    # Top at-risk
    at_risk = []
    async for doc in db.churn_scores.find({"score": {"$gte": 40}}).sort("score", -1).limit(10):
        doc["_id"] = str(doc["_id"])
        at_risk.append(doc)
    
    return {
        "critical": critical,
        "high": high,
        "medium": medium,
        "low": low,
        "at_risk_businesses": at_risk,
    }


# ─── SEO Pages ─── #

@router.get("/seo-pages")
async def get_seo_pages(status: str = None, limit: int = 50):
    """Get generated SEO pages."""
    db = get_database()
    query = {}
    if status:
        query["status"] = status
    
    pages = []
    async for doc in db.seo_pages.find(query).sort("created_at", -1).limit(limit):
        doc["_id"] = str(doc["_id"])
        if "created_at" in doc:
            doc["created_at"] = doc["created_at"].isoformat()
        pages.append(doc)
    return {"pages": pages, "count": len(pages)}


@router.put("/seo-pages/{page_id}/publish")
async def publish_seo_page(page_id: str):
    """Approve and publish an SEO page."""
    db = get_database()
    await db.seo_pages.update_one(
        {"_id": ObjectId(page_id)},
        {"$set": {"status": "published", "published_at": datetime.utcnow()}}
    )
    return {"status": "published"}
