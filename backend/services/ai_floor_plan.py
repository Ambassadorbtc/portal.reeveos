"""
AI Floor Plan Designer
======================
Uses an LLM to reason about restaurant layout like a real designer,
then feeds positions through the constraint solver for physics.

Two-phase approach (LayoutGPT / NeurIPS 2023):
  Phase 1: LLM spatial reasoning — reads the room, decides placement
  Phase 2: Constraint solver — enforces no-overlaps, spacing, bounds

Supports multiple LLM providers:
  - Anthropic Claude (default)
  - xAI Grok
  - OpenAI GPT-4o

Set FLOOR_PLAN_LLM_PROVIDER env var: "anthropic" | "xai" | "openai"
"""

import json
import os
import httpx
import copy
from typing import List, Dict, Optional, Tuple
from services.floor_plan_solver import (
    resolve_overlaps, validate_layout, get_table_size,
    get_element_size, GRID_SNAP, WALL_CLEARANCE, FIXTURE_CLEARANCE
)


# ── LLM Provider Config ──

PROVIDER = os.environ.get("FLOOR_PLAN_LLM_PROVIDER", "gemini")

PROVIDER_CONFIG = {
    "gemini": {
        "url": "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
        "model": "gemini-2.0-flash",
        "key_env": "GEMINI_API_KEY",
    },
    "anthropic": {
        "url": "https://api.anthropic.com/v1/messages",
        "model": "claude-haiku-4-5-20251001",
        "key_env": "ANTHROPIC_API_KEY",
    },
    "xai": {
        "url": "https://api.x.ai/v1/chat/completions",
        "model": "grok-3-mini-fast",
        "key_env": "XAI_API_KEY",
    },
    "openai": {
        "url": "https://api.openai.com/v1/chat/completions",
        "model": "gpt-4o-mini",
        "key_env": "OPENAI_API_KEY",
    },
}


# ── The Prompt (model-agnostic) ──

SYSTEM_PROMPT = """You are a world-class restaurant interior designer. You arrange floor plans.

You receive JSON describing a restaurant room — dimensions, fixtures, and tables. Return the optimal (x, y) position for each table.

## HOW TO THINK:

1. **READ THE ROOM** — Where are walls (canvas edges)? Windows (natural light)? Kitchen (service flow origin)? Bar (social hub)?

2. **PREMIUM POSITIONS FIRST**
   - Window seats = GOLD. Put small intimate 2-tops near windows.
   - Wall-adjacent = cosy. Guests prefer their back to a wall.
   - Corners = premium for couples.

3. **SIZE MATCHING**
   - 2-seat tables → windows, corners, perimeter
   - 4-seat tables → versatile, fill gaps
   - 6-8+ seat tables → centre of room or long walls, need space
   - Booths/long shapes → against walls

4. **SERVICE FLOW**
   - Clear path from kitchen to all areas — waiters carry hot plates
   - Main aisle through centre, at least 90px wide
   - Don't block kitchen entrance

5. **AVOID**
   - Don't seat anyone right next to toilets
   - Don't block stairs or entrances
   - Don't crowd kitchen doorway
   - Keep 25-35px minimum gap between all table edges
   - Keep 40px clearance from all fixtures

6. **BOUNDARIES**
   - Canvas is (0,0) top-left to (canvas_w, canvas_h) bottom-right
   - Keep tables at least 30px from canvas edges
   - Tables must NOT overlap each other or fixtures

## RESPONSE FORMAT:
Return ONLY a JSON array. No explanation, no markdown, no backticks:
[{"id": "t1", "x": 100, "y": 200}, {"id": "t2", "x": 300, "y": 150}]"""


def _describe_element(el: Dict) -> str:
    """Human-readable element description for the LLM."""
    if el.get("type") == "fixture":
        fk = el.get("fixtureKind") or el.get("fixtureType", "unknown")
        w, h = get_element_size(el)
        return f"  - {fk.upper()} at ({el.get('x',0)}, {el.get('y',0)}), size {w:.0f}×{h:.0f}px"
    else:
        seats = el.get("seats", 4)
        shape = el.get("shape", "round")
        w, h = get_table_size(el)
        name = el.get("name") or el.get("label") or el["id"]
        vip = " [VIP]" if el.get("vip") else ""
        return f"  - {name}: {seats} seats, {shape} shape, size {w:.0f}×{h:.0f}px{vip}"


def _build_user_prompt(elements: List[Dict], canvas_w: float, canvas_h: float, zone: Optional[str]) -> str:
    """Build the user prompt describing the room."""
    fixtures = [e for e in elements if e.get("type") == "fixture"]
    tables = [e for e in elements if e.get("type") != "fixture"]

    if zone:
        fixtures = [f for f in fixtures if f.get("zone") == zone]
        tables = [t for t in tables if t.get("zone") == zone]

    fixtures_desc = "\n".join(_describe_element(f) for f in fixtures) if fixtures else "  (none)"
    tables_desc = "\n".join(_describe_element(t) for t in tables) if tables else "  (none)"

    return f"""Room: {canvas_w:.0f}px wide × {canvas_h:.0f}px tall

Fixtures (FIXED — do NOT move these):
{fixtures_desc}

Tables to position (MOVE these — decide their x, y):
{tables_desc}

Return a JSON array with each table's id, x, y. Place them intelligently."""


# ── LLM Call (multi-provider) ──

