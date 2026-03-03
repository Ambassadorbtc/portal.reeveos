from fastapi import APIRouter, HTTPException, status, Query, Header, Depends
from database import get_database
from middleware.auth import get_current_owner, get_current_staff
from models.support import (
    ConversationCreate,
    ConversationUpdate,
    ConversationResponse,
    TicketStatus,
    MessageRole,
    SupportMessageCreate,
    SupportMessage,
    AnalyticsResponse,
    TopQuestion,
    DailyConversations
)
from datetime import datetime, timedelta
from typing import List, Optional
from bson import ObjectId
import re
from collections import Counter
from middleware.tenant import verify_business_access, set_user_tenant_context, TenantContext

router = APIRouter(prefix="/api/support", tags=["support"])


def calculate_cost_microcents(input_tokens: int, output_tokens: int) -> int:
    """
    Calculate cost in micro-cents (1/1,000,000 of a USD).
    Claude Haiku pricing: $1 per 1M input tokens, $5 per 1M output tokens
    """
    input_cost = input_tokens * 1
    output_cost = output_tokens * 5
    return input_cost + output_cost


@router.post("/conversations", response_model=ConversationResponse, status_code=status.HTTP_201_CREATED)
async def start_conversation(
    data: ConversationCreate,
    tenant: TenantContext = Depends(set_user_tenant_context),
    user_agent: Optional[str] = Header(None)
):
    """Start a new support conversation (creates a support ticket)."""
    db = get_database()
    
    conversation = {
        "source": data.source.value,
        "page_url": data.page_url,
        "user_agent": data.user_agent or user_agent,
        "user_id": data.user_id,
        "business_id": data.business_id,
        "status": TicketStatus.AUTO_RESOLVED.value,
        "escalated": False,
        "escalation_reason": None,
        "summary": None,
        "message_count": 0,
        "total_input_tokens": 0,
        "total_output_tokens": 0,
        "estimated_cost_usd": 0,
        "assigned_to": None,
        "notes": None,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
        "closed_at": None
    }
    
    result = await db.support_conversations.insert_one(conversation)
    conversation["_id"] = str(result.inserted_id)
    
    return ConversationResponse(
        id=conversation["_id"],
        source=conversation["source"],
        page_url=conversation.get("page_url"),
        user_agent=conversation.get("user_agent"),
        user_id=conversation.get("user_id"),
        business_id=conversation.get("business_id"),
        status=conversation["status"],
        escalated=conversation["escalated"],
        escalation_reason=conversation.get("escalation_reason"),
        summary=conversation.get("summary"),
        message_count=conversation["message_count"],
        total_input_tokens=conversation["total_input_tokens"],
        total_output_tokens=conversation["total_output_tokens"],
        estimated_cost_usd=conversation["estimated_cost_usd"] / 1_000_000,
        assigned_to=conversation.get("assigned_to"),
        notes=conversation.get("notes"),
        created_at=conversation["created_at"],
        updated_at=conversation["updated_at"],
        closed_at=conversation.get("closed_at")
    )


