"""
AI Floor Plan Designer (Gemini-powered)
========================================
Uses Google Gemini to reason about restaurant layout like a real designer,
then feeds positions through the constraint solver for physics enforcement.

Two-phase approach (validated by LayoutGPT/NeurIPS 2023):
  Phase 1: LLM spatial reasoning — Gemini reads the room and decides placement
  Phase 2: Constraint solver — enforce no-overlaps, spacing, boundaries
"""

import json
import httpx
import copy
import math
from typing import List, Dict, Optional
from services.floor_plan_solver import (
    resolve_overlaps, validate_layout, get_table_size,
    get_element_size, GRID_SNAP, WALL_CLEARANCE, MIN_TABLE_GAP
)


GEMINI_MODEL = "gemini-2.0-flash"
GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}"


SYSTEM_PROMPT = """You are a world-class restaurant interior designer. You will receive a floor plan as JSON with room dimensions, fixtures, and tables. Return optimal (x, y) positions for each table.

## HOW YOU THINK:

1. **READ THE ROOM** — Where are walls (canvas edges)? Windows (natural light)? Kitchen (service flow origin)? Bar (social hub)?

2. **PREMIUM POSITIONS FIRST**
   - Window tables = GOLD. Put intimate 2-tops next to windows.
   - Wall-adjacent = cosy. Guests prefer back-to-wall seating.
   - Corners = premium for couples and small groups.

3. **SIZE MATCHING**
   - 2-seat tables → windows, corners, perimeter (intimate spots)
   - 4-seat tables → versatile, fill gaps anywhere
   - 6-8+ seat tables → centre of room or along long walls (need space)
   - Booths/long tables → against walls or as room dividers

4. **SERVICE FLOW**
   - Keep a clear walking path from kitchen to all tables (minimum 80px wide aisle)
   - Don't block the kitchen entrance
   - Main aisle through the centre of the room

5. **AVOID**
   - No romantic tables next to toilets
   - Don't block stairway access
   - Don't crowd the kitchen entrance
   - Large groups away from the entrance

6. **SPACING**
   - Minimum 25px gap between table edges
   - At least 35px clearance from fixtures
   - At least 30px from canvas edges
   - Tables NEVER overlap

## OUTPUT FORMAT:
Return ONLY a JSON array. No explanation, no markdown, no backticks, no extra text.
[{"id": "table_id", "x": 100, "y": 200}, ...]"""


def _describe_elements(elements: List[Dict], canvas_w: float, canvas_h: float) -> str:
    """Build a clear description of the room for the LLM."""
    fixtures = []
    tables = []

    for el in elements:
        if el.get("type") == "fixture":
            fk = el.get("fixtureKind") or el.get("fixtureType", "unknown")
            w, h = get_element_size(el)
            x, y = el.get("x", 0), el.get("y", 0)

            # Add spatial context
            pos = []
            if y < canvas_h * 0.2:
                pos.append("top")
            elif y > canvas_h * 0.7:
                pos.append("bottom")
            if x < canvas_w * 0.2:
                pos.append("left")
            elif x > canvas_w * 0.7:
                pos.append("right")
            pos_str = f" ({'-'.join(pos)} of room)" if pos else ""

            fixtures.append(
                f"  - {fk.title()}: position=({x},{y}), size={w}×{h}{pos_str}"
            )
        else:
            seats = el.get("seats", 4)
            shape = el.get("shape", "round")
            w, h = get_table_size(el)
            tables.append(
                f"  - id=\"{el['id']}\", seats={seats}, shape={shape}, size={w}×{h}"
            )

    prompt = f"""Room: {canvas_w}px wide × {canvas_h}px tall

Fixtures (FIXED — do not move these):
{chr(10).join(fixtures) if fixtures else "  None"}

Tables to place (give each a new x, y position):
{chr(10).join(tables)}

Place these {len(tables)} tables optimally. Return JSON array only."""

    return prompt


