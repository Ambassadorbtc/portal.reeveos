"""
Library / Knowledge Base — /admin/library
Stores all project research, chat transcripts, decisions, code summaries.
Auto-populate endpoint ready for the chrome extension to POST into.
"""
from fastapi import Depends, APIRouter, HTTPException, UploadFile, File, Query
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from bson import ObjectId
import json
import re
import logging

import database
from middleware.tenant import set_user_tenant_context, TenantContext

router = APIRouter(prefix="/admin/library", tags=["library"])
logger = logging.getLogger("library")

CATEGORIES = [
    "research", "design", "decision", "code-summary", "competitor",
    "meeting-note", "specification", "iteration", "chat-transcript",
    "strategy", "bug-fix", "feature-request", "architecture", "brand",
]

STATUSES = ["current", "superseded", "archived"]


def _ser(doc):
    """Serialise a MongoDB doc for JSON response."""
    if not doc:
        return None
    doc["id"] = str(doc.pop("_id"))
    for k in ("created_at", "updated_at"):
        if k in doc and isinstance(doc[k], datetime):
            doc[k] = doc[k].isoformat()
    return doc


# ─── Models ────────────────────────────────────────────────

class DocumentCreate(BaseModel):
    title: str
    category: str = "research"
    tags: List[str] = []
    content: str = ""
    status: str = "current"
    source: str = "manual"
    related_ids: List[str] = []
    metadata: dict = Field(default_factory=dict)


class DocumentUpdate(BaseModel):
    title: Optional[str] = None
    category: Optional[str] = None
    tags: Optional[List[str]] = None
    content: Optional[str] = None
    status: Optional[str] = None
    source: Optional[str] = None
    related_ids: Optional[List[str]] = None
    metadata: Optional[dict] = None


class ChatImport(BaseModel):
    """For importing exported chat JSON from AI Chat Exporter or the future chrome extension."""
    messages: List[dict]
    title: Optional[str] = "Untitled Chat"
    source_platform: str = "claude"
    chat_date: Optional[str] = None
    tags: List[str] = []
    auto_tag: bool = True


class BulkAutoPopulate(BaseModel):
    """For the chrome extension to auto-populate the library."""
    conversations: List[dict]
    source_platform: str = "claude"
    auto_tag: bool = True


# ─── Ensure indexes ───────────────────────────────────────

async def _ensure_indexes():
    db = database.db
    col = db["library"]
    await col.create_index([("title", "text"), ("content", "text"), ("tags", "text")])
    await col.create_index("category")
    await col.create_index("status")
    await col.create_index("tags")
    await col.create_index("created_at")
    await col.create_index("source")


# ─── AUTO-TAGGING ─────────────────────────────────────────

TAG_PATTERNS = {
    "booking-flow": r"booking|reservation|book\s",
    "epos": r"epos|point.of.sale|till|pos\b",
    "stripe": r"stripe|payment|deposit|connect",
    "dojo": r"dojo|terminal|card.machine",
    "uber-direct": r"uber.direct|delivery|dispatch",
    "floor-plan": r"floor.plan|table.layout|drag.and.drop",
    "crm": r"crm|guest.profile|client|customer.data",
    "brand": r"brand|rebrand|logo|figtree|colour|color.palette",
    "seo": r"\bseo\b|search.engine|google.places|schema.markup",
    "burg-burgers": r"burg.burger",
    "micho": r"micho|sadkine|turkish.restaurant",
    "mobile-app": r"mobile.app|react.native|expo|pwa",
    "admin-panel": r"admin.panel|command.centre|founder.admin",
    "onboarding": r"onboarding|signup|registration",
    "calendar": r"calendar|timeline|table.status",
    "competitor": r"opentable|resdiary|thefork|epos.now|deliveroo|just.eat",
    "uber-eats": r"uber.eats|just.eat|deliveroo",
    "growth-engine": r"growth.engine|warm.lead|notify.me|pre.populate",
    "design": r"uxpilot|figma|design.studio|wireframe",
    "notifications": r"notification|email|sms|sendly",
    "reeve": r"reeve|reeveos|reeve.now",
    "convenience-store": r"convenience|corner.shop|snappy.shopper",
}


