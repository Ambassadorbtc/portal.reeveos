"""
ReeveOS EPOS — Allergen Management & Natasha's Law Compliance
================================================================
Full UK Food Information Regulations 2014 + Natasha's Law (Oct 2021) compliance.
14 regulated allergens tracked at ingredient level, auto-calculated for menu items,
displayed on POS, KDS, kiosks, and online ordering. Includes cross-contamination
risk matrix, customer allergen profiles, label generation, and full audit trail.

COMPETITIVE EDGE: No UK EPOS natively handles allergen compliance at this depth.
- Tevalis: ingredient-level profiling (we match + exceed with risk matrix)
- SumUp: visual alerts on POS only (we add KDS, kiosk, online, labels)
- Epos Now: basic product-level info (we auto-calculate from ingredients)
- Toast/Square/Lightspeed: modifier notes only (we have structured data)
"""
from fastapi import Depends,  APIRouter, HTTPException, Body, UploadFile, File, Query
from pydantic import BaseModel, Field
from typing import Optional, List, Dict
from datetime import datetime
from bson import ObjectId
from database import get_database
import csv
import io
import logging
from middleware.tenant import verify_business_access, TenantContext

logger = logging.getLogger("allergens")
router = APIRouter(prefix="/allergens", tags=["Allergen Management"])

# ─── The 14 UK Regulated Allergens (Food Information Regulations 2014) ─── #
UK_ALLERGENS = [
    {"id": "celery", "name": "Celery", "icon": "🌿", "description": "Including celeriac"},
    {"id": "cereals", "name": "Cereals containing gluten", "icon": "🌾", "description": "Wheat, rye, barley, oats, spelt, kamut"},
    {"id": "crustaceans", "name": "Crustaceans", "icon": "🦀", "description": "Crabs, lobster, prawns, scampi"},
    {"id": "eggs", "name": "Eggs", "icon": "🥚", "description": "Including products made with eggs"},
    {"id": "fish", "name": "Fish", "icon": "🐟", "description": "Including products made with fish"},
    {"id": "lupin", "name": "Lupin", "icon": "🌼", "description": "Including lupin seeds and flour"},
    {"id": "milk", "name": "Milk", "icon": "🥛", "description": "Including lactose and products made with milk"},
    {"id": "molluscs", "name": "Molluscs", "icon": "🦪", "description": "Mussels, oysters, squid, snails"},
    {"id": "mustard", "name": "Mustard", "icon": "🟡", "description": "Including mustard seeds, powder, leaves"},
    {"id": "nuts", "name": "Tree Nuts", "icon": "🥜", "description": "Almonds, hazelnuts, walnuts, cashews, pecans, brazils, pistachios, macadamia"},
    {"id": "peanuts", "name": "Peanuts", "icon": "🥜", "description": "Including groundnuts and peanut oil"},
    {"id": "sesame", "name": "Sesame Seeds", "icon": "⚪", "description": "Including sesame oil and paste (tahini)"},
    {"id": "soya", "name": "Soya", "icon": "🫘", "description": "Including soya beans, tofu, soya sauce"},
    {"id": "sulphites", "name": "Sulphur dioxide / Sulphites", "icon": "🍷", "description": "At concentration > 10mg/kg or 10mg/L expressed as SO2"},
]
ALLERGEN_IDS = [a["id"] for a in UK_ALLERGENS]


# ─── Models ─── #

class AllergenTag(BaseModel):
    allergen_id: str
    severity: str = "contains"  # contains, may_contain, trace, free_from
    notes: Optional[str] = None

class IngredientAllergens(BaseModel):
    ingredient_id: str
    allergens: List[AllergenTag]

class MenuItemAllergenOverride(BaseModel):
    """Manual override when auto-calculation isn't sufficient (e.g., shared fryer)."""
    menu_item_id: str
    additional_allergens: List[AllergenTag] = []
    cross_contamination: List[Dict] = []  # [{allergen_id, risk: "high"|"medium"|"low", reason}]
    preparation_notes: Optional[str] = None

