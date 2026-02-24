"""
Rezvo LinkedIn Autopilot — AI-powered content engine
Follows Lara Acosta's proven LinkedIn playbook:
- SLAY framework (Story → Lesson → Actionable → You)
- PAS framework (Problem → Agitate → Solution)
- 4-3-2-1 system (4 posts/week, 3 pillars, 2 frameworks, 1 brand)
- 3 content pillars: Growth, TAM (Total Addressable Market), Sales
- 8-word hooks, rehooks, broad→narrow→niche structure
- Authority jacking + trend jacking + strategic arbitrage
"""
from fastapi import APIRouter, HTTPException, Body
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timedelta
import httpx
import logging
import random
from bson import ObjectId
from config import Settings
from database import get_database

router = APIRouter(prefix="/linkedin", tags=["linkedin"])
logger = logging.getLogger(__name__)
settings = Settings()

# ─── Rezvo Brand Context for Claude ─── #
REZVO_BRAND_CONTEXT = """
═══════════════════════════════════════════
YOUR IDENTITY — WHO IS WRITING THESE POSTS
═══════════════════════════════════════════

You are writing LinkedIn posts AS the founder of Rezvo. Here's the founder's story and voice:

**The Founder:**
- Built Rezvo as a solo founder — the ultimate underdog story
- Background as a Payment Consultant — saw firsthand how restaurants get fleeced by platforms
- Based in Nottingham, UK — launching city by city starting here
- Working with his son who's building a complementary EPOS system to take on EPOS Now
- Mission: "Save the High Street" — genuinely passionate about independent businesses surviving

**The Voice:**
- British, warm, direct, no corporate fluff
- Speaks from experience — real numbers, real restaurants, real problems
- Self-deprecating humour ("it's just me building this entire platform")
- Passionate about fairness — gets genuinely fired up about commission exploitation
- Uses concrete examples: "Burg Burgers in Nottingham was paying 48% to delivery platforms"
- NOT preachy, NOT guru-like, NOT corporate LinkedIn speak

**Key Stories to Draw From:**
- Solo founder building against billion-dollar competitors (Deliveroo, UberEats, OpenTable)
- Payment consultant who saw the problem from the inside and couldn't ignore it
- Father-son team: founder builds the platform, son builds the EPOS system
- First guinea pig restaurants: Micho (Turkish restaurant) and Burg Burgers (burger chain + sushi)
- The "Save the High Street" mission — UK high streets dying, independent restaurants closing
- Building AI into everything — chatbot, voice search, automated marketing
- Zero commission model vs the industry standard of 25-48%
- City-by-city growth strategy starting with Nottingham

═══════════════════════════════════════════
THE BUSINESS — REZVO
═══════════════════════════════════════════

**What Rezvo Does:**
- Zero-commission booking platform for UK restaurants and service businesses
- Online ordering with Uber Direct delivery (5-8% vs Deliveroo's 25-35%)
- Full CRM, floor plan management, staff scheduling, deposit collection
- AI-powered chatbot and voice assistant for every restaurant
- Built-in email marketing suite (Campaign Monitor competitor)
- SEO audit and website health reports for restaurants
- EPOS system (competing with EPOS Now for 5% UK market share)

**Pricing:**
- Free: £0/mo (1 staff, 100 bookings)
- Starter: £8.99/mo (3 staff, unlimited bookings)
- Growth: £29/mo (5 staff, deposits, CRM, analytics)
- Scale: £59/mo (unlimited, floor plan, white-label)
- Enterprise: Custom

**Real Numbers to Reference:**
- Deliveroo charges 25-35% commission per order
- UberEats charges 15-30%
- JustEat/Foodhub: up to 48%
- OpenTable charges £1.50-£2.50 per seated diner
- ResDiary charges £89-£299/month
- Average UK restaurant profit margin: 3-9%
- A restaurant doing £10K/month on Deliveroo at 30% = £3,000/month in commission = £36,000/year
- That same restaurant on Rezvo Growth plan: £29/month + 5-8% on delivery only

**Competitors to Reference:**
- Deliveroo, UberEats, JustEat (delivery commission)
- OpenTable, ResDiary, TheFork (booking commission/fees)
- EPOS Now, Square, Toast, Lightspeed (EPOS systems)
- Yelp, TripAdvisor (directory/reviews)

**Current Milestones:**
- Platform live at rezvo.app and rezvo.co.uk
- AI chatbot live and answering questions
- First partner restaurants onboarding in Nottingham
- Full email marketing suite built
- SEO audit tool generating reports
"""