def auto_tag(text: str) -> List[str]:
    """Extract tags from text content using pattern matching."""
    text_lower = text.lower()
    found = []
    for tag, pattern in TAG_PATTERNS.items():
        if re.search(pattern, text_lower):
            found.append(tag)
    return found


def guess_category(text: str) -> str:
    """Guess category from content."""
    text_lower = text.lower()
    if re.search(r"decided|decision|agreed|locked.in|confirmed", text_lower):
        return "decision"
    if re.search(r"bug|fix|error|crash|500|404", text_lower):
        return "bug-fix"
    if re.search(r"competitor|vs\b|comparison|opentable|resdiary", text_lower):
        return "competitor"
    if re.search(r"design|uxpilot|figma|wireframe|mockup", text_lower):
        return "design"
    if re.search(r"spec|specification|requirement|architecture", text_lower):
        return "specification"
    if re.search(r"strategy|growth|business.model|pricing", text_lower):
        return "strategy"
    if re.search(r"brand|logo|colour|font|figtree|rebrand", text_lower):
        return "brand"
    return "chat-transcript"


# ─── ENDPOINTS ─────────────────────────────────────────────

@router.on_event("startup")
async def startup():
    await _ensure_indexes()


@router.get("/documents")
async def list_documents(
    category: Optional[str] = None,
    status: Optional[str] = None,
    tag: Optional[str] = None,
    source: Optional[str] = None,
    q: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    sort: str = "newest",
):
    """Browse all documents with optional filters."""
    db = database.db
    col = db["library"]

    query = {}
    if category:
        query["category"] = category
    if status:
        query["status"] = status
    if tag:
        query["tags"] = tag
    if source:
        query["source"] = source

    sort_field = [("created_at", -1)]
    if sort == "oldest":
        sort_field = [("created_at", 1)]
    elif sort == "updated":
        sort_field = [("updated_at", -1)]
    elif sort == "alpha":
        sort_field = [("title", 1)]

    # Try text search first, fall back to regex if index missing
    if q:
        try:
            query["$text"] = {"$search": q}
            total = await col.count_documents(query)
        except Exception:
            del query["$text"]
            pattern = {"$regex": q, "$options": "i"}
            query["$or"] = [{"title": pattern}, {"content": pattern}, {"tags": pattern}]
            total = await col.count_documents(query)
    else:
        total = await col.count_documents(query)
    cursor = col.find(query).sort(sort_field).skip(skip).limit(limit)
    docs = [_ser(d) async for d in cursor]

    return {"documents": docs, "total": total, "skip": skip, "limit": limit}


@router.get("/documents/{doc_id}")
async def get_document(doc_id: str):
    """Get full document by ID."""
    db = database.db
    doc = await db["library"].find_one({"_id": ObjectId(doc_id)})
    if not doc:
        raise HTTPException(404, "Document not found")
    return _ser(doc)


@router.post("/documents")
async def create_document(data: DocumentCreate):
    """Create a new library document."""
    db = database.db
    now = datetime.utcnow()
    doc = {
        "title": data.title,
        "category": data.category,
        "tags": data.tags,
        "content": data.content,
        "status": data.status,
        "source": data.source,
        "related_ids": data.related_ids,
        "metadata": data.metadata,
        "created_at": now,
        "updated_at": now,
    }
    result = await db["library"].insert_one(doc)
    doc["_id"] = result.inserted_id
    return _ser(doc)


@router.put("/documents/{doc_id}")
async def update_document(doc_id: str, data: DocumentUpdate):
    """Update an existing document."""
    db = database.db
    updates = {k: v for k, v in data.dict().items() if v is not None}
    if not updates:
        raise HTTPException(400, "No updates provided")
    updates["updated_at"] = datetime.utcnow()

    result = await db["library"].find_one_and_update(
        {"_id": ObjectId(doc_id)},
        {"$set": updates},
        return_document=True,
    )
    if not result:
        raise HTTPException(404, "Document not found")
    return _ser(result)


@router.delete("/documents/{doc_id}")
async def delete_document(doc_id: str):
    """Delete a document."""
    db = database.db
    result = await db["library"].delete_one({"_id": ObjectId(doc_id)})
    if result.deleted_count == 0:
        raise HTTPException(404, "Document not found")
    return {"deleted": True}