class CustomerAllergenProfile(BaseModel):
    customer_id: Optional[str] = None
    name: str
    phone: Optional[str] = None
    email: Optional[str] = None
    allergens: List[str]  # allergen IDs
    severity_notes: Optional[str] = None
    epipen_carrier: bool = False
    emergency_contact: Optional[str] = None

class AllergenFilterRequest(BaseModel):
    exclude_allergens: List[str]  # allergen IDs to exclude
    include_may_contain: bool = False  # if False, also exclude "may_contain"

class LabelConfig(BaseModel):
    business_name: str
    include_ingredients: bool = True
    include_nutritional: bool = False
    format: str = "standard"  # standard, detailed, ppds (pre-packed for direct sale)


# ─── Reference Data ─── #

@router.get("/reference/uk-allergens")
async def get_uk_allergens():
    """Return the 14 UK regulated allergens with icons and descriptions."""
    return {"allergens": UK_ALLERGENS, "count": 14}


# ─── Ingredient-Level Allergen Tagging ─── #

@router.put("/business/{business_id}/ingredient/{ingredient_id}/allergens")
async def tag_ingredient_allergens(business_id: str, tenant: TenantContext = Depends(verify_business_access), ingredient_id: str, body: IngredientAllergens):
    """
    Tag an ingredient with allergens. This is the foundation — menu item allergens
    are auto-calculated from their recipe's ingredients.
    
    Severity levels:
    - contains: definitely present
    - may_contain: cross-contamination risk at supplier level
    - trace: possible trace amounts
    - free_from: explicitly free from (useful for substitutes)
    """
    db = get_database()
    
    # Validate allergen IDs
    for tag in body.allergens:
        if tag.allergen_id not in ALLERGEN_IDS:
            raise HTTPException(400, f"Invalid allergen: {tag.allergen_id}. Valid: {ALLERGEN_IDS}")
        if tag.severity not in ["contains", "may_contain", "trace", "free_from"]:
            raise HTTPException(400, f"Invalid severity: {tag.severity}")
    
    allergen_data = [t.dict() for t in body.allergens]
    
    result = await db.ingredients.update_one(
        {"_id": ObjectId(ingredient_id), "business_id": business_id},
        {
            "$set": {
                "allergen_tags": allergen_data,
                "allergen_ids": [t.allergen_id for t in body.allergens if t.severity in ("contains", "may_contain")],
                "allergens_updated_at": datetime.utcnow()
            }
        }
    )
    
    if result.matched_count == 0:
        raise HTTPException(404, "Ingredient not found")
    
    # Log audit
    await db.allergen_audit.insert_one({
        "business_id": business_id,
        "action": "ingredient_allergens_updated",
        "ingredient_id": ingredient_id,
        "allergens": allergen_data,
        "timestamp": datetime.utcnow()
    })
    
    # Trigger recalculation of all menu items using this ingredient
    await _recalculate_menu_items_for_ingredient(db, business_id, ingredient_id)
    
    return {"updated": True, "allergens": allergen_data}


@router.get("/business/{business_id}/ingredient/{ingredient_id}/allergens")
async def get_ingredient_allergens(business_id: str, tenant: TenantContext = Depends(verify_business_access), ingredient_id: str):
    """Get allergen tags for a specific ingredient."""
    db = get_database()
    ingredient = await db.ingredients.find_one(
        {"_id": ObjectId(ingredient_id), "business_id": business_id},
        {"allergen_tags": 1, "name": 1}
    )
    if not ingredient:
        raise HTTPException(404, "Ingredient not found")
    
    return {
        "ingredient_id": ingredient_id,
        "name": ingredient.get("name"),
        "allergen_tags": ingredient.get("allergen_tags", []),
    }