# ─── Content Generation System Prompt ─── #
LINKEDIN_SYSTEM_PROMPT = f"""You are an expert LinkedIn ghostwriter who has studied Lara Acosta's exact methodology. You write viral LinkedIn posts that get thousands of impressions and generate B2B leads.

{REZVO_BRAND_CONTEXT}

═══════════════════════════════════════════
LINKEDIN WRITING RULES (NON-NEGOTIABLE)
═══════════════════════════════════════════

**HOOK RULES:**
- First line MUST be 8 words or fewer — this is the mobile cutoff
- Must create curiosity, shock, or promise a specific outcome
- Use numbers, specifics, and "how I" instead of "how to"
- Second line (rehook) must be equally compelling — this is where "See more" appears
- Never start with "I'm excited to announce" or similar corporate LinkedIn speak

**FORMATTING RULES:**
- One sentence per line with a blank line between each
- Vary sentence lengths: short punchy lines mixed with slightly longer ones
- Use the F-shape reading pattern — front-load value
- Keep total post between 800-1200 characters for optimal engagement
- NO emojis in the hook or first 3 lines
- Minimal emojis overall (max 2-3 in entire post, and only at the end)
- NO hashtags (they reduce reach on LinkedIn in 2026)
- End with a question (CTA to engage) or a feel-good statement

**STRUCTURE — SLAY FRAMEWORK:**
S = Story: Start with a personal anecdote, observation, or real event
L = Lesson: Pivot to the key insight or principle
A = Actionable: Give specific, implementable steps or numbers
Y = You: End by pointing it back at the reader — ask them a question

**STRUCTURE — PAS FRAMEWORK:**
P = Problem: State a painful problem your audience has
A = Agitate: Make it worse — show the real cost of inaction
S = Solution: Present the solution with specifics

**THE 3 CONTENT PILLARS:**
1. GROWTH content — Rezvo-specific. Building the platform, features, behind-the-scenes, milestones, partner stories
2. TAM content — Broad restaurant/hospitality industry. Commission exploitation, high street decline, restaurant economics, food delivery trends, AI in hospitality
3. SALES content — Direct pitch with social proof. Savings calculator, competitor comparisons, case studies, "here's what we built for X"

**BROAD→NARROW→NICHE STRUCTURE:**
- Hook: Broad enough that any business person stops scrolling
- Body: Narrow to restaurant/hospitality specifically
- Detail: Ultra-niche with Rezvo-specific data and solutions

**WHAT MAKES POSTS VIRAL ON LINKEDIN:**
- Personal stories with business lessons
- Specific numbers and metrics (not vague claims)
- Contrarian takes ("The restaurant industry has it backwards")
- Behind-the-scenes of building something
- Father-son business stories
- Underdog vs. giant narratives
- Real vulnerability mixed with determination

**WHAT KILLS POSTS:**
- Generic advice anyone could give
- Corporate speak ("synergy", "leverage", "ecosystem")
- Starting with "I'm thrilled/excited/proud to announce"
- Lists without context or story
- Anything that sounds like ChatGPT default output
- Too many emojis
- Hashtags

═══════════════════════════════════════════
OUTPUT FORMAT
═══════════════════════════════════════════

Return your response as valid JSON with this structure:
{{
  "hook": "The 8-word-max first line",
  "rehook": "The compelling second line",
  "body": "The full post body (everything after the hook and rehook, with \\n\\n for line breaks)",
  "full_post": "The complete post as it would appear on LinkedIn (hook + rehook + body, properly formatted with \\n\\n between lines)",
  "framework": "SLAY or PAS",
  "pillar": "growth, tam, or sales",
  "estimated_impressions": "low/medium/high/viral",
  "hook_score": 1-10,
  "reasoning": "Brief explanation of why this post should perform well"
}}
"""