async def ai_arrange(
    elements: List[Dict],
    canvas_w: float = 1000,
    canvas_h: float = 800,
    zone: Optional[str] = None,
    api_key: Optional[str] = None,
) -> List[Dict]:
    """
    AI-powered floor plan arrangement.

    Phase 1: Gemini reasons about the room and returns ideal positions
    Phase 2: Constraint solver enforces physics (no overlaps, spacing, bounds)

    Falls back to rule-based solver if Gemini is unavailable.
    """
    from services.floor_plan_solver import auto_arrange as fallback_arrange

    result = copy.deepcopy(elements)

    # Filter by zone
    if zone:
        zone_elements = [e for e in result if e.get("zone") == zone]
    else:
        zone_elements = result

    tables = [e for e in zone_elements if e.get("type") != "fixture"]
    if not tables:
        return result

    # If no API key, fall back to rule-based
    if not api_key:
        print("[floor_plan_ai] No Gemini API key — falling back to rule-based solver")
        return fallback_arrange(result, canvas_w, canvas_h, zone)

    # ── Phase 1: Ask Gemini to design the layout ──
    try:
        positions = await _ask_gemini(zone_elements, canvas_w, canvas_h, api_key)
    except Exception as e:
        print(f"[floor_plan_ai] Gemini call failed: {e} — falling back to rule-based")
        return fallback_arrange(result, canvas_w, canvas_h, zone)

    if not positions:
        print("[floor_plan_ai] Gemini returned no positions — falling back")
        return fallback_arrange(result, canvas_w, canvas_h, zone)

    # ── Apply Gemini's positions to the elements ──
    pos_map = {p["id"]: p for p in positions}
    for el in result:
        if el["id"] in pos_map:
            el["x"] = pos_map[el["id"]]["x"]
            el["y"] = pos_map[el["id"]]["y"]

    # ── Phase 2: Constraint solver enforces physics ──
    # Fix any overlaps or boundary violations Gemini might have created
    result = resolve_overlaps(result, canvas_w, canvas_h, MIN_TABLE_GAP)

    # Grid snap for clean look
    for el in result:
        if el.get("type") != "fixture" and (not zone or el.get("zone") == zone):
            el["x"] = round(el["x"] / GRID_SNAP) * GRID_SNAP
            el["y"] = round(el["y"] / GRID_SNAP) * GRID_SNAP

    # Clamp to canvas bounds
    for el in result:
        if el.get("type") != "fixture":
            w, h = get_table_size(el)
            el["x"] = max(WALL_CLEARANCE, min(canvas_w - w - WALL_CLEARANCE, el["x"]))
            el["y"] = max(WALL_CLEARANCE, min(canvas_h - h - WALL_CLEARANCE, el["y"]))

    return result


async def _ask_gemini(
    elements: List[Dict],
    canvas_w: float,
    canvas_h: float,
    api_key: str
) -> List[Dict]:
    """Call Gemini API and parse the response into table positions."""

    user_prompt = _describe_elements(elements, canvas_w, canvas_h)

    url = GEMINI_URL.format(model=GEMINI_MODEL, key=api_key)

    payload = {
        "contents": [
            {
                "role": "user",
                "parts": [{"text": SYSTEM_PROMPT + "\n\n" + user_prompt}]
            }
        ],
        "generationConfig": {
            "temperature": 0.3,
            "maxOutputTokens": 2048,
            "responseMimeType": "application/json",
        }
    }

    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.post(url, json=payload)
        resp.raise_for_status()
        data = resp.json()

    # Extract text from Gemini response
    candidates = data.get("candidates", [])
    if not candidates:
        raise ValueError("No candidates in Gemini response")

    parts = candidates[0].get("content", {}).get("parts", [])
    if not parts:
        raise ValueError("No parts in Gemini response")

    text = parts[0].get("text", "").strip()

    # Clean up — strip markdown fences if present
    if text.startswith("```"):
        text = text.split("\n", 1)[-1]
    if text.endswith("```"):
        text = text.rsplit("```", 1)[0]
    text = text.strip()

    # Parse JSON
    positions = json.loads(text)

    if not isinstance(positions, list):
        raise ValueError(f"Expected list, got {type(positions)}")

    # Validate each position has id, x, y and they're numbers
    clean = []
    for p in positions:
        if "id" in p and "x" in p and "y" in p:
            clean.append({
                "id": str(p["id"]),
                "x": round(float(p["x"])),
                "y": round(float(p["y"])),
            })

    return clean