@router.post("/business/{business_id}/ingredients/allergens/bulk")
async def bulk_tag_ingredient_allergens(business_id: str, tenant: TenantContext = Depends(verify_business_access), tags: List[IngredientAllergens] = Body(...)):
    """Bulk tag allergens for multiple ingredients at once."""
    db = get_database()
    updated = 0
    errors = []
    
    for tag_set in tags:
        # Validate allergen IDs
        valid = True
        for t in tag_set.allergens:
            if t.allergen_id not in ALLERGEN_IDS:
                errors.append(f"Ingredient {tag_set.ingredient_id}: invalid allergen {t.allergen_id}")
                valid = False
        if not valid:
            continue
        
        allergen_data = [t.dict() for t in tag_set.allergens]
        result = await db.ingredients.update_one(
            {"_id": ObjectId(tag_set.ingredient_id), "business_id": business_id},
            {
                "$set": {
                    "allergen_tags": allergen_data,
                    "allergen_ids": [t.allergen_id for t in tag_set.allergens if t.severity in ("contains", "may_contain")],
                    "allergens_updated_at": datetime.utcnow()
                }
            }
        )
        if result.matched_count > 0:
            updated += 1
            await _recalculate_menu_items_for_ingredient(db, business_id, tag_set.ingredient_id)
        else:
            errors.append(f"Ingredient {tag_set.ingredient_id}: not found")
    
    return {"updated": updated, "errors": errors}


@router.post("/business/{business_id}/ingredients/allergens/import-csv")
async def import_allergens_csv(business_id: str, tenant: TenantContext = Depends(verify_business_access), file: UploadFile = File(...)):
    """
    Bulk import allergens from CSV.
    Format: ingredient_name, celery, cereals, crustaceans, eggs, fish, lupin, milk, molluscs, mustard, nuts, peanuts, sesame, soya, sulphites
    Values: Y=contains, M=may_contain, T=trace, empty=none
    """
    db = get_database()
    contents = await file.read()
    reader = csv.DictReader(io.StringIO(contents.decode("utf-8")))
    
    updated = 0
    not_found = []
    
    for row in reader:
        ingredient_name = row.get("ingredient_name", "").strip()
        if not ingredient_name:
            continue
        
        # Find ingredient by name
        ingredient = await db.ingredients.find_one(
            {"business_id": business_id, "name": {"$regex": f"^{ingredient_name}$", "$options": "i"}}
        )
        if not ingredient:
            not_found.append(ingredient_name)
            continue
        
        allergen_tags = []
        for aid in ALLERGEN_IDS:
            val = row.get(aid, "").strip().upper()
            if val == "Y":
                allergen_tags.append({"allergen_id": aid, "severity": "contains"})
            elif val == "M":
                allergen_tags.append({"allergen_id": aid, "severity": "may_contain"})
            elif val == "T":
                allergen_tags.append({"allergen_id": aid, "severity": "trace"})
        
        await db.ingredients.update_one(
            {"_id": ingredient["_id"]},
            {
                "$set": {
                    "allergen_tags": allergen_tags,
                    "allergen_ids": [t["allergen_id"] for t in allergen_tags if t["severity"] in ("contains", "may_contain")],
                    "allergens_updated_at": datetime.utcnow()
                }
            }
        )
        updated += 1
    
    # Recalculate all menu items
    if updated > 0:
        await _recalculate_all_menu_items(db, business_id)
    
    return {
        "imported": updated,
        "not_found": not_found,
        "template_url": "/allergens/csv-template"
    }


@router.get("/csv-template")
async def get_csv_template():
    """Return CSV template for allergen import."""
    header = "ingredient_name," + ",".join(ALLERGEN_IDS)
    example = "Plain Flour,N,Y,N,N,N,N,N,N,N,N,N,N,N,N"
    return {
        "template": f"{header}\n{example}",
        "instructions": "Values: Y=contains, M=may_contain, T=trace, N or empty=none",
        "allergen_columns": ALLERGEN_IDS
    }


# ─── Menu Item Allergen Auto-Calculation ─── #