TREND_SYSTEM_PROMPT = f"""You are a LinkedIn trend analyst for Rezvo, a zero-commission restaurant booking platform. Your job is to identify trending topics in the restaurant, food delivery, hospitality, and high street business space that can be turned into viral LinkedIn posts.

{REZVO_BRAND_CONTEXT}

Given a news article or trending topic, generate a LinkedIn post that:
1. Trend-jacks the topic (reference it in the hook)
2. Adds the founder's unique perspective as a payment consultant building Rezvo
3. Ties it back to the mission of saving independent restaurants
4. Uses 8-word hooks and the SLAY or PAS framework

Return as valid JSON with the same structure as the content generation system.
"""

WEEKLY_CALENDAR_PROMPT = f"""You are generating a full week's LinkedIn content calendar for Rezvo's founder. Create exactly 4 posts following the 4-3-2-1 system:

{REZVO_BRAND_CONTEXT}

THE 4-3-2-1 SYSTEM:
- 4 posts per week (Monday, Tuesday, Thursday, Friday)
- 3 content pillars used across the week
- 2 frameworks alternated (SLAY and PAS)
- 1 consistent brand voice throughout

WEEKLY SCHEDULE:
- Monday: TAM content (broad industry topic) using SLAY framework
- Tuesday: Growth content (Rezvo-specific story) using PAS framework  
- Thursday: Growth content (behind-the-scenes, feature, partner story) using SLAY framework
- Friday: Sales content (pitch, comparison, case study) using PAS framework

Each post must have completely different topics and angles. No two hooks should feel similar.

Return as valid JSON array of 4 posts, each with:
{{
  "day": "monday/tuesday/thursday/friday",
  "hook": "8 words max",
  "rehook": "compelling second line",
  "body": "full post body with \\n\\n for line breaks",
  "full_post": "complete formatted post",
  "framework": "SLAY or PAS",
  "pillar": "growth/tam/sales",
  "topic_angle": "brief description of the angle",
  "estimated_impressions": "low/medium/high/viral",
  "hook_score": 1-10,
  "reasoning": "why this should perform well"
}}
"""


# ─── Models ─── #
class GeneratePostRequest(BaseModel):
    pillar: str = "tam"  # growth, tam, sales
    framework: str = "slay"  # slay, pas
    topic: Optional[str] = None
    custom_prompt: Optional[str] = None
    tone: str = "default"  # default, bold, vulnerable, data-driven, story-heavy

class TrendJackRequest(BaseModel):
    trend_topic: str
    news_url: Optional[str] = None
    angle: Optional[str] = None
    custom_prompt: Optional[str] = None  # Voice context from GhostPost

class EditPostRequest(BaseModel):
    post_id: str
    full_post: Optional[str] = None
    status: Optional[str] = None  # draft, approved, scheduled, posted
    scheduled_for: Optional[str] = None
    notes: Optional[str] = None

class GenerateWeekRequest(BaseModel):
    week_of: Optional[str] = None  # ISO date string for the Monday of the week
    custom_topics: Optional[List[str]] = None
    custom_prompt: Optional[str] = None  # Voice context from GhostPost


