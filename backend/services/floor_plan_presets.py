"""
Floor Plan Preset Layouts
=========================
Hand-crafted exemplar layouts for each UK room preset.
Based on real UK restaurant dimensions research:
  - 1m = 100px on canvas
  - 70cm (70px) standard 2-top table
  - 60cm (60px) min gap between table edges
  - 90cm (90px) service aisle width
  - 30cm (30px) wall clearance

Each preset provides:
  - Default elements (tables + fixtures) for a fresh start
  - A few-shot example for the AI prompt (what "good" looks like)

UK high street restaurants: narrow frontage (4-7m), running deep (10-18m).
Convention: width = frontage (short side), height = depth (long side).
Top of canvas = front/windows, bottom = kitchen/back.
"""

from typing import List, Dict


def get_preset_layout(preset: str, width_m: float, height_m: float) -> List[Dict]:
    """Return a fresh set of elements for the given room preset."""
    w = int(width_m * 100)  # canvas width in px
    h = int(height_m * 100)  # canvas height in px

    builder = PRESET_BUILDERS.get(preset)
    if builder:
        return builder(w, h)
    # Unknown preset — generate a generic layout
    return _generic_layout(w, h)


def get_few_shot_example(preset: str, width_m: float, height_m: float) -> str:
    """Return a few-shot JSON example for the AI prompt."""
    w = int(width_m * 100)
    h = int(height_m * 100)
    examples = FEW_SHOT_EXAMPLES.get(preset)
    if examples:
        return examples(w, h)
    return _generic_few_shot(w, h)


# ═══════════════════════════════════════════
# BISTRO — 6m × 10m (600 × 1000px)
# Narrow UK high street unit, 20-30 covers
# Windows at front, kitchen at back
# ═══════════════════════════════════════════

def _bistro_layout(w: int, h: int) -> List[Dict]:
    """Fresh bistro layout. ~24 covers."""
    cx = w // 2  # centre x
    return [
        # ── Fixtures ──
        {"id": "f1", "type": "fixture", "fixtureKind": "window",  "name": "Window",  "zone": "main", "x": 30,     "y": 20,  "rotation": 0},
        {"id": "f2", "type": "fixture", "fixtureKind": "window",  "name": "Window",  "zone": "main", "x": w - 130, "y": 20,  "rotation": 0},
        {"id": "f3", "type": "fixture", "fixtureKind": "kitchen", "name": "Kitchen", "zone": "main", "x": cx - 65, "y": h - 120, "rotation": 0},
        {"id": "f4", "type": "fixture", "fixtureKind": "toilets", "name": "Toilets", "zone": "main", "x": w - 100, "y": h - 80, "rotation": 0},
        # ── Window 2-tops (front wall, premium spots) ──
        {"id": "t1", "type": "table", "name": "T-01", "seats": 2, "zone": "main", "shape": "square", "x": 40,      "y": 60,  "status": "available"},
        {"id": "t2", "type": "table", "name": "T-02", "seats": 2, "zone": "main", "shape": "square", "x": w - 130, "y": 60,  "status": "available"},
        # ── Left wall 2-tops ──
        {"id": "t3", "type": "table", "name": "T-03", "seats": 2, "zone": "main", "shape": "square", "x": 40,      "y": 220, "status": "available"},
        {"id": "t4", "type": "table", "name": "T-04", "seats": 2, "zone": "main", "shape": "square", "x": 40,      "y": 380, "status": "available"},
        # ── Centre 4-tops (main service corridor either side) ──
        {"id": "t5", "type": "table", "name": "T-05", "seats": 4, "zone": "main", "shape": "round",  "x": cx - 50, "y": 200, "status": "available"},
        {"id": "t6", "type": "table", "name": "T-06", "seats": 4, "zone": "main", "shape": "round",  "x": cx - 50, "y": 370, "status": "available"},
        {"id": "t7", "type": "table", "name": "T-07", "seats": 4, "zone": "main", "shape": "round",  "x": cx - 50, "y": 540, "status": "available"},
        # ── Right wall 2-tops ──
        {"id": "t8", "type": "table", "name": "T-08", "seats": 2, "zone": "main", "shape": "square", "x": w - 130, "y": 220, "status": "available"},
        {"id": "t9", "type": "table", "name": "T-09", "seats": 2, "zone": "main", "shape": "square", "x": w - 130, "y": 380, "status": "available"},
        # ── Back section — larger table ──
        {"id": "t10", "type": "table", "name": "T-10", "seats": 6, "zone": "main", "shape": "long", "x": cx - 100, "y": 700, "status": "available"},
    ]