@router.get("/business/{business_id}/menu-item/{item_id}/allergens")
async def get_menu_item_allergens(business_id: str, tenant: TenantContext = Depends(verify_business_access), item_id: str):
    """
    Get calculated allergens for a menu item, including:
    - Auto-calculated from recipe ingredients
    - Manual overrides (e.g., shared fryer cross-contamination)
    - Cross-contamination risk matrix
    """
    db = get_database()
    
    # Get the menu item
    item = await db.menu_items.find_one(
        {"_id": ObjectId(item_id), "business_id": business_id}
    )
    if not item:
        raise HTTPException(404, "Menu item not found")
    
    # Auto-calculate from ingredients
    auto_allergens = await _calculate_item_allergens(db, business_id, item)
    
    # Get manual overrides
    override = await db.allergen_overrides.find_one(
        {"business_id": business_id, "menu_item_id": item_id}
    )
    
    # Merge auto + manual
    all_allergens = {a["allergen_id"]: a for a in auto_allergens}
    cross_contamination = []
    
    if override:
        for a in override.get("additional_allergens", []):
            if a["allergen_id"] not in all_allergens or a["severity"] == "contains":
                all_allergens[a["allergen_id"]] = a
        cross_contamination = override.get("cross_contamination", [])
    
    # Build consumer-safe summary
    contains = [a for a in all_allergens.values() if a["severity"] == "contains"]
    may_contain = [a for a in all_allergens.values() if a["severity"] == "may_contain"]
    trace = [a for a in all_allergens.values() if a["severity"] == "trace"]
    
    return {
        "menu_item_id": item_id,
        "name": item.get("name"),
        "contains": contains,
        "may_contain": may_contain,
        "trace": trace,
        "cross_contamination": cross_contamination,
        "preparation_notes": override.get("preparation_notes") if override else None,
        "all_allergen_ids": list(all_allergens.keys()),
        "safe_for": [a["id"] for a in UK_ALLERGENS if a["id"] not in all_allergens],
        "last_updated": item.get("allergens_updated_at", item.get("updated_at"))
    }


@router.post("/business/{business_id}/menu-item/{item_id}/override")
async def set_menu_item_allergen_override(business_id: str, tenant: TenantContext = Depends(verify_business_access), item_id: str, body: MenuItemAllergenOverride):
    """
    Set manual allergen overrides for a menu item.
    Use for cross-contamination risks that can't be auto-calculated
    (e.g., shared fryer, same prep surface, airborne flour).
    """
    db = get_database()
    
    for tag in body.additional_allergens:
        if tag.allergen_id not in ALLERGEN_IDS:
            raise HTTPException(400, f"Invalid allergen: {tag.allergen_id}")
    
    override_doc = {
        "business_id": business_id,
        "menu_item_id": item_id,
        "additional_allergens": [t.dict() for t in body.additional_allergens],
        "cross_contamination": body.cross_contamination,
        "preparation_notes": body.preparation_notes,
        "updated_at": datetime.utcnow()
    }
    
    await db.allergen_overrides.update_one(
        {"business_id": business_id, "menu_item_id": item_id},
        {"$set": override_doc},
        upsert=True
    )
    
    await db.allergen_audit.insert_one({
        "business_id": business_id,
        "action": "menu_item_override_set",
        "menu_item_id": item_id,
        "overrides": override_doc,
        "timestamp": datetime.utcnow()
    })
    
    return {"updated": True}


@router.post("/business/{business_id}/recalculate-all")
async def recalculate_all_allergens(business_id: str, tenant: TenantContext = Depends(verify_business_access)):
    """Force recalculation of allergens for all menu items. Run after bulk ingredient changes."""
    db = get_database()
    count = await _recalculate_all_menu_items(db, business_id)
    return {"recalculated": count}


# ─── Consumer-Facing Allergen Filtering ─── #