@router.get("/categories")
async def list_categories():
    """List all categories with counts."""
    db = database.db
    pipeline = [
        {"$group": {"_id": "$category", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
    ]
    results = await db["library"].aggregate(pipeline).to_list(100)
    return {"categories": [{"name": r["_id"], "count": r["count"]} for r in results]}


@router.get("/tags")
async def list_tags():
    """List all tags with counts."""
    db = database.db
    pipeline = [
        {"$unwind": "$tags"},
        {"$group": {"_id": "$tags", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
    ]
    results = await db["library"].aggregate(pipeline).to_list(200)
    return {"tags": [{"name": r["_id"], "count": r["count"]} for r in results]}


@router.get("/search")
async def search_library(q: str, limit: int = 20):
    """Full-text search across all documents."""
    db = database.db
    try:
        query = {"$text": {"$search": q}}
        cursor = db["library"].find(
            query,
            {"score": {"$meta": "textScore"}},
        ).sort([("score", {"$meta": "textScore"})]).limit(limit)
        docs = [_ser(d) async for d in cursor]
    except Exception:
        # Fallback to regex search if text index not available
        pattern = {"$regex": q, "$options": "i"}
        query = {"$or": [{"title": pattern}, {"content": pattern}, {"tags": pattern}]}
        cursor = db["library"].find(query).sort("created_at", -1).limit(limit)
        docs = [_ser(d) async for d in cursor]
    return {"results": docs, "query": q}


@router.get("/stats")
async def library_stats():
    """Dashboard stats for the library."""
    db = database.db
    col = db["library"]
    total = await col.count_documents({})
    by_category = await col.aggregate([
        {"$group": {"_id": "$category", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
    ]).to_list(50)
    by_source = await col.aggregate([
        {"$group": {"_id": "$source", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
    ]).to_list(50)
    by_status = await col.aggregate([
        {"$group": {"_id": "$status", "count": {"$sum": 1}}},
    ]).to_list(10)
    recent = await col.find().sort("created_at", -1).limit(5).to_list(5)

    return {
        "total": total,
        "by_category": [{"name": r["_id"] or "uncategorized", "count": r["count"]} for r in by_category],
        "by_source": [{"name": r["_id"] or "unknown", "count": r["count"]} for r in by_source],
        "by_status": [{"name": r["_id"] or "current", "count": r["count"]} for r in by_status],
        "recent": [_ser(d) for d in recent],
    }


# ─── CHAT IMPORT ──────────────────────────────────────────

@router.post("/import/chat")
async def import_chat(data: ChatImport):
    """
    Import a single chat transcript.
    Accepts JSON format from AI Chat Exporter chrome extension.
    """
    db = database.db
    now = datetime.utcnow()

    # Build full transcript text
    lines = []
    for msg in data.messages:
        role = msg.get("role", msg.get("sender", "unknown"))
        text = msg.get("content", msg.get("text", ""))
        if isinstance(text, list):
            # Handle structured content blocks
            text = " ".join(
                block.get("text", "") for block in text
                if isinstance(block, dict) and block.get("type") == "text"
            )
        lines.append(f"**{role.upper()}:** {text}")

    full_content = "\n\n".join(lines)

    # Auto-tag if requested
    tags = list(data.tags)
    if data.auto_tag:
        tags = list(set(tags + auto_tag(full_content)))

    category = guess_category(full_content) if not data.tags else "chat-transcript"

    doc = {
        "title": data.title,
        "category": category,
        "tags": tags,
        "content": full_content,
        "status": "current",
        "source": f"chat-import-{data.source_platform}",
        "related_ids": [],
        "metadata": {
            "platform": data.source_platform,
            "message_count": len(data.messages),
            "chat_date": data.chat_date,
            "imported_at": now.isoformat(),
        },
        "created_at": datetime.fromisoformat(data.chat_date) if data.chat_date else now,
        "updated_at": now,
    }

    result = await db["library"].insert_one(doc)
    doc["_id"] = result.inserted_id
    return _ser(doc)


@router.post("/import/file")
async def import_file(file: UploadFile = File(...)):
    """
    Import a JSON or Markdown file.
    JSON: expects AI Chat Exporter format with messages array.
    MD/TXT: stores raw content as a document.
    """
    db = database.db
    now = datetime.utcnow()
    raw = await file.read()

    filename = file.filename or "uploaded_file"
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""

    if ext == "json":
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            raise HTTPException(400, "Invalid JSON file")

        # Could be a single chat or array of chats
        chats = data if isinstance(data, list) else [data]
        imported = []

        for chat in chats:
            messages = chat.get("messages", chat.get("conversation", []))
            title = chat.get("title", chat.get("name", filename))
            chat_date = chat.get("created_at", chat.get("date", None))

            lines = []
            for msg in messages:
                role = msg.get("role", msg.get("sender", "unknown"))
                text = msg.get("content", msg.get("text", ""))
                if isinstance(text, list):
                    text = " ".join(
                        block.get("text", "") for block in text
                        if isinstance(block, dict) and block.get("type") == "text"
                    )
                lines.append(f"**{role.upper()}:** {text}")

            full_content = "\n\n".join(lines)
            tags = auto_tag(full_content)

            doc = {
                "title": title,
                "category": guess_category(full_content),
                "tags": tags,
                "content": full_content,
                "status": "current",
                "source": "file-import",
                "related_ids": [],
                "metadata": {
                    "filename": filename,
                    "message_count": len(messages),
                    "chat_date": chat_date,
                    "imported_at": now.isoformat(),
                },
                "created_at": datetime.fromisoformat(chat_date) if chat_date else now,
                "updated_at": now,
            }
            result = await db["library"].insert_one(doc)
            doc["_id"] = result.inserted_id
            imported.append(_ser(doc))

        return {"imported": len(imported), "documents": imported}

    elif ext in ("md", "txt", "text"):
        content = raw.decode("utf-8", errors="replace")
        tags = auto_tag(content)

        doc = {
            "title": filename,
            "category": guess_category(content),
            "tags": tags,
            "content": content,
            "status": "current",
            "source": "file-import",
            "related_ids": [],
            "metadata": {"filename": filename, "imported_at": now.isoformat()},
            "created_at": now,
            "updated_at": now,
        }
        result = await db["library"].insert_one(doc)
        doc["_id"] = result.inserted_id
        return {"imported": 1, "documents": [_ser(doc)]}

    else:
        raise HTTPException(400, f"Unsupported file type: .{ext}. Use .json, .md, or .txt")


# ─── AUTO-POPULATE API (for chrome extension) ─────────────

@router.post("/auto-populate")
async def auto_populate(data: BulkAutoPopulate):
    """
    Bulk import endpoint for the chrome extension.
    Accepts an array of conversations and stores them all.
    Returns count of imported documents.
    """
    db = database.db
    now = datetime.utcnow()
    imported = []

    for convo in data.conversations:
        messages = convo.get("messages", convo.get("conversation", []))
        title = convo.get("title", convo.get("name", "Untitled"))
        chat_date = convo.get("created_at", convo.get("date", None))
        chat_url = convo.get("url", convo.get("chat_url", ""))

        lines = []
        for msg in messages:
            role = msg.get("role", msg.get("sender", "unknown"))
            text = msg.get("content", msg.get("text", ""))
            if isinstance(text, list):
                text = " ".join(
                    block.get("text", "") for block in text
                    if isinstance(block, dict) and block.get("type") == "text"
                )
            lines.append(f"**{role.upper()}:** {text}")

        full_content = "\n\n".join(lines)
        tags = auto_tag(full_content) if data.auto_tag else []

        doc = {
            "title": title,
            "category": guess_category(full_content),
            "tags": tags,
            "content": full_content,
            "status": "current",
            "source": f"auto-populate-{data.source_platform}",
            "related_ids": [],
            "metadata": {
                "platform": data.source_platform,
                "message_count": len(messages),
                "chat_date": chat_date,
                "chat_url": chat_url,
                "imported_at": now.isoformat(),
            },
            "created_at": datetime.fromisoformat(chat_date) if chat_date else now,
            "updated_at": now,
        }
        result = await db["library"].insert_one(doc)
        doc["_id"] = result.inserted_id
        imported.append(_ser(doc))

    return {
        "imported": len(imported),
        "documents": imported,
        "message": f"Successfully imported {len(imported)} conversations",
    }