def _bistro_few_shot(w: int, h: int) -> str:
    cx = w // 2
    return f"""Example of a well-designed {w/100:.0f}m × {h/100:.0f}m bistro layout (canvas {w}×{h}px):
[
  {{"id":"t1","x":40,"y":60}},  // 2-top by left window (premium)
  {{"id":"t2","x":{w-130},"y":60}},  // 2-top by right window
  {{"id":"t3","x":40,"y":220}},  // 2-top left wall
  {{"id":"t4","x":40,"y":380}},  // 2-top left wall
  {{"id":"t5","x":{cx-50},"y":200}},  // 4-top centre
  {{"id":"t6","x":{cx-50},"y":370}},  // 4-top centre
  {{"id":"t7","x":{cx-50},"y":540}},  // 4-top centre
  {{"id":"t8","x":{w-130},"y":220}},  // 2-top right wall
  {{"id":"t9","x":{w-130},"y":380}},  // 2-top right wall
  {{"id":"t10","x":{cx-100},"y":700}}  // 6-top back section
]
Pattern: 2-tops along windows and walls for intimacy, 4-tops down the centre with service aisles either side, larger tables towards the back near kitchen. Minimum 60px between table edges, 90px service corridor."""


# ═══════════════════════════════════════════
# SMALL CAFÉ — 5m × 8m (500 × 800px)
# Compact, cosy, 10-20 covers
# ═══════════════════════════════════════════

def _cafe_layout(w: int, h: int) -> List[Dict]:
    cx = w // 2
    return [
        {"id": "f1", "type": "fixture", "fixtureKind": "window",  "name": "Window",  "zone": "main", "x": 30,      "y": 20, "rotation": 0},
        {"id": "f2", "type": "fixture", "fixtureKind": "bar",     "name": "Counter", "zone": "main", "x": cx - 80, "y": h - 60, "rotation": 0},
        # Window seat
        {"id": "t1", "type": "table", "name": "T-01", "seats": 2, "zone": "main", "shape": "square", "x": 40,      "y": 60,  "status": "available"},
        {"id": "t2", "type": "table", "name": "T-02", "seats": 2, "zone": "main", "shape": "round",  "x": w - 130, "y": 60,  "status": "available"},
        # Middle
        {"id": "t3", "type": "table", "name": "T-03", "seats": 4, "zone": "main", "shape": "round",  "x": cx - 50, "y": 230, "status": "available"},
        {"id": "t4", "type": "table", "name": "T-04", "seats": 2, "zone": "main", "shape": "square", "x": 40,      "y": 250, "status": "available"},
        # Back
        {"id": "t5", "type": "table", "name": "T-05", "seats": 4, "zone": "main", "shape": "square", "x": cx - 50, "y": 430, "status": "available"},
        {"id": "t6", "type": "table", "name": "T-06", "seats": 2, "zone": "main", "shape": "round",  "x": w - 130, "y": 400, "status": "available"},
    ]


def _cafe_few_shot(w: int, h: int) -> str:
    cx = w // 2
    return f"""Example of a well-designed {w/100:.0f}m × {h/100:.0f}m café layout (canvas {w}×{h}px):
[
  {{"id":"t1","x":40,"y":60}},  // 2-top window left
  {{"id":"t2","x":{w-130},"y":60}},  // 2-top window right
  {{"id":"t3","x":{cx-50},"y":230}},  // 4-top centre
  {{"id":"t4","x":40,"y":250}},  // 2-top left wall
  {{"id":"t5","x":{cx-50},"y":430}},  // 4-top back
  {{"id":"t6","x":{w-130},"y":400}}  // 2-top right wall
]
Pattern: Compact café — window seats at front, a central 4-top, wall-hugging 2-tops, counter at very back. Keep generous spacing in small rooms."""