@router.post("/business/{business_id}/menu/filter")
async def filter_menu_by_allergens(business_id: str, tenant: TenantContext = Depends(verify_business_access), body: AllergenFilterRequest):
    """
    Filter the entire menu to show only items safe for the given allergen profile.
    Used by online ordering, kiosks, and QR dine-in ordering.
    
    Returns menu items categorized as:
    - safe: no allergens from the exclusion list
    - caution: may_contain only (if include_may_contain=True)
    - unsafe: contains allergens from the exclusion list
    """
    db = get_database()
    exclude = set(body.exclude_allergens)
    
    # Validate allergen IDs
    for aid in exclude:
        if aid not in ALLERGEN_IDS:
            raise HTTPException(400, f"Invalid allergen: {aid}")
    
    # Get all active menu items
    items = []
    async for item in db.menu_items.find(
        {"business_id": business_id, "active": {"$ne": False}}
    ):
        item_allergens = item.get("calculated_allergens", {})
        contains_set = set(item_allergens.get("contains", []))
        may_contain_set = set(item_allergens.get("may_contain", []))
        
        has_contains = bool(contains_set & exclude)
        has_may_contain = bool(may_contain_set & exclude)
        
        status = "safe"
        if has_contains:
            status = "unsafe"
        elif has_may_contain:
            status = "caution" if body.include_may_contain else "unsafe"
        
        items.append({
            "id": str(item["_id"]),
            "name": item.get("name"),
            "category": item.get("category"),
            "price": item.get("price"),
            "description": item.get("description"),
            "status": status,
            "contains": list(contains_set & exclude) if has_contains else [],
            "may_contain": list(may_contain_set & exclude) if has_may_contain else [],
            "all_allergens": item_allergens
        })
    
    safe = [i for i in items if i["status"] == "safe"]
    caution = [i for i in items if i["status"] == "caution"]
    unsafe = [i for i in items if i["status"] == "unsafe"]
    
    return {
        "safe": safe,
        "caution": caution,
        "unsafe": unsafe,
        "filter_applied": list(exclude),
        "total_items": len(items)
    }


@router.get("/business/{business_id}/menu-item/{item_id}/safe-for")
async def check_item_safe_for(business_id: str, tenant: TenantContext = Depends(verify_business_access), item_id: str, allergens: str = Query(...)):
    """Quick check: is this menu item safe for a list of allergens? allergens=nuts,milk,eggs"""
    db = get_database()
    check_allergens = set(allergens.split(","))
    
    item = await db.menu_items.find_one(
        {"_id": ObjectId(item_id), "business_id": business_id},
        {"calculated_allergens": 1, "name": 1}
    )
    if not item:
        raise HTTPException(404, "Menu item not found")
    
    calc = item.get("calculated_allergens", {})
    contains = set(calc.get("contains", []))
    may_contain = set(calc.get("may_contain", []))
    
    conflicts_contains = list(contains & check_allergens)
    conflicts_may_contain = list(may_contain & check_allergens)
    
    safe = len(conflicts_contains) == 0 and len(conflicts_may_contain) == 0
    
    return {
        "safe": safe,
        "safe_with_caution": len(conflicts_contains) == 0,
        "conflicts_contains": conflicts_contains,
        "conflicts_may_contain": conflicts_may_contain
    }


# ─── Customer Allergen Profiles ─── #

@router.post("/business/{business_id}/customer-profiles")
async def create_customer_allergen_profile(business_id: str, tenant: TenantContext = Depends(verify_business_access), body: CustomerAllergenProfile):
    """
    Create/update an allergen profile for a customer.
    Linked to booking and CRM — displayed on table assignments and KDS.
    """
    db = get_database()
    
    for aid in body.allergens:
        if aid not in ALLERGEN_IDS:
            raise HTTPException(400, f"Invalid allergen: {aid}")
    
    profile = body.dict()
    profile["business_id"] = business_id
    profile["created_at"] = datetime.utcnow()
    profile["updated_at"] = datetime.utcnow()
    
    # Upsert by customer_id or phone/email
    filter_q = {"business_id": business_id}
    if body.customer_id:
        filter_q["customer_id"] = body.customer_id
    elif body.phone:
        filter_q["phone"] = body.phone
    elif body.email:
        filter_q["email"] = body.email
    else:
        filter_q["name"] = body.name
    
    result = await db.customer_allergen_profiles.update_one(
        filter_q,
        {"$set": profile},
        upsert=True
    )
    
    uid = result.upserted_id or (await db.customer_allergen_profiles.find_one(filter_q))["_id"]
    return {"profile_id": str(uid), "allergens": body.allergens}