# ─── Claude API Call ─── #
async def call_claude(system_prompt: str, user_prompt: str, max_tokens: int = 2000):
    if not settings.anthropic_api_key:
        raise HTTPException(status_code=503, detail="AI not configured. Set ANTHROPIC_API_KEY.")
    
    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": settings.anthropic_api_key,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            json={
                "model": "claude-sonnet-4-20250514",
                "max_tokens": max_tokens,
                "system": system_prompt,
                "messages": [{"role": "user", "content": user_prompt}],
            },
        )
        
        if resp.status_code != 200:
            logger.error(f"Claude API error: {resp.status_code} — {resp.text[:500]}")
            raise HTTPException(status_code=502, detail="AI generation failed")
        
        data = resp.json()
        text = data["content"][0]["text"]
        
        # Parse JSON from response (handle markdown code blocks)
        import json
        text = text.strip()
        if text.startswith("```json"):
            text = text[7:]
        if text.startswith("```"):
            text = text[3:]
        if text.endswith("```"):
            text = text[:-3]
        text = text.strip()
        
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            logger.error(f"Failed to parse Claude JSON: {text[:500]}")
            return {"full_post": text, "error": "Could not parse structured response"}


# ─── Routes ─── #

@router.post("/generate")
async def generate_post(req: GeneratePostRequest):
    """Generate a single LinkedIn post using Claude"""
    
    tone_instructions = {
        "default": "",
        "bold": "Write with extra boldness and confidence. Take a strong contrarian stance.",
        "vulnerable": "Write with more vulnerability and personal honesty. Share struggles and doubts alongside wins.",
        "data-driven": "Lead heavily with specific numbers, statistics, and financial breakdowns.",
        "story-heavy": "Make this predominantly a personal story with the business lesson woven in subtly.",
    }
    
    prompt = f"""Generate a single LinkedIn post.

Pillar: {req.pillar.upper()} ({'Rezvo-specific growth story' if req.pillar == 'growth' else 'Broad restaurant/hospitality industry' if req.pillar == 'tam' else 'Direct sales/pitch content'})
Framework: {req.framework.upper()} ({'Story → Lesson → Actionable → You' if req.framework == 'slay' else 'Problem → Agitate → Solution'})
{f'Specific topic/angle: {req.topic}' if req.topic else 'Choose the most compelling topic based on current Rezvo milestones and industry trends'}
{f'Additional instructions: {req.custom_prompt}' if req.custom_prompt else ''}
{tone_instructions.get(req.tone, '')}

Remember: 8-word hook, compelling rehook, broad→narrow→niche structure, end with engagement CTA.
Return as valid JSON."""

    result = await call_claude(LINKEDIN_SYSTEM_PROMPT, prompt)
    
    # Save to database
    db = get_database()
    post_doc = {
        "type": "single",
        "pillar": req.pillar,
        "framework": req.framework,
        "tone": req.tone,
        "topic": req.topic,
        "content": result,
        "status": "draft",
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
        "impressions": 0,
        "likes": 0,
        "comments": 0,
        "leads_generated": 0,
    }
    insert = await db.linkedin_posts.insert_one(post_doc)
    result["_id"] = str(insert.inserted_id)
    result["status"] = "draft"
    
    return {"post": result}


@router.post("/generate-week")
async def generate_weekly_calendar(req: GenerateWeekRequest):
    """Generate a full week's content calendar (4 posts)"""
    
    week_label = req.week_of if req.week_of else datetime.utcnow().strftime("%Y-%m-%d")
    topics_line = ", ".join(req.custom_topics) if req.custom_topics else ""
    topics_part = f"Include these specific topics/angles where relevant: {topics_line}" if topics_line else ""
    newline = "\n"
    voice_part = f"VOICE CONTEXT — Write in this specific voice and style:{newline}{req.custom_prompt}" if req.custom_prompt else ""

    prompt = f"""Generate a full week's LinkedIn content calendar (4 posts).
Week of: {week_label}
{topics_part}
{voice_part}

Follow the 4-3-2-1 system exactly. Return as a JSON array of 4 post objects."""

    result = await call_claude(WEEKLY_CALENDAR_PROMPT, prompt, max_tokens=4000)
    
    # If result is a list (expected), save each post
    db = get_database()
    posts = result if isinstance(result, list) else [result]
    saved_posts = []
    
    week_of = req.week_of or datetime.utcnow().strftime("%Y-%m-%d")
    
    for i, post in enumerate(posts):
        post_doc = {
            "type": "weekly",
            "week_of": week_of,
            "day_index": i,
            "day": post.get("day", ["monday", "tuesday", "thursday", "friday"][i]),
            "pillar": post.get("pillar", "tam"),
            "framework": post.get("framework", "slay"),
            "content": post,
            "status": "draft",
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
            "impressions": 0,
            "likes": 0,
            "comments": 0,
            "leads_generated": 0,
        }
        insert = await db.linkedin_posts.insert_one(post_doc)
        post["_id"] = str(insert.inserted_id)
        post["status"] = "draft"
        saved_posts.append(post)
    
    return {"week_of": week_of, "posts": saved_posts}


