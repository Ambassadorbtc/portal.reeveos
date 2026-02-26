"""
AI Floor Plan Designer v2
=========================
Production-grade AI layout engine based on LayoutGPT research.

Four-layer reliability:
  Layer 1: Few-shot examples (biggest accuracy boost — 55% to 81%)
  Layer 2: CSS-style integer pixel coordinates
  Layer 3: Programmatic validation + auto-fix after generation
  Layer 4: Constraint solver fallback

Supports: Gemini (default), Claude, Grok, GPT-4o
"""

import json
import os
import httpx
import copy
from typing import List, Dict, Optional
from services.floor_plan_solver import (
    resolve_overlaps, validate_layout, get_table_size,
    get_element_size, GRID_SNAP
)
from services.floor_plan_presets import get_few_shot_example


# -- LLM Provider Config --

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


# -- System Prompt (upgraded with design intelligence) --

SYSTEM_PROMPT = """You are a world-class restaurant interior designer. You arrange floor plans by placing tables at optimal (x, y) positions.

## COORDINATE SYSTEM
- Canvas is (0,0) top-left to (canvas_w, canvas_h) bottom-right
- All values are INTEGER PIXELS. No decimals.
- Top of canvas = front of restaurant (entrance, windows)
- Bottom of canvas = back (kitchen, toilets)

## DESIGN RULES

1. ZONE THE ROOM (think before placing)
   - Front 20%: Premium window seats (2-tops for couples)
   - Middle 50%: Main dining (4-tops, versatile)
   - Back 30%: Larger groups (6-8 tops), near kitchen for fast service

2. WALL-HUGGING: Guests prefer backs to walls
   - Place 2-tops along left and right walls (x near 40-60 or near canvas_w - 130)
   - Place 4-tops in centre column(s)
   - Larger tables towards back

3. SERVICE AISLES: Clear paths for waiters
   - Minimum 90px (90cm) aisle between table columns
   - Straight path from kitchen (bottom) to front (top)

4. SPACING: Absolute minimum between table EDGES
   - Casual: 60px (60cm) minimum
   - From fixtures: 80px clearance
   - From walls (canvas edge): 30px minimum

5. TABLE SIZES (pixels):
   - 2-seat square: 85x85px
   - 4-seat round/square: 100x100px
   - 6-seat round: 120x120px
   - 8-seat round: 140x140px
   - Long table: width*1.7, height*0.65
   - Booth: width*1.4, height*0.8

6. CRITICAL BOUNDARIES (every table MUST satisfy):
   - x >= 30 AND y >= 30
   - x + table_width <= canvas_w - 30
   - y + table_height <= canvas_h - 30

## RESPONSE FORMAT
Return ONLY a JSON array. No explanation, no markdown, no backticks:
[{"id": "t1", "x": 100, "y": 200}, {"id": "t2", "x": 300, "y": 150}]"""


def _describe_element(el: Dict) -> str:
    """Human-readable element description for the LLM."""
    if el.get("type") == "fixture":
        fk = el.get("fixtureKind") or el.get("fixtureType", "unknown")
        w, h = get_element_size(el)
        return f"  - {fk.upper()} at ({el.get('x',0)}, {el.get('y',0)}), size {w:.0f}x{h:.0f}px [FIXED]"
    else:
        seats = el.get("seats", 4)
        shape = el.get("shape", "round")
        w, h = get_table_size(el)
        name = el.get("name") or el.get("label") or el["id"]
        vip = " [VIP]" if el.get("vip") else ""
        return f"  - {name} (id:{el['id']}): {seats} seats, {shape}, {w:.0f}x{h:.0f}px{vip}"