# ═══════════════════════════════════════════
# MID-SIZE RESTAURANT — 10m × 15m (1000 × 1500px)
# Standard UK restaurant, 40-60 covers
# ═══════════════════════════════════════════

def _midsize_layout(w: int, h: int) -> List[Dict]:
    cx = w // 2
    third = w // 3
    return [
        # Fixtures
        {"id": "f1", "type": "fixture", "fixtureKind": "window",  "name": "Window",  "zone": "main", "x": 30,       "y": 20,      "rotation": 0},
        {"id": "f2", "type": "fixture", "fixtureKind": "window",  "name": "Window",  "zone": "main", "x": cx - 50,  "y": 20,      "rotation": 0},
        {"id": "f3", "type": "fixture", "fixtureKind": "window",  "name": "Window",  "zone": "main", "x": w - 130,  "y": 20,      "rotation": 0},
        {"id": "f4", "type": "fixture", "fixtureKind": "bar",     "name": "Bar",     "zone": "main", "x": 30,       "y": h - 100, "rotation": 0},
        {"id": "f5", "type": "fixture", "fixtureKind": "kitchen", "name": "Kitchen", "zone": "main", "x": w - 160,  "y": h - 120, "rotation": 0},
        {"id": "f6", "type": "fixture", "fixtureKind": "toilets", "name": "Toilets", "zone": "main", "x": w - 100,  "y": h - 80,  "rotation": 0},
        {"id": "f7", "type": "fixture", "fixtureKind": "stairs",  "name": "Stairs",  "zone": "main", "x": 30,       "y": h - 60,  "rotation": 0},
        # ── Row 1: Window seats (3 × 2-tops) ──
        {"id": "t1",  "type": "table", "name": "T-01", "seats": 2, "zone": "main", "shape": "square", "x": 50,       "y": 70,  "status": "available"},
        {"id": "t2",  "type": "table", "name": "T-02", "seats": 2, "zone": "main", "shape": "square", "x": cx - 42,  "y": 70,  "status": "available"},
        {"id": "t3",  "type": "table", "name": "T-03", "seats": 2, "zone": "main", "shape": "square", "x": w - 135,  "y": 70,  "status": "available"},
        # ── Row 2: 4-tops ──
        {"id": "t4",  "type": "table", "name": "T-04", "seats": 4, "zone": "main", "shape": "round",  "x": 50,       "y": 260, "status": "available"},
        {"id": "t5",  "type": "table", "name": "T-05", "seats": 4, "zone": "main", "shape": "round",  "x": cx - 50,  "y": 260, "status": "available"},
        {"id": "t6",  "type": "table", "name": "T-06", "seats": 4, "zone": "main", "shape": "round",  "x": w - 150,  "y": 260, "status": "available"},
        # ── Row 3: mixed ──
        {"id": "t7",  "type": "table", "name": "T-07", "seats": 2, "zone": "main", "shape": "square", "x": 50,       "y": 450, "status": "available"},
        {"id": "t8",  "type": "table", "name": "T-08", "seats": 4, "zone": "main", "shape": "round",  "x": cx - 50,  "y": 450, "status": "available"},
        {"id": "t9",  "type": "table", "name": "T-09", "seats": 2, "zone": "main", "shape": "square", "x": w - 135,  "y": 450, "status": "available"},
        # ── Row 4: bigger tables ──
        {"id": "t10", "type": "table", "name": "T-10", "seats": 6, "zone": "main", "shape": "round",  "x": 50,       "y": 650, "status": "available"},
        {"id": "t11", "type": "table", "name": "T-11", "seats": 4, "zone": "main", "shape": "round",  "x": cx - 50,  "y": 650, "status": "available"},
        {"id": "t12", "type": "table", "name": "T-12", "seats": 6, "zone": "main", "shape": "round",  "x": w - 170,  "y": 650, "status": "available"},
        # ── Row 5: back section ──
        {"id": "t13", "type": "table", "name": "T-13", "seats": 8, "zone": "main", "shape": "long",   "x": 50,       "y": 870, "status": "available"},
        {"id": "t14", "type": "table", "name": "T-14", "seats": 4, "zone": "main", "shape": "round",  "x": cx - 50,  "y": 870, "status": "available"},
        {"id": "t15", "type": "table", "name": "T-15", "seats": 4, "zone": "main", "shape": "round",  "x": w - 150,  "y": 870, "status": "available"},
        # ── Deep back ──
        {"id": "t16", "type": "table", "name": "T-16", "seats": 6, "zone": "main", "shape": "long",   "x": cx - 100, "y": 1080, "status": "available"},
    ]