@router.post("/trend-jack")
async def trend_jack_post(req: TrendJackRequest):
    """Generate a trend-jacking post from a news topic"""
    
    prompt = f"""A trending topic has emerged that can be turned into a viral LinkedIn post for Rezvo's founder.

Trending topic: {req.trend_topic}
{f'Source URL: {req.news_url}' if req.news_url else ''}
{f'Angle to take: {req.angle}' if req.angle else 'Choose the most compelling angle that ties this back to restaurant technology, commission exploitation, or the Save the High Street mission'}
{f'VOICE CONTEXT — Write in this specific voice and style:' + chr(10) + req.custom_prompt if req.custom_prompt else ''}

Write a trend-jacking LinkedIn post that:
1. References the trending topic in the hook (8 words max)
2. Shows the founder's unique perspective as someone building against the establishment
3. Ties back to Rezvo's mission
4. Uses either SLAY or PAS framework (pick whichever fits better)

This needs to feel timely and reactive — like the founder just saw this news and had to share their take. Return as valid JSON."""

    result = await call_claude(TREND_SYSTEM_PROMPT, prompt)
    
    db = get_database()
    post_doc = {
        "type": "trend",
        "trend_topic": req.trend_topic,
        "news_url": req.news_url,
        "content": result,
        "status": "draft",
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    }
    insert = await db.linkedin_posts.insert_one(post_doc)
    result["_id"] = str(insert.inserted_id)
    result["status"] = "draft"
    
    return {"post": result}


@router.get("/posts")
async def list_posts(
    status: Optional[str] = None,
    pillar: Optional[str] = None,
    week_of: Optional[str] = None,
    limit: int = 20,
    skip: int = 0,
):
    """List all LinkedIn posts with optional filters"""
    db = get_database()
    query = {}
    if status:
        query["status"] = status
    if pillar:
        query["pillar"] = pillar
    if week_of:
        query["week_of"] = week_of
    
    cursor = db.linkedin_posts.find(query).sort("created_at", -1).skip(skip).limit(limit)
    posts = []
    async for doc in cursor:
        doc["_id"] = str(doc["_id"])
        if "created_at" in doc:
            doc["created_at"] = doc["created_at"].isoformat()
        if "updated_at" in doc:
            doc["updated_at"] = doc["updated_at"].isoformat()
        posts.append(doc)
    
    total = await db.linkedin_posts.count_documents(query)
    
    return {"posts": posts, "total": total}


@router.get("/posts/{post_id}")
async def get_post(post_id: str):
    """Get a single post by ID"""
    db = get_database()
    try:
        doc = await db.linkedin_posts.find_one({"_id": ObjectId(post_id)})
    except Exception:
        raise HTTPException(status_code=404, detail="Post not found")
    
    if not doc:
        raise HTTPException(status_code=404, detail="Post not found")
    
    doc["_id"] = str(doc["_id"])
    if "created_at" in doc:
        doc["created_at"] = doc["created_at"].isoformat()
    if "updated_at" in doc:
        doc["updated_at"] = doc["updated_at"].isoformat()
    return doc