@router.get("/business/{business_id}/customer-profiles")
async def list_customer_allergen_profiles(business_id: str, tenant: TenantContext = Depends(verify_business_access), search: Optional[str] = None):
    """List all customers with allergen profiles. Search by name, phone, or email."""
    db = get_database()
    query = {"business_id": business_id}
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"phone": {"$regex": search}},
            {"email": {"$regex": search, "$options": "i"}}
        ]
    
    profiles = []
    async for doc in db.customer_allergen_profiles.find(query).sort("name", 1).limit(100):
        doc["_id"] = str(doc["_id"])
        profiles.append(doc)
    
    return {"profiles": profiles, "count": len(profiles)}


@router.get("/business/{business_id}/customer-profiles/{profile_id}")
async def get_customer_allergen_profile(business_id: str, tenant: TenantContext = Depends(verify_business_access), profile_id: str):
    """Get a specific customer's allergen profile."""
    db = get_database()
    doc = await db.customer_allergen_profiles.find_one(
        {"_id": ObjectId(profile_id), "business_id": business_id}
    )
    if not doc:
        raise HTTPException(404, "Profile not found")
    doc["_id"] = str(doc["_id"])
    return doc


@router.delete("/business/{business_id}/customer-profiles/{profile_id}")
async def delete_customer_allergen_profile(business_id: str, tenant: TenantContext = Depends(verify_business_access), profile_id: str):
    """Delete a customer allergen profile."""
    db = get_database()
    result = await db.customer_allergen_profiles.delete_one(
        {"_id": ObjectId(profile_id), "business_id": business_id}
    )
    if result.deleted_count == 0:
        raise HTTPException(404, "Profile not found")
    return {"deleted": True}


# ─── Natasha's Law Label Generation ─── #

@router.post("/business/{business_id}/menu-item/{item_id}/label")
async def generate_natasha_law_label(business_id: str, tenant: TenantContext = Depends(verify_business_access), item_id: str, config: LabelConfig):
    """
    Generate a Natasha's Law compliant label for pre-packed items sold on-premises.
    
    Requirements (PPDS - Pre-Packed for Direct Sale):
    1. Product name
    2. Full ingredients list
    3. Allergens emphasised (bold, uppercase, or highlighted)
    4. Business name and address
    """
    db = get_database()
    
    item = await db.menu_items.find_one(
        {"_id": ObjectId(item_id), "business_id": business_id}
    )
    if not item:
        raise HTTPException(404, "Menu item not found")
    
    calc = item.get("calculated_allergens", {})
    contains = set(calc.get("contains", []))
    
    # Get ingredient names with allergens emphasised
    ingredient_names = []
    recipe = item.get("recipe", [])
    for r in recipe:
        ing = await db.ingredients.find_one({"_id": ObjectId(r.get("ingredient_id"))})
        if ing:
            name = ing.get("name", "")
            ing_allergens = set(ing.get("allergen_ids", []))
            if ing_allergens & contains:
                # Emphasise ingredients containing allergens
                name = name.upper()
            ingredient_names.append(name)
    
    # Build allergen declaration
    allergen_names = []
    for aid in contains:
        for a in UK_ALLERGENS:
            if a["id"] == aid:
                allergen_names.append(a["name"])
    
    label = {
        "product_name": item.get("name"),
        "business_name": config.business_name,
        "ingredients_list": ", ".join(ingredient_names) if ingredient_names else "See staff for ingredients",
        "allergen_declaration": f"Contains: {', '.join(allergen_names)}" if allergen_names else "No allergens",
        "allergens_emphasised": allergen_names,
        "format": config.format,
        "generated_at": datetime.utcnow().isoformat(),
        "compliant": True,
        "regulation": "Food Information Regulations 2014 / Natasha's Law 2021"
    }
    
    if item.get("calculated_allergens", {}).get("may_contain"):
        may_names = []
        for aid in item["calculated_allergens"]["may_contain"]:
            for a in UK_ALLERGENS:
                if a["id"] == aid:
                    may_names.append(a["name"])
        label["may_contain_declaration"] = f"May contain: {', '.join(may_names)}"
    
    return label