def _midsize_few_shot(w: int, h: int) -> str:
    cx = w // 2
    return f"""Example of a well-designed {w/100:.0f}m × {h/100:.0f}m restaurant layout (canvas {w}×{h}px):
[
  {{"id":"t1","x":50,"y":70}},  // 2-top window left
  {{"id":"t2","x":{cx-42},"y":70}},  // 2-top window centre
  {{"id":"t3","x":{w-135},"y":70}},  // 2-top window right
  {{"id":"t4","x":50,"y":260}},  // 4-top left
  {{"id":"t5","x":{cx-50},"y":260}},  // 4-top centre
  {{"id":"t6","x":{w-150},"y":260}},  // 4-top right
  {{"id":"t7","x":50,"y":450}},  // 2-top left
  {{"id":"t8","x":{cx-50},"y":450}},  // 4-top centre
  {{"id":"t9","x":{w-135},"y":450}},  // 2-top right
  {{"id":"t10","x":50,"y":650}},  // 6-top left
  {{"id":"t11","x":{cx-50},"y":650}},  // 4-top centre
  {{"id":"t12","x":{w-170},"y":650}},  // 6-top right
  {{"id":"t13","x":50,"y":870}},  // 8-top long, left
  {{"id":"t14","x":{cx-50},"y":870}},  // 4-top centre
  {{"id":"t15","x":{w-150},"y":870}},  // 4-top right
  {{"id":"t16","x":{cx-100},"y":1080}}  // 6-top back section
]
Pattern: 3-column grid with service aisles between. Small tables at front (windows), larger tables towards back (near kitchen). 8-top long table for groups. ~56 covers total."""


# ═══════════════════════════════════════════
# LARGE RESTAURANT — 12m × 18m (1200 × 1800px)
# ═══════════════════════════════════════════