@router.put("/posts/{post_id}")
async def update_post(post_id: str, req: EditPostRequest):
    """Update a post — edit content, change status, schedule"""
    db = get_database()
    update = {"updated_at": datetime.utcnow()}
    
    if req.full_post is not None:
        update["content.full_post"] = req.full_post
    if req.status is not None:
        update["status"] = req.status
    if req.scheduled_for is not None:
        update["scheduled_for"] = req.scheduled_for
    if req.notes is not None:
        update["notes"] = req.notes
    
    try:
        result = await db.linkedin_posts.update_one(
            {"_id": ObjectId(post_id)},
            {"$set": update}
        )
    except Exception:
        raise HTTPException(status_code=404, detail="Post not found")
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Post not found or no changes")
    
    return {"status": "updated"}


@router.delete("/posts/{post_id}")
async def delete_post(post_id: str):
    """Delete a post"""
    db = get_database()
    try:
        result = await db.linkedin_posts.delete_one({"_id": ObjectId(post_id)})
    except Exception:
        raise HTTPException(status_code=404, detail="Post not found")
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Post not found")
    
    return {"status": "deleted"}


@router.post("/posts/{post_id}/regenerate")
async def regenerate_post(post_id: str):
    """Regenerate a post with a different angle"""
    db = get_database()
    try:
        doc = await db.linkedin_posts.find_one({"_id": ObjectId(post_id)})
    except Exception:
        raise HTTPException(status_code=404, detail="Post not found")
    
    if not doc:
        raise HTTPException(status_code=404, detail="Post not found")
    
    prompt = f"""Regenerate this LinkedIn post with a completely different angle and hook. 
Keep the same pillar ({doc.get('pillar', 'tam')}) and framework ({doc.get('framework', 'slay')}).

The previous version had this hook: "{doc.get('content', {}).get('hook', 'unknown')}"

Write something completely different — new angle, new hook, new story. Return as valid JSON."""

    result = await call_claude(LINKEDIN_SYSTEM_PROMPT, prompt)
    
    await db.linkedin_posts.update_one(
        {"_id": ObjectId(post_id)},
        {"$set": {
            "content": result,
            "status": "draft",
            "updated_at": datetime.utcnow(),
            "regeneration_count": (doc.get("regeneration_count", 0) + 1),
        }}
    )
    
    result["_id"] = post_id
    result["status"] = "draft"
    return {"post": result}


@router.post("/posts/{post_id}/track")
async def track_post_performance(
    post_id: str,
    impressions: int = Body(0),
    likes: int = Body(0),
    comments: int = Body(0),
    leads: int = Body(0),
):
    """Track actual performance after posting"""
    db = get_database()
    try:
        await db.linkedin_posts.update_one(
            {"_id": ObjectId(post_id)},
            {"$set": {
                "impressions": impressions,
                "likes": likes,
                "comments": comments,
                "leads_generated": leads,
                "status": "posted",
                "posted_at": datetime.utcnow(),
                "updated_at": datetime.utcnow(),
            }}
        )
    except Exception:
        raise HTTPException(status_code=404, detail="Post not found")
    
    return {"status": "tracked"}