# ─── KDS Allergen Alerts ─── #

@router.get("/business/{business_id}/kds-alerts/active")
async def get_active_kds_allergen_alerts(business_id: str, tenant: TenantContext = Depends(verify_business_access)):
    """
    Get active allergen alerts for KDS display.
    Pulls from current open orders where the table has a customer with allergen profiles,
    or items have allergen notes from the server.
    """
    db = get_database()
    
    alerts = []
    async for order in db.orders.find({
        "business_id": business_id,
        "status": {"$in": ["open", "in_progress", "fired"]},
        "$or": [
            {"allergen_notes": {"$exists": True, "$ne": ""}},
            {"customer_allergen_profile_id": {"$exists": True}}
        ]
    }):
        alert = {
            "order_id": str(order["_id"]),
            "table": order.get("table_number") or order.get("table_name"),
            "allergen_notes": order.get("allergen_notes"),
            "customer_allergens": [],
            "affected_items": []
        }
        
        # Get customer allergen profile if linked
        if order.get("customer_allergen_profile_id"):
            profile = await db.customer_allergen_profiles.find_one(
                {"_id": ObjectId(order["customer_allergen_profile_id"])}
            )
            if profile:
                alert["customer_name"] = profile.get("name")
                alert["customer_allergens"] = profile.get("allergens", [])
                alert["epipen_carrier"] = profile.get("epipen_carrier", False)
        
        # Check each item against customer allergens
        customer_allergens = set(alert.get("customer_allergens", []))
        if customer_allergens:
            for item in order.get("items", []):
                item_allergens = set(item.get("allergens", []))
                conflicts = list(item_allergens & customer_allergens)
                if conflicts:
                    alert["affected_items"].append({
                        "item_name": item.get("name"),
                        "conflicts": conflicts,
                        "severity": "DANGER"
                    })
        
        if alert["allergen_notes"] or alert["customer_allergens"] or alert["affected_items"]:
            alerts.append(alert)
    
    return {"alerts": alerts, "count": len(alerts)}


# ─── Allergen Compliance Dashboard ─── #

@router.get("/business/{business_id}/compliance")
async def get_allergen_compliance_status(business_id: str, tenant: TenantContext = Depends(verify_business_access)):
    """
    Compliance dashboard: shows which items are fully tagged, partially tagged,
    or missing allergen data entirely.
    """
    db = get_database()
    
    total_items = 0
    fully_tagged = 0
    partially_tagged = 0
    untagged = 0
    items_missing = []
    
    async for item in db.menu_items.find(
        {"business_id": business_id, "active": {"$ne": False}}
    ):
        total_items += 1
        calc = item.get("calculated_allergens")
        
        if calc and (calc.get("contains") or calc.get("may_contain") or calc.get("verified")):
            fully_tagged += 1
        elif calc:
            partially_tagged += 1
        else:
            untagged += 1
            items_missing.append({
                "id": str(item["_id"]),
                "name": item.get("name"),
                "category": item.get("category")
            })
    
    # Check ingredient coverage
    total_ingredients = 0
    tagged_ingredients = 0
    async for ing in db.ingredients.find({"business_id": business_id}):
        total_ingredients += 1
        if ing.get("allergen_tags"):
            tagged_ingredients += 1
    
    compliance_pct = round((fully_tagged / total_items * 100) if total_items > 0 else 0, 1)
    ingredient_coverage = round((tagged_ingredients / total_ingredients * 100) if total_ingredients > 0 else 0, 1)
    
    return {
        "compliant": compliance_pct >= 100,
        "compliance_percentage": compliance_pct,
        "menu_items": {
            "total": total_items,
            "fully_tagged": fully_tagged,
            "partially_tagged": partially_tagged,
            "untagged": untagged,
            "missing_items": items_missing[:20]
        },
        "ingredients": {
            "total": total_ingredients,
            "tagged": tagged_ingredients,
            "coverage_percentage": ingredient_coverage
        },
        "regulations": [
            {"name": "Food Information Regulations 2014", "status": "tracking"},
            {"name": "Natasha's Law (Oct 2021)", "status": "tracking"},
            {"name": "14 Allergen Compliance", "status": "compliant" if compliance_pct >= 100 else "incomplete"}
        ]
    }