def _build_user_prompt(elements: List[Dict], canvas_w: float, canvas_h: float, zone: Optional[str], room_config: Optional[Dict] = None) -> str:
    """Build the user prompt with few-shot examples and room description."""
    fixtures = [e for e in elements if e.get("type") == "fixture"]
    tables = [e for e in elements if e.get("type") != "fixture"]

    if zone:
        fixtures = [f for f in fixtures if f.get("zone") == zone]
        tables = [t for t in tables if t.get("zone") == zone]

    fixtures_desc = "\n".join(_describe_element(f) for f in fixtures) if fixtures else "  (none)"
    tables_desc = "\n".join(_describe_element(t) for t in tables) if tables else "  (none)"

    # Room dimensions
    room_line = f"Canvas: {canvas_w:.0f}px wide x {canvas_h:.0f}px tall"
    preset = ""
    if room_config:
        w_m = room_config.get("width_m", canvas_w / 100)
        h_m = room_config.get("height_m", canvas_h / 100)
        preset = room_config.get("preset", "")
        room_line = f"Room: {w_m:.1f}m wide x {h_m:.1f}m deep (canvas {canvas_w:.0f}x{canvas_h:.0f}px)\nType: {preset.replace('_', ' ').title() if preset else 'Custom'}"

    # FEW-SHOT EXAMPLE -- the single biggest accuracy boost
    few_shot = ""
    if room_config and preset:
        w_m = room_config.get("width_m", canvas_w / 100)
        h_m = room_config.get("height_m", canvas_h / 100)
        example = get_few_shot_example(preset, w_m, h_m)
        few_shot = f"\n\n## REFERENCE LAYOUT (follow this spatial pattern):\n{example}\n"

    # Explicit boundary values
    max_x_2 = canvas_w - 30 - 85
    max_x_4 = canvas_w - 30 - 100
    max_y = canvas_h - 30 - 100
    boundary = f"""
## BOUNDARY LIMITS:
- 2-seat tables: x must be 30..{max_x_2:.0f}, y must be 30..{max_y:.0f}
- 4-seat tables: x must be 30..{max_x_4:.0f}, y must be 30..{max_y:.0f}
- 6-seat tables: x must be 30..{canvas_w - 30 - 120:.0f}
- All tables: y must be 30..{canvas_h - 30 - 140:.0f} (for largest)"""

    zone_hint = ""
    if zone:
        z = zone.lower()
        if any(k in z for k in ["terrace", "outside", "outdoor", "patio", "garden"]):
            zone_hint = f"\n\nThis is the {zone.upper()} -- outdoor dining. Spread tables generously."

    density_hint = ""
    if len(tables) <= 3:
        density_hint = "\n\nOnly a few tables -- spread across the full space, do NOT cluster."

    return f"""{room_line}
{few_shot}
Fixtures (FIXED -- do NOT move):
{fixtures_desc}

Tables to position (set x, y for each):
{tables_desc}
{boundary}
{zone_hint}{density_hint}
Return ONLY the JSON array with each table's id, x, y."""


# -- LLM Call (multi-provider) --

async def _call_llm(system: str, user: str) -> str:
    config = PROVIDER_CONFIG.get(PROVIDER, PROVIDER_CONFIG["anthropic"])
    api_key = os.environ.get(config["key_env"])
    if not api_key:
        try:
            from config import settings
            if PROVIDER == "anthropic": api_key = settings.anthropic_api_key
            elif PROVIDER == "xai": api_key = getattr(settings, "xai_api_key", None)
            elif PROVIDER == "openai": api_key = getattr(settings, "openai_api_key", None)
            elif PROVIDER == "gemini": api_key = getattr(settings, "gemini_api_key", None)
        except Exception: pass
    if not api_key:
        raise RuntimeError(f"No API key for '{PROVIDER}'. Set {config['key_env']}.")

    async with httpx.AsyncClient(timeout=30.0) as client:
        if PROVIDER == "gemini":
            url = config["url"].format(model=config["model"]) + f"?key={api_key}"
            resp = await client.post(url, headers={"Content-Type": "application/json"}, json={
                "systemInstruction": {"parts": [{"text": system}]},
                "contents": [{"parts": [{"text": user}]}],
                "generationConfig": {"temperature": 0.2, "maxOutputTokens": 2000},
            })
            resp.raise_for_status()
            return resp.json()["candidates"][0]["content"]["parts"][0]["text"]
        elif PROVIDER == "anthropic":
            resp = await client.post(config["url"], headers={
                "x-api-key": api_key, "anthropic-version": "2023-06-01", "content-type": "application/json",
            }, json={
                "model": config["model"], "max_tokens": 2000, "system": system,
                "messages": [{"role": "user", "content": user}],
            })
            resp.raise_for_status()
            return resp.json()["content"][0]["text"]
        else:
            resp = await client.post(config["url"], headers={
                "Authorization": f"Bearer {api_key}", "Content-Type": "application/json",
            }, json={
                "model": config["model"],
                "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
                "max_tokens": 2000, "temperature": 0.2,
            })
            resp.raise_for_status()
            return resp.json()["choices"][0]["message"]["content"]


def _parse_positions(raw: str) -> List[Dict]:
    text = raw.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        lines = [l for l in lines if not l.strip().startswith("```")]
        text = "\n".join(lines).strip()
    start = text.find("[")
    end = text.rfind("]")
    if start == -1 or end == -1:
        raise ValueError(f"No JSON array in response: {text[:200]}")
    return json.loads(text[start:end + 1])


# -- Layer 3: Post-generation validation + auto-fix --