@router.get("/analytics")
async def get_linkedin_analytics():
    """Get overall LinkedIn performance analytics"""
    db = get_database()
    
    # Total posts by status
    pipeline_status = [
        {"$group": {"_id": "$status", "count": {"$sum": 1}}}
    ]
    status_counts = {}
    async for doc in db.linkedin_posts.aggregate(pipeline_status):
        status_counts[doc["_id"] or "unknown"] = doc["count"]
    
    # Performance of posted content
    pipeline_perf = [
        {"$match": {"status": "posted"}},
        {"$group": {
            "_id": None,
            "total_impressions": {"$sum": "$impressions"},
            "total_likes": {"$sum": "$likes"},
            "total_comments": {"$sum": "$comments"},
            "total_leads": {"$sum": "$leads_generated"},
            "avg_impressions": {"$avg": "$impressions"},
            "avg_likes": {"$avg": "$likes"},
            "avg_comments": {"$avg": "$comments"},
            "post_count": {"$sum": 1},
        }}
    ]
    perf = None
    async for doc in db.linkedin_posts.aggregate(pipeline_perf):
        perf = doc
    
    # Best performing posts
    best_posts = []
    cursor = db.linkedin_posts.find({"status": "posted"}).sort("impressions", -1).limit(5)
    async for doc in cursor:
        doc["_id"] = str(doc["_id"])
        best_posts.append({
            "id": doc["_id"],
            "hook": doc.get("content", {}).get("hook", ""),
            "pillar": doc.get("pillar"),
            "framework": doc.get("framework"),
            "impressions": doc.get("impressions", 0),
            "likes": doc.get("likes", 0),
            "comments": doc.get("comments", 0),
            "leads": doc.get("leads_generated", 0),
        })
    
    # By pillar performance
    pipeline_pillar = [
        {"$match": {"status": "posted"}},
        {"$group": {
            "_id": "$pillar",
            "avg_impressions": {"$avg": "$impressions"},
            "avg_likes": {"$avg": "$likes"},
            "total_posts": {"$sum": 1},
        }}
    ]
    pillar_perf = {}
    async for doc in db.linkedin_posts.aggregate(pipeline_pillar):
        pillar_perf[doc["_id"] or "unknown"] = {
            "avg_impressions": round(doc["avg_impressions"] or 0),
            "avg_likes": round(doc["avg_likes"] or 0),
            "total_posts": doc["total_posts"],
        }
    
    return {
        "status_counts": status_counts,
        "performance": {
            "total_impressions": perf["total_impressions"] if perf else 0,
            "total_likes": perf["total_likes"] if perf else 0,
            "total_comments": perf["total_comments"] if perf else 0,
            "total_leads": perf["total_leads"] if perf else 0,
            "avg_impressions": round(perf["avg_impressions"] or 0) if perf else 0,
            "avg_likes": round(perf["avg_likes"] or 0) if perf else 0,
            "avg_comments": round(perf["avg_comments"] or 0) if perf else 0,
            "posts_tracked": perf["post_count"] if perf else 0,
        },
        "best_posts": best_posts,
        "pillar_performance": pillar_perf,
    }


@router.post("/scan-trends")
async def scan_trends():
    """AI scans for trending restaurant/hospitality topics to trend-jack"""
    
    prompt = """Scan your knowledge for the most current trending topics in the UK restaurant, food delivery, hospitality, and high street business space. Think about:

- Recent Deliveroo/UberEats/JustEat news (pricing changes, IPO movements, controversies)
- UK high street closures or revival stories
- Restaurant technology trends (AI ordering, automation, EPOS)  
- Government policy affecting hospitality (tax, rates, minimum wage)
- Food delivery driver disputes or commission controversies
- Celebrity restaurant openings/closings
- Food safety scandals
- Cost of living impact on dining

Return a JSON array of 5 trending topics, each with:
{
  "topic": "The trending topic",
  "why_trending": "Brief explanation",
  "rezvo_angle": "How Rezvo's founder could uniquely comment on this",
  "suggested_hook": "An 8-word hook for a potential post",
  "urgency": "high/medium/low (how time-sensitive is this)"
}"""

    result = await call_claude(LINKEDIN_SYSTEM_PROMPT, prompt, max_tokens=2000)
    return {"trends": result if isinstance(result, list) else [result]}


@router.post("/rewrite")
async def rewrite_post(
    original_post: str = Body(..., embed=True),
    instructions: str = Body("Make it better", embed=True),
):
    """Rewrite/improve an existing post based on instructions"""
    
    prompt = f"""Here is an existing LinkedIn post that needs improvement:

---
{original_post}
---

Instructions: {instructions}

Rewrite this post following all LinkedIn writing rules. Keep the core message but improve the hook, structure, and engagement potential. Return as valid JSON with the standard post structure."""

    result = await call_claude(LINKEDIN_SYSTEM_PROMPT, prompt)
    return {"post": result}