async def _call_llm(system: str, user: str) -> str:
    """Call whichever LLM provider is configured. Returns raw response text."""
    config = PROVIDER_CONFIG.get(PROVIDER, PROVIDER_CONFIG["anthropic"])

    # Try to get API key from env or from settings
    api_key = os.environ.get(config["key_env"])
    if not api_key:
        try:
            from config import settings
            if PROVIDER == "anthropic":
                api_key = settings.anthropic_api_key
            elif PROVIDER == "xai":
                api_key = getattr(settings, "xai_api_key", None)
            elif PROVIDER == "openai":
                api_key = getattr(settings, "openai_api_key", None)
            elif PROVIDER == "gemini":
                api_key = getattr(settings, "gemini_api_key", None)
        except Exception:
            pass

    if not api_key:
        raise RuntimeError(f"No API key found for provider '{PROVIDER}'. Set {config['key_env']} env var.")

    async with httpx.AsyncClient(timeout=30.0) as client:
        if PROVIDER == "gemini":
            # Google Gemini API format
            url = config["url"].format(model=config["model"]) + f"?key={api_key}"
            resp = await client.post(
                url,
                headers={"Content-Type": "application/json"},
                json={
                    "systemInstruction": {"parts": [{"text": system}]},
                    "contents": [{"parts": [{"text": user}]}],
                    "generationConfig": {
                        "temperature": 0.3,
                        "maxOutputTokens": 2000,
                    },
                },
            )
            resp.raise_for_status()
            data = resp.json()
            return data["candidates"][0]["content"]["parts"][0]["text"]

        elif PROVIDER == "anthropic":
            # Anthropic Messages API format
            resp = await client.post(
                config["url"],
                headers={
                    "x-api-key": api_key,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json",
                },
                json={
                    "model": config["model"],
                    "max_tokens": 2000,
                    "system": system,
                    "messages": [{"role": "user", "content": user}],
                },
            )
            resp.raise_for_status()
            data = resp.json()
            return data["content"][0]["text"]

        else:
            # OpenAI-compatible format (works for xAI Grok and OpenAI)
            headers = {
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            }
            resp = await client.post(
                config["url"],
                headers=headers,
                json={
                    "model": config["model"],
                    "messages": [
                        {"role": "system", "content": system},
                        {"role": "user", "content": user},
                    ],
                    "max_tokens": 2000,
                    "temperature": 0.3,
                },
            )
            resp.raise_for_status()
            data = resp.json()
            return data["choices"][0]["message"]["content"]


def _parse_positions(raw: str) -> List[Dict]:
    """Extract the JSON array from LLM response, handling markdown fences."""
    text = raw.strip()
    # Strip markdown code fences if present
    if text.startswith("```"):
        lines = text.split("\n")
        lines = [l for l in lines if not l.strip().startswith("```")]
        text = "\n".join(lines).strip()
    # Find the JSON array
    start = text.find("[")
    end = text.rfind("]")
    if start == -1 or end == -1:
        raise ValueError(f"No JSON array found in LLM response: {text[:200]}")
    return json.loads(text[start:end + 1])


# ── Main Entry Point ──

async def ai_auto_arrange(
    elements: List[Dict],
    canvas_w: float = 1000,
    canvas_h: float = 800,
    zone: Optional[str] = None,
    style: str = "balanced",
) -> Dict:
    """
    AI-powered auto-arrange. Two-phase:
      Phase 1: LLM reads the room and decides table placement
      Phase 2: Constraint solver enforces physics (no overlaps, spacing, bounds)

    Returns: {elements, validation, provider, model}
    """
    result = copy.deepcopy(elements)

    # Build prompt
    user_prompt = _build_user_prompt(result, canvas_w, canvas_h, zone)

    # Phase 1: Ask the LLM
    config = PROVIDER_CONFIG.get(PROVIDER, PROVIDER_CONFIG["anthropic"])
    raw_response = await _call_llm(SYSTEM_PROMPT, user_prompt)

    # Parse LLM positions
    positions = _parse_positions(raw_response)
    pos_map = {p["id"]: (p["x"], p["y"]) for p in positions}

    # Apply LLM positions to elements
    for el in result:
        if el.get("type") == "fixture":
            continue
        if zone and el.get("zone") != zone:
            continue
        if el["id"] in pos_map:
            el["x"] = pos_map[el["id"]]["x"] if isinstance(pos_map[el["id"]], dict) else pos_map[el["id"]][0]
            el["y"] = pos_map[el["id"]]["y"] if isinstance(pos_map[el["id"]], dict) else pos_map[el["id"]][1]

    # Phase 2: Constraint solver — enforce physics
    # Gentle overlap resolution (LLM positions are usually pretty good)
    min_gap = {"dense": 20, "balanced": 28, "spacious": 40}.get(style, 28)
    result = resolve_overlaps(result, canvas_w, canvas_h, min_gap)

    # Grid snap for clean look
    for el in result:
        if el.get("type") != "fixture" and (not zone or el.get("zone") == zone):
            el["x"] = round(el["x"] / GRID_SNAP) * GRID_SNAP
            el["y"] = round(el["y"] / GRID_SNAP) * GRID_SNAP

    # Validate final result
    validation = validate_layout(result, canvas_w, canvas_h)

    return {
        "elements": result,
        "validation": validation,
        "provider": PROVIDER,
        "model": config["model"],
    }


# ── Fallback: rule-based if no API key ──

def has_ai_key() -> bool:
    """Check if an LLM API key is available for AI arrange."""
    config = PROVIDER_CONFIG.get(PROVIDER, PROVIDER_CONFIG["gemini"])
    key = os.environ.get(config["key_env"])
    if key:
        return True
    try:
        from config import settings
        attr = config["key_env"].lower()  # e.g. GEMINI_API_KEY -> gemini_api_key
        if getattr(settings, attr, None):
            return True
    except Exception:
        pass
    return False