def _large_layout(w: int, h: int) -> List[Dict]:
    cx = w // 2
    q1 = w // 4
    q3 = 3 * w // 4
    return [
        # Fixtures
        {"id": "f1", "type": "fixture", "fixtureKind": "window",  "name": "Window",  "zone": "main", "x": 30,       "y": 20,      "rotation": 0},
        {"id": "f2", "type": "fixture", "fixtureKind": "window",  "name": "Window",  "zone": "main", "x": q1,       "y": 20,      "rotation": 0},
        {"id": "f3", "type": "fixture", "fixtureKind": "window",  "name": "Window",  "zone": "main", "x": cx,       "y": 20,      "rotation": 0},
        {"id": "f4", "type": "fixture", "fixtureKind": "window",  "name": "Window",  "zone": "main", "x": q3 - 50,  "y": 20,      "rotation": 0},
        {"id": "f5", "type": "fixture", "fixtureKind": "bar",     "name": "Bar",     "zone": "main", "x": 30,       "y": h // 2,  "rotation": 0},
        {"id": "f6", "type": "fixture", "fixtureKind": "kitchen", "name": "Kitchen", "zone": "main", "x": cx - 65,  "y": h - 120, "rotation": 0},
        {"id": "f7", "type": "fixture", "fixtureKind": "toilets", "name": "Toilets", "zone": "main", "x": w - 100,  "y": h - 80,  "rotation": 0},
        {"id": "f8", "type": "fixture", "fixtureKind": "stairs",  "name": "Stairs",  "zone": "main", "x": 30,       "y": h - 60,  "rotation": 0},
        # Row 1: window 2-tops
        {"id": "t1",  "type": "table", "name": "T-01", "seats": 2, "zone": "main", "shape": "square", "x": 50,       "y": 70,  "status": "available"},
        {"id": "t2",  "type": "table", "name": "T-02", "seats": 2, "zone": "main", "shape": "square", "x": q1 + 10,  "y": 70,  "status": "available"},
        {"id": "t3",  "type": "table", "name": "T-03", "seats": 2, "zone": "main", "shape": "square", "x": cx + 10,  "y": 70,  "status": "available"},
        {"id": "t4",  "type": "table", "name": "T-04", "seats": 2, "zone": "main", "shape": "square", "x": q3,       "y": 70,  "status": "available"},
        # Row 2: 4-tops
        {"id": "t5",  "type": "table", "name": "T-05", "seats": 4, "zone": "main", "shape": "round",  "x": 50,       "y": 260, "status": "available"},
        {"id": "t6",  "type": "table", "name": "T-06", "seats": 4, "zone": "main", "shape": "round",  "x": q1 + 10,  "y": 260, "status": "available"},
        {"id": "t7",  "type": "table", "name": "T-07", "seats": 4, "zone": "main", "shape": "round",  "x": cx + 10,  "y": 260, "status": "available"},
        {"id": "t8",  "type": "table", "name": "T-08", "seats": 4, "zone": "main", "shape": "round",  "x": q3,       "y": 260, "status": "available"},
        # Row 3
        {"id": "t9",  "type": "table", "name": "T-09", "seats": 4, "zone": "main", "shape": "round",  "x": 50,       "y": 460, "status": "available"},
        {"id": "t10", "type": "table", "name": "T-10", "seats": 2, "zone": "main", "shape": "square", "x": q1 + 10,  "y": 460, "status": "available"},
        {"id": "t11", "type": "table", "name": "T-11", "seats": 4, "zone": "main", "shape": "round",  "x": cx + 10,  "y": 460, "status": "available"},
        {"id": "t12", "type": "table", "name": "T-12", "seats": 2, "zone": "main", "shape": "square", "x": q3,       "y": 460, "status": "available"},
        # Row 4: bigger
        {"id": "t13", "type": "table", "name": "T-13", "seats": 6, "zone": "main", "shape": "round",  "x": 50,       "y": 660, "status": "available"},
        {"id": "t14", "type": "table", "name": "T-14", "seats": 6, "zone": "main", "shape": "round",  "x": q1 + 10,  "y": 660, "status": "available"},
        {"id": "t15", "type": "table", "name": "T-15", "seats": 4, "zone": "main", "shape": "round",  "x": cx + 10,  "y": 660, "status": "available"},
        {"id": "t16", "type": "table", "name": "T-16", "seats": 4, "zone": "main", "shape": "round",  "x": q3,       "y": 660, "status": "available"},
        # Row 5
        {"id": "t17", "type": "table", "name": "T-17", "seats": 8, "zone": "main", "shape": "long",   "x": 50,       "y": 880, "status": "available"},
        {"id": "t18", "type": "table", "name": "T-18", "seats": 4, "zone": "main", "shape": "round",  "x": cx - 50,  "y": 880, "status": "available"},
        {"id": "t19", "type": "table", "name": "T-19", "seats": 8, "zone": "main", "shape": "long",   "x": q3 - 50,  "y": 880, "status": "available"},
        # Deep back
        {"id": "t20", "type": "table", "name": "T-20", "seats": 6, "zone": "main", "shape": "long",   "x": cx - 100, "y": 1100, "status": "available"},
    ]


def _large_few_shot(w: int, h: int) -> str:
    return f"""Example: Large {w/100:.0f}m × {h/100:.0f}m restaurant ({w}×{h}px). 4-column grid, 80+ covers.
Pattern: Window 2-tops at front, 4-column grid of 4-tops filling the middle, 6-tops and 8-top long tables towards back for groups. Bar on left wall at midpoint. Kitchen centred at back wall. Service aisles between every column (~90px wide)."""


# ═══════════════════════════════════════════
# PUB DINING — 8m × 12m (800 × 1200px)
# ═══════════════════════════════════════════

def _pub_layout(w: int, h: int) -> List[Dict]:
    cx = w // 2
    return [
        {"id": "f1", "type": "fixture", "fixtureKind": "bar",     "name": "Bar",     "zone": "main", "x": cx - 80,  "y": 30,      "rotation": 0},
        {"id": "f2", "type": "fixture", "fixtureKind": "window",  "name": "Window",  "zone": "main", "x": 30,       "y": 20,      "rotation": 0},
        {"id": "f3", "type": "fixture", "fixtureKind": "kitchen", "name": "Kitchen", "zone": "main", "x": cx - 65,  "y": h - 120, "rotation": 0},
        {"id": "f4", "type": "fixture", "fixtureKind": "toilets", "name": "Toilets", "zone": "main", "x": w - 100,  "y": h - 80,  "rotation": 0},
        # Dining area starts below bar
        {"id": "t1", "type": "table", "name": "T-01", "seats": 4, "zone": "main", "shape": "round",  "x": 50,       "y": 160, "status": "available"},
        {"id": "t2", "type": "table", "name": "T-02", "seats": 4, "zone": "main", "shape": "round",  "x": cx - 50,  "y": 160, "status": "available"},
        {"id": "t3", "type": "table", "name": "T-03", "seats": 4, "zone": "main", "shape": "round",  "x": w - 150,  "y": 160, "status": "available"},
        {"id": "t4", "type": "table", "name": "T-04", "seats": 2, "zone": "main", "shape": "square", "x": 50,       "y": 340, "status": "available"},
        {"id": "t5", "type": "table", "name": "T-05", "seats": 6, "zone": "main", "shape": "round",  "x": cx - 60,  "y": 340, "status": "available"},
        {"id": "t6", "type": "table", "name": "T-06", "seats": 2, "zone": "main", "shape": "square", "x": w - 135,  "y": 340, "status": "available"},
        {"id": "t7", "type": "table", "name": "T-07", "seats": 4, "zone": "main", "shape": "round",  "x": 50,       "y": 520, "status": "available"},
        {"id": "t8", "type": "table", "name": "T-08", "seats": 4, "zone": "main", "shape": "round",  "x": cx - 50,  "y": 520, "status": "available"},
        {"id": "t9", "type": "table", "name": "T-09", "seats": 4, "zone": "main", "shape": "round",  "x": w - 150,  "y": 520, "status": "available"},
        {"id": "t10", "type": "table", "name": "T-10", "seats": 8, "zone": "main", "shape": "long",  "x": cx - 120, "y": 720, "status": "available"},
        {"id": "t11", "type": "table", "name": "T-11", "seats": 4, "zone": "main", "shape": "round", "x": 50,       "y": 720, "status": "available"},
    ]


def _pub_few_shot(w: int, h: int) -> str:
    return f"""Example: Pub dining {w/100:.0f}m × {h/100:.0f}m ({w}×{h}px). Bar dominates front, dining behind.
Pattern: Bar fixture at top centre. 3-column grid of tables below bar. Mix of 2-tops and 4-tops. One large 8-top long table for groups near back. ~50 covers."""


# ═══════════════════════════════════════════
# FAST FOOD — 5m × 10m (500 × 1000px)
# ═══════════════════════════════════════════

def _fastfood_layout(w: int, h: int) -> List[Dict]:
    cx = w // 2
    return [
        {"id": "f1", "type": "fixture", "fixtureKind": "bar",     "name": "Counter", "zone": "main", "x": cx - 80,  "y": 30,      "rotation": 0},
        {"id": "f2", "type": "fixture", "fixtureKind": "kitchen", "name": "Kitchen", "zone": "main", "x": cx - 65,  "y": h - 120, "rotation": 0},
        {"id": "f3", "type": "fixture", "fixtureKind": "toilets", "name": "Toilets", "zone": "main", "x": w - 100,  "y": h - 80,  "rotation": 0},
        # Dense seating below counter
        {"id": "t1", "type": "table", "name": "T-01", "seats": 2, "zone": "main", "shape": "square", "x": 40,       "y": 120, "status": "available"},
        {"id": "t2", "type": "table", "name": "T-02", "seats": 2, "zone": "main", "shape": "square", "x": w - 130,  "y": 120, "status": "available"},
        {"id": "t3", "type": "table", "name": "T-03", "seats": 4, "zone": "main", "shape": "square", "x": 40,       "y": 270, "status": "available"},
        {"id": "t4", "type": "table", "name": "T-04", "seats": 4, "zone": "main", "shape": "square", "x": w - 140,  "y": 270, "status": "available"},
        {"id": "t5", "type": "table", "name": "T-05", "seats": 4, "zone": "main", "shape": "long",   "x": cx - 85,  "y": 200, "status": "available"},
        {"id": "t6", "type": "table", "name": "T-06", "seats": 2, "zone": "main", "shape": "square", "x": 40,       "y": 420, "status": "available"},
        {"id": "t7", "type": "table", "name": "T-07", "seats": 4, "zone": "main", "shape": "square", "x": w - 140,  "y": 420, "status": "available"},
        {"id": "t8", "type": "table", "name": "T-08", "seats": 6, "zone": "main", "shape": "long",   "x": cx - 100, "y": 560, "status": "available"},
    ]


def _fastfood_few_shot(w: int, h: int) -> str:
    return f"""Example: Fast food {w/100:.0f}m × {h/100:.0f}m ({w}×{h}px). Counter at front, compact seating.
Pattern: Counter/ordering area at top. Dense 2-top and 4-top seating below. Long communal table at back. Tight spacing (~45px gaps) maximises covers."""


# ═══════════════════════════════════════════
# FINE DINING — 10m × 14m (1000 × 1400px)
# ═══════════════════════════════════════════

def _finedining_layout(w: int, h: int) -> List[Dict]:
    cx = w // 2
    return [
        {"id": "f1", "type": "fixture", "fixtureKind": "window",  "name": "Window",  "zone": "main", "x": 30,       "y": 20,      "rotation": 0},
        {"id": "f2", "type": "fixture", "fixtureKind": "window",  "name": "Window",  "zone": "main", "x": cx - 50,  "y": 20,      "rotation": 0},
        {"id": "f3", "type": "fixture", "fixtureKind": "window",  "name": "Window",  "zone": "main", "x": w - 130,  "y": 20,      "rotation": 0},
        {"id": "f4", "type": "fixture", "fixtureKind": "bar",     "name": "Bar",     "zone": "main", "x": 30,       "y": h - 80,  "rotation": 0},
        {"id": "f5", "type": "fixture", "fixtureKind": "kitchen", "name": "Kitchen", "zone": "main", "x": cx - 65,  "y": h - 120, "rotation": 0},
        {"id": "f6", "type": "fixture", "fixtureKind": "toilets", "name": "Toilets", "zone": "main", "x": w - 100,  "y": h - 80,  "rotation": 0},
        # Spacious fine dining — fewer tables, more space
        {"id": "t1",  "type": "table", "name": "T-01", "seats": 2, "zone": "main", "shape": "round",  "x": 60,       "y": 80,  "status": "available", "vip": True},
        {"id": "t2",  "type": "table", "name": "T-02", "seats": 2, "zone": "main", "shape": "round",  "x": cx - 42,  "y": 80,  "status": "available"},
        {"id": "t3",  "type": "table", "name": "T-03", "seats": 2, "zone": "main", "shape": "round",  "x": w - 145,  "y": 80,  "status": "available", "vip": True},
        {"id": "t4",  "type": "table", "name": "T-04", "seats": 4, "zone": "main", "shape": "round",  "x": 60,       "y": 320, "status": "available"},
        {"id": "t5",  "type": "table", "name": "T-05", "seats": 4, "zone": "main", "shape": "round",  "x": cx - 50,  "y": 320, "status": "available"},
        {"id": "t6",  "type": "table", "name": "T-06", "seats": 4, "zone": "main", "shape": "round",  "x": w - 150,  "y": 320, "status": "available"},
        {"id": "t7",  "type": "table", "name": "T-07", "seats": 2, "zone": "main", "shape": "round",  "x": 60,       "y": 560, "status": "available"},
        {"id": "t8",  "type": "table", "name": "T-08", "seats": 6, "zone": "main", "shape": "round",  "x": cx - 60,  "y": 560, "status": "available"},
        {"id": "t9",  "type": "table", "name": "T-09", "seats": 2, "zone": "main", "shape": "round",  "x": w - 145,  "y": 560, "status": "available"},
        {"id": "t10", "type": "table", "name": "T-10", "seats": 4, "zone": "main", "shape": "round",  "x": 60,       "y": 800, "status": "available"},
        {"id": "t11", "type": "table", "name": "T-11", "seats": 4, "zone": "main", "shape": "round",  "x": w - 150,  "y": 800, "status": "available"},
        {"id": "t12", "type": "table", "name": "T-12", "seats": 8, "zone": "main", "shape": "round",  "x": cx - 70,  "y": 800, "status": "available", "vip": True},
    ]


def _finedining_few_shot(w: int, h: int) -> str:
    return f"""Example: Fine dining {w/100:.0f}m × {h/100:.0f}m ({w}×{h}px). Spacious, elegant, 30-40 covers.
Pattern: Generous spacing (120px+ between tables). Window 2-tops at front (VIP). 4-tops in middle. One showcase 8-top for private dining. All round tables. Triple-wide service aisles. ~36 covers from 12 tables."""


# ═══════════════════════════════════════════
# GENERIC FALLBACK
# ═══════════════════════════════════════════

def _generic_layout(w: int, h: int) -> List[Dict]:
    """Generate a sensible default layout for any room size."""
    cx = w // 2
    elements = [
        {"id": "f1", "type": "fixture", "fixtureKind": "window",  "name": "Window",  "zone": "main", "x": 30,       "y": 20, "rotation": 0},
        {"id": "f2", "type": "fixture", "fixtureKind": "kitchen", "name": "Kitchen", "zone": "main", "x": cx - 65,  "y": h - 120, "rotation": 0},
    ]
    # Fill with rows of tables
    table_id = 1
    y = 80
    while y < h - 200:
        # Left
        elements.append({"id": f"t{table_id}", "type": "table", "name": f"T-{table_id:02d}", "seats": 2 if y < 200 else 4, "zone": "main", "shape": "square" if y < 200 else "round", "x": 50, "y": y, "status": "available"})
        table_id += 1
        # Centre (if room is wide enough)
        if w > 600:
            elements.append({"id": f"t{table_id}", "type": "table", "name": f"T-{table_id:02d}", "seats": 4, "zone": "main", "shape": "round", "x": cx - 50, "y": y, "status": "available"})
            table_id += 1
        # Right
        elements.append({"id": f"t{table_id}", "type": "table", "name": f"T-{table_id:02d}", "seats": 2 if y < 200 else 4, "zone": "main", "shape": "square" if y < 200 else "round", "x": w - 150, "y": y, "status": "available"})
        table_id += 1
        y += 180
    return elements


def _generic_few_shot(w: int, h: int) -> str:
    return f"""Example: {w/100:.0f}m × {h/100:.0f}m restaurant ({w}×{h}px).
Pattern: Windows at front (top). 2-tops near windows, 4-tops in centre rows, larger tables towards back. Kitchen at back. Service aisles between columns (~90px). Minimum 60px between table edges."""


# ═══════════════════════════════════════════
# REGISTRY
# ═══════════════════════════════════════════

PRESET_BUILDERS = {
    "small_cafe":    _cafe_layout,
    "bistro":        _bistro_layout,
    "mid_restaurant": _midsize_layout,
    "large_restaurant": _large_layout,
    "pub_dining":    _pub_layout,
    "fast_food":     _fastfood_layout,
    "fine_dining":   _finedining_layout,
}

FEW_SHOT_EXAMPLES = {
    "small_cafe":    _cafe_few_shot,
    "bistro":        _bistro_few_shot,
    "mid_restaurant": _midsize_few_shot,
    "large_restaurant": _large_few_shot,
    "pub_dining":    _pub_few_shot,
    "fast_food":     _fastfood_few_shot,
    "fine_dining":   _finedining_few_shot,
}