def _validate_and_fix(elements: List[Dict], canvas_w: float, canvas_h: float) -> List[Dict]:
    """Catch and fix boundary violations and overlaps the LLM missed."""
    result = copy.deepcopy(elements)

    # Boundary clamp all tables
    for el in result:
        if el.get("type") == "fixture":
            continue
        w, h = get_table_size(el)
        el["x"] = max(30, min(canvas_w - w - 30, el.get("x", 0)))
        el["y"] = max(30, min(canvas_h - h - 30, el.get("y", 0)))

    # Pairwise overlap resolution
    tables = [e for e in result if e.get("type") != "fixture"]
    min_gap = 50

    for i in range(len(tables)):
        t1 = tables[i]
        w1, h1 = get_table_size(t1)
        for j in range(i + 1, len(tables)):
            t2 = tables[j]
            w2, h2 = get_table_size(t2)

            # Centre-to-centre distance needed
            need_dx = (w1 + w2) / 2 + min_gap
            need_dy = (h1 + h2) / 2 + min_gap

            cx1 = t1["x"] + w1 / 2
            cy1 = t1["y"] + h1 / 2
            cx2 = t2["x"] + w2 / 2
            cy2 = t2["y"] + h2 / 2

            dx = abs(cx1 - cx2)
            dy = abs(cy1 - cy2)

            if dx < need_dx and dy < need_dy:
                # Overlap! Push apart along the axis with less overlap
                if dx / need_dx > dy / need_dy:
                    # Less overlap horizontally, push vertically
                    push = (need_dy - dy) / 2 + 5
                    if cy1 < cy2:
                        t1["y"] = max(30, t1["y"] - push)
                        t2["y"] = min(canvas_h - h2 - 30, t2["y"] + push)
                    else:
                        t2["y"] = max(30, t2["y"] - push)
                        t1["y"] = min(canvas_h - h1 - 30, t1["y"] + push)
                else:
                    push = (need_dx - dx) / 2 + 5
                    if cx1 < cx2:
                        t1["x"] = max(30, t1["x"] - push)
                        t2["x"] = min(canvas_w - w2 - 30, t2["x"] + push)
                    else:
                        t2["x"] = max(30, t2["x"] - push)
                        t1["x"] = min(canvas_w - w1 - 30, t1["x"] + push)

    # Fixture collision check
    fixtures = [e for e in result if e.get("type") == "fixture"]
    clearance = 60
    for table in tables:
        tw, th = get_table_size(table)
        for fix in fixtures:
            fw, fh = get_element_size(fix)
            fx, fy = fix.get("x", 0), fix.get("y", 0)
            # Check overlap with clearance
            if (table["x"] < fx + fw + clearance and
                table["x"] + tw > fx - clearance and
                table["y"] < fy + fh + clearance and
                table["y"] + th > fy - clearance):
                # Push away from fixture
                # Try each direction, pick the one that needs least movement
                moves = []
                new_x = fx - clearance - tw
                if new_x >= 30: moves.append(("x", new_x, abs(table["x"] - new_x)))
                new_x = fx + fw + clearance
                if new_x + tw <= canvas_w - 30: moves.append(("x", new_x, abs(table["x"] - new_x)))
                new_y = fy - clearance - th
                if new_y >= 30: moves.append(("y", new_y, abs(table["y"] - new_y)))
                new_y = fy + fh + clearance
                if new_y + th <= canvas_h - 30: moves.append(("y", new_y, abs(table["y"] - new_y)))
                if moves:
                    best = min(moves, key=lambda m: m[2])
                    if best[0] == "x": table["x"] = best[1]
                    else: table["y"] = best[1]

    # Final safety clamp
    for el in result:
        if el.get("type") == "fixture": continue
        w, h = get_table_size(el)
        el["x"] = max(30, min(canvas_w - w - 30, el["x"]))
        el["y"] = max(30, min(canvas_h - h - 30, el["y"]))

    return result


# -- Main Entry Point --

async def ai_auto_arrange(
    elements: List[Dict],
    canvas_w: float = 1000,
    canvas_h: float = 800,
    zone: Optional[str] = None,
    style: str = "balanced",
    room_config: Optional[Dict] = None,
) -> Dict:
    """
    AI-powered auto-arrange with 4-layer reliability.
    """
    result = copy.deepcopy(elements)

    user_prompt = _build_user_prompt(result, canvas_w, canvas_h, zone, room_config)
    config = PROVIDER_CONFIG.get(PROVIDER, PROVIDER_CONFIG["anthropic"])
    raw_response = await _call_llm(SYSTEM_PROMPT, user_prompt)

    positions = _parse_positions(raw_response)
    pos_map = {p["id"]: (p["x"], p["y"]) for p in positions}

    for el in result:
        if el.get("type") == "fixture": continue
        if zone and el.get("zone") != zone: continue
        if el["id"] in pos_map:
            pos = pos_map[el["id"]]
            el["x"] = int(pos[0])
            el["y"] = int(pos[1])

    # Layer 3: Validate + auto-fix
    result = _validate_and_fix(result, canvas_w, canvas_h)

    # Layer 4: Constraint solver
    min_gap = {"dense": 20, "balanced": 28, "spacious": 40}.get(style, 28)
    result = resolve_overlaps(result, canvas_w, canvas_h, min_gap)

    # Grid snap
    for el in result:
        if el.get("type") != "fixture" and (not zone or el.get("zone") == zone):
            el["x"] = round(el["x"] / GRID_SNAP) * GRID_SNAP
            el["y"] = round(el["y"] / GRID_SNAP) * GRID_SNAP

    validation = validate_layout(result, canvas_w, canvas_h)
    return {"elements": result, "validation": validation, "provider": PROVIDER, "model": config["model"]}


def has_ai_key() -> bool:
    config = PROVIDER_CONFIG.get(PROVIDER, PROVIDER_CONFIG["gemini"])
    key = os.environ.get(config["key_env"])
    if key: return True
    try:
        from config import settings
        attr = config["key_env"].lower()
        if getattr(settings, attr, None): return True
    except Exception: pass
    return False