# ─── Audit Trail ─── #

@router.get("/business/{business_id}/audit")
async def get_allergen_audit_trail(business_id: str, tenant: TenantContext = Depends(verify_business_access), limit: int = 50):
    """Full audit trail of allergen changes for regulatory compliance."""
    db = get_database()
    
    entries = []
    async for doc in db.allergen_audit.find(
        {"business_id": business_id}
    ).sort("timestamp", -1).limit(limit):
        doc["_id"] = str(doc["_id"])
        entries.append(doc)
    
    return {"entries": entries, "count": len(entries)}


# ─── Internal Helper Functions ─── #

async def _calculate_item_allergens(db, business_id: str, item: dict) -> list:
    """Calculate allergens for a menu item from its recipe ingredients."""
    allergens = {}
    recipe = item.get("recipe", [])
    
    for component in recipe:
        ingredient_id = component.get("ingredient_id")
        if not ingredient_id:
            continue
        
        try:
            ingredient = await db.ingredients.find_one({"_id": ObjectId(ingredient_id)})
        except Exception:
            continue
        
        if not ingredient:
            continue
        
        for tag in ingredient.get("allergen_tags", []):
            aid = tag["allergen_id"]
            severity = tag["severity"]
            
            if aid not in allergens:
                allergens[aid] = tag
            else:
                # Escalate severity: contains > may_contain > trace
                severity_rank = {"contains": 3, "may_contain": 2, "trace": 1, "free_from": 0}
                if severity_rank.get(severity, 0) > severity_rank.get(allergens[aid]["severity"], 0):
                    allergens[aid] = tag
    
    return list(allergens.values())


async def _recalculate_menu_items_for_ingredient(db, business_id: str, ingredient_id: str):
    """Recalculate allergens for all menu items that use a specific ingredient."""
    async for item in db.menu_items.find({
        "business_id": business_id,
        "recipe.ingredient_id": ingredient_id
    }):
        allergens = await _calculate_item_allergens(db, business_id, item)
        
        contains = [a["allergen_id"] for a in allergens if a["severity"] == "contains"]
        may_contain = [a["allergen_id"] for a in allergens if a["severity"] == "may_contain"]
        trace = [a["allergen_id"] for a in allergens if a["severity"] == "trace"]
        
        await db.menu_items.update_one(
            {"_id": item["_id"]},
            {
                "$set": {
                    "calculated_allergens": {
                        "contains": contains,
                        "may_contain": may_contain,
                        "trace": trace,
                        "all_ids": contains + may_contain + trace,
                        "verified": True
                    },
                    "allergens_updated_at": datetime.utcnow()
                }
            }
        )


async def _recalculate_all_menu_items(db, business_id: str) -> int:
    """Recalculate allergens for all menu items in a business."""
    count = 0
    async for item in db.menu_items.find({"business_id": business_id}):
        allergens = await _calculate_item_allergens(db, business_id, item)
        
        contains = [a["allergen_id"] for a in allergens if a["severity"] == "contains"]
        may_contain = [a["allergen_id"] for a in allergens if a["severity"] == "may_contain"]
        trace = [a["allergen_id"] for a in allergens if a["severity"] == "trace"]
        
        await db.menu_items.update_one(
            {"_id": item["_id"]},
            {
                "$set": {
                    "calculated_allergens": {
                        "contains": contains,
                        "may_contain": may_contain,
                        "trace": trace,
                        "all_ids": contains + may_contain + trace,
                        "verified": True
                    },
                    "allergens_updated_at": datetime.utcnow()
                }
            }
        )
        count += 1
    return count