@router.post("/conversations/{conversation_id}/messages", status_code=status.HTTP_201_CREATED)
async def log_message(conversation_id: str, data: SupportMessageCreate, tenant: TenantContext = Depends(set_user_tenant_context)):
    """Log a message (user or assistant) to a conversation."""
    db = get_database()
    
    try:
        conv_oid = ObjectId(conversation_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid conversation ID")
    
    conversation = await db.support_conversations.find_one({"_id": conv_oid})
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    message = {
        "conversation_id": conversation_id,
        "role": data.role.value,
        "content": data.content,
        "input_tokens": data.input_tokens,
        "output_tokens": data.output_tokens,
        "is_escalation": data.is_escalation,
        "created_at": datetime.utcnow()
    }
    
    await db.support_messages.insert_one(message)
    
    cost_increment = calculate_cost_microcents(data.input_tokens, data.output_tokens)
    
    update_data = {
        "$inc": {
            "message_count": 1,
            "total_input_tokens": data.input_tokens,
            "total_output_tokens": data.output_tokens,
            "estimated_cost_usd": cost_increment
        },
        "$set": {
            "updated_at": datetime.utcnow()
        }
    }
    
    # Auto-generate summary from first user message
    if conversation["message_count"] == 0 and data.role == MessageRole.USER:
        summary = data.content[:255] if len(data.content) > 255 else data.content
        update_data["$set"]["summary"] = summary
    
    # Handle escalation
    if data.is_escalation:
        update_data["$set"]["escalated"] = True
        update_data["$set"]["status"] = TicketStatus.NEEDS_REVIEW.value
        if not conversation.get("escalation_reason"):
            update_data["$set"]["escalation_reason"] = "Bot unable to resolve issue"
    
    await db.support_conversations.update_one(
        {"_id": conv_oid},
        update_data
    )
    
    return {"message": "Message logged successfully"}


@router.patch("/conversations/{conversation_id}", response_model=ConversationResponse)
async def update_conversation(conversation_id: str, data: ConversationUpdate, tenant: TenantContext = Depends(set_user_tenant_context), _user=Depends(get_current_staff)):
    """Update conversation status or metadata."""
    db = get_database()
    
    try:
        conv_oid = ObjectId(conversation_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid conversation ID")
    
    conversation = await db.support_conversations.find_one({"_id": conv_oid})
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    update_fields = {"updated_at": datetime.utcnow()}
    
    if data.status is not None:
        update_fields["status"] = data.status.value
        # Set closed_at when status changes to closed
        if data.status == TicketStatus.CLOSED and not conversation.get("closed_at"):
            update_fields["closed_at"] = datetime.utcnow()
    
    if data.escalated is not None:
        update_fields["escalated"] = data.escalated
    
    if data.escalation_reason is not None:
        update_fields["escalation_reason"] = data.escalation_reason
    
    if data.assigned_to is not None:
        update_fields["assigned_to"] = data.assigned_to
    
    if data.notes is not None:
        update_fields["notes"] = data.notes
    
    await db.support_conversations.update_one(
        {"_id": conv_oid},
        {"$set": update_fields}
    )
    
    updated_conversation = await db.support_conversations.find_one({"_id": conv_oid})
    updated_conversation["_id"] = str(updated_conversation["_id"])
    
    return ConversationResponse(
        id=updated_conversation["_id"],
        source=updated_conversation["source"],
        page_url=updated_conversation.get("page_url"),
        user_agent=updated_conversation.get("user_agent"),
        user_id=updated_conversation.get("user_id"),
        business_id=updated_conversation.get("business_id"),
        status=updated_conversation["status"],
        escalated=updated_conversation["escalated"],
        escalation_reason=updated_conversation.get("escalation_reason"),
        summary=updated_conversation.get("summary"),
        message_count=updated_conversation["message_count"],
        total_input_tokens=updated_conversation["total_input_tokens"],
        total_output_tokens=updated_conversation["total_output_tokens"],
        estimated_cost_usd=updated_conversation["estimated_cost_usd"] / 1_000_000,
        assigned_to=updated_conversation.get("assigned_to"),
        notes=updated_conversation.get("notes"),
        created_at=updated_conversation["created_at"],
        updated_at=updated_conversation["updated_at"],
        closed_at=updated_conversation.get("closed_at")
    )


@router.get("/conversations", response_model=List[ConversationResponse])
async def list_conversations(
    tenant: TenantContext = Depends(set_user_tenant_context),
    _user=Depends(get_current_staff),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    status_filter: Optional[TicketStatus] = None,
    source_filter: Optional[str] = None,
    escalated_only: bool = False
):
    """List all conversations (admin dashboard) with filtering."""
    db = get_database()
    
    query = {}
    if status_filter:
        query["status"] = status_filter.value
    if source_filter:
        query["source"] = source_filter
    if escalated_only:
        query["escalated"] = True
    
    cursor = db.support_conversations.find(query).sort("created_at", -1).skip(skip).limit(limit)
    conversations = await cursor.to_list(length=limit)
    
    result = []
    for conv in conversations:
        conv["_id"] = str(conv["_id"])
        result.append(ConversationResponse(
            id=conv["_id"],
            source=conv["source"],
            page_url=conv.get("page_url"),
            user_agent=conv.get("user_agent"),
            user_id=conv.get("user_id"),
            business_id=conv.get("business_id"),
            status=conv["status"],
            escalated=conv["escalated"],
            escalation_reason=conv.get("escalation_reason"),
            summary=conv.get("summary"),
            message_count=conv["message_count"],
            total_input_tokens=conv["total_input_tokens"],
            total_output_tokens=conv["total_output_tokens"],
            estimated_cost_usd=conv["estimated_cost_usd"] / 1_000_000,
            assigned_to=conv.get("assigned_to"),
            notes=conv.get("notes"),
            created_at=conv["created_at"],
            updated_at=conv["updated_at"],
            closed_at=conv.get("closed_at")
        ))
    
    return result


@router.get("/conversations/{conversation_id}")
async def get_conversation(conversation_id: str, tenant: TenantContext = Depends(set_user_tenant_context)):
    """Get a single conversation with full message history."""
    db = get_database()
    
    try:
        conv_oid = ObjectId(conversation_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid conversation ID")
    
    conversation = await db.support_conversations.find_one({"_id": conv_oid})
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    # Get all messages for this conversation
    messages_cursor = db.support_messages.find({"conversation_id": conversation_id}).sort("created_at", 1)
    messages = await messages_cursor.to_list(length=500)
    
    messages_list = []
    for msg in messages:
        msg["_id"] = str(msg["_id"])
        
        # Handle both old and new message formats
        if "role" in msg and "content" in msg:
            messages_list.append({
                "id": msg["_id"],
                "role": msg["role"],
                "content": msg["content"],
                "input_tokens": msg.get("input_tokens", 0),
                "output_tokens": msg.get("output_tokens", 0),
                "is_escalation": msg.get("is_escalation", False),
                "created_at": msg["created_at"]
            })
        else:
            # Old format - convert
            if msg.get("user_message"):
                messages_list.append({
                    "id": msg["_id"] + "_user",
                    "role": "user",
                    "content": msg["user_message"],
                    "input_tokens": msg.get("input_tokens", 0),
                    "output_tokens": 0,
                    "is_escalation": False,
                    "created_at": msg["created_at"]
                })
            if msg.get("assistant_message"):
                messages_list.append({
                    "id": msg["_id"] + "_assistant",
                    "role": "assistant",
                    "content": msg["assistant_message"],
                    "input_tokens": 0,
                    "output_tokens": msg.get("output_tokens", 0),
                    "is_escalation": msg.get("is_escalation", False),
                    "created_at": msg["created_at"]
                })
    
    conversation["_id"] = str(conversation["_id"])
    
    return {
        "id": conversation["_id"],
        "source": conversation["source"],
        "page_url": conversation.get("page_url"),
        "user_agent": conversation.get("user_agent"),
        "user_id": conversation.get("user_id"),
        "business_id": conversation.get("business_id"),
        "status": conversation["status"],
        "escalated": conversation["escalated"],
        "escalation_reason": conversation.get("escalation_reason"),
        "summary": conversation.get("summary"),
        "message_count": conversation["message_count"],
        "total_input_tokens": conversation["total_input_tokens"],
        "total_output_tokens": conversation["total_output_tokens"],
        "estimated_cost_usd": conversation["estimated_cost_usd"] / 1_000_000,
        "assigned_to": conversation.get("assigned_to"),
        "notes": conversation.get("notes"),
        "created_at": conversation["created_at"],
        "updated_at": conversation["updated_at"],
        "closed_at": conversation.get("closed_at"),
        "messages": messages_list
    }


@router.get("/tickets", response_model=List[ConversationResponse])
async def get_tickets_needing_review(
    tenant: TenantContext = Depends(set_user_tenant_context),
    _user=Depends(get_current_staff),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100)
):
    """Get conversations that need human review (support queue)."""
    db = get_database()
    
    # Check multiple statuses like the SQL version
    query = {
        "status": {
            "$in": [
                TicketStatus.NEEDS_REVIEW.value,
                TicketStatus.OPEN.value,
                TicketStatus.IN_PROGRESS.value
            ]
        }
    }
    cursor = db.support_conversations.find(query).sort("created_at", -1).skip(skip).limit(limit)
    conversations = await cursor.to_list(length=limit)
    
    result = []
    for conv in conversations:
        conv["_id"] = str(conv["_id"])
        
        messages_cursor = db.support_messages.find({"conversation_id": conv["_id"]}).sort("created_at", 1)
        messages = await messages_cursor.to_list(length=100)
        
        messages_list = []
        for msg in messages:
            msg["_id"] = str(msg["_id"])
            
            # Handle both old (user_message/assistant_message) and new (role/content) formats
            if "role" in msg and "content" in msg:
                # New format
                messages_list.append(SupportMessage(
                    id=msg["_id"],
                    conversation_id=msg["conversation_id"],
                    role=msg["role"],
                    content=msg["content"],
                    input_tokens=msg.get("input_tokens", 0),
                    output_tokens=msg.get("output_tokens", 0),
                    is_escalation=msg.get("is_escalation", False),
                    created_at=msg["created_at"]
                ))
            else:
                # Old format - convert to new format
                if msg.get("user_message"):
                    messages_list.append(SupportMessage(
                        id=msg["_id"] + "_user",
                        conversation_id=msg["conversation_id"],
                        role=MessageRole.USER,
                        content=msg["user_message"],
                        input_tokens=msg.get("input_tokens", 0),
                        output_tokens=0,
                        is_escalation=False,
                        created_at=msg["created_at"]
                    ))
                if msg.get("assistant_message"):
                    messages_list.append(SupportMessage(
                        id=msg["_id"] + "_assistant",
                        conversation_id=msg["conversation_id"],
                        role=MessageRole.ASSISTANT,
                        content=msg["assistant_message"],
                        input_tokens=0,
                        output_tokens=msg.get("output_tokens", 0),
                        is_escalation=msg.get("is_escalation", False),
                        created_at=msg["created_at"]
                    ))
        
        result.append(ConversationResponse(
            id=conv["_id"],
            source=conv["source"],
            page_url=conv.get("page_url"),
            user_agent=conv.get("user_agent"),
            user_id=conv.get("user_id"),
            business_id=conv.get("business_id"),
            status=conv["status"],
            escalated=conv["escalated"],
            escalation_reason=conv.get("escalation_reason"),
            summary=conv.get("summary"),
            message_count=conv["message_count"],
            total_input_tokens=conv["total_input_tokens"],
            total_output_tokens=conv["total_output_tokens"],
            estimated_cost_usd=conv["estimated_cost_usd"] / 1_000_000,
            assigned_to=conv.get("assigned_to"),
            notes=conv.get("notes"),
            created_at=conv["created_at"],
            updated_at=conv["updated_at"],
            closed_at=conv.get("closed_at"),
            messages=messages_list
        ))
    
    return result


@router.get("/analytics", response_model=AnalyticsResponse)
async def get_analytics(days: int = Query(30, ge=1, le=365), tenant: TenantContext = Depends(set_user_tenant_context), _user=Depends(get_current_owner)):
    """Get support analytics: top questions, costs, volumes."""
    db = get_database()
    
    cutoff_date = datetime.utcnow() - timedelta(days=days)
    
    total_conversations = await db.support_conversations.count_documents({"created_at": {"$gte": cutoff_date}})
    total_messages = await db.support_messages.count_documents({"created_at": {"$gte": cutoff_date}})
    
    pipeline = [
        {"$match": {"created_at": {"$gte": cutoff_date}}},
        {
            "$group": {
                "_id": None,
                "auto_resolved": {"$sum": {"$cond": [{"$eq": ["$status", "auto_resolved"]}, 1, 0]}},
                "escalated": {"$sum": {"$cond": ["$escalated", 1, 0]}},
                "total_cost": {"$sum": "$estimated_cost_usd"}
            }
        }
    ]
    
    agg_result = await db.support_conversations.aggregate(pipeline).to_list(length=1)
    
    if agg_result:
        stats = agg_result[0]
        auto_resolved_count = stats.get("auto_resolved", 0)
        escalated_count = stats.get("escalated", 0)
        total_cost = stats.get("total_cost", 0)
    else:
        auto_resolved_count = 0
        escalated_count = 0
        total_cost = 0
    
    auto_resolved_pct = (auto_resolved_count / total_conversations * 100) if total_conversations > 0 else 0
    escalated_pct = (escalated_count / total_conversations * 100) if total_conversations > 0 else 0
    avg_messages_per_conversation = (total_messages / total_conversations) if total_conversations > 0 else 0
    
    messages_cursor = db.support_messages.find(
        {"created_at": {"$gte": cutoff_date}, "role": "user"},
        {"content": 1}
    )
    messages = await messages_cursor.to_list(length=10000)
    
    question_counter = Counter()
    for msg in messages:
        question = msg.get("content", "").strip()
        if question:
            normalized_question = re.sub(r'\s+', ' ', question)
            if len(normalized_question) > 10:
                question_counter[normalized_question] += 1
    
    top_questions = [
        TopQuestion(question=q, count=c)
        for q, c in question_counter.most_common(10)
    ]
    
    daily_pipeline = [
        {"$match": {"created_at": {"$gte": cutoff_date}}},
        {
            "$group": {
                "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$created_at"}},
                "count": {"$sum": 1}
            }
        },
        {"$sort": {"_id": 1}}
    ]
    
    daily_results = await db.support_conversations.aggregate(daily_pipeline).to_list(length=days)
    conversations_by_day = [
        DailyConversations(date=day["_id"], count=day["count"])
        for day in daily_results
    ]
    
    return AnalyticsResponse(
        total_conversations=total_conversations,
        total_messages=total_messages,
        auto_resolved_pct=round(auto_resolved_pct, 1),
        escalated_pct=round(escalated_pct, 1),
        avg_messages_per_conversation=round(avg_messages_per_conversation, 1),
        total_cost_usd=round(total_cost / 1_000_000, 2),
        top_questions=top_questions,
        conversations_by_day=conversations_by_day
    )
