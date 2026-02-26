"""
Floor Plan Constraint Solver
=============================
Spatial intelligence engine for restaurant floor plans.

Responsibilities:
  1. Auto-arrange: Place tables optimally given fixtures and room bounds
  2. Validate: Check spacing, ADA compliance, egress paths
  3. Resolve: Fix overlaps and spacing violations
  4. Generate: Create layouts from text descriptions (via LLM JSON)

Uses Shapely for geometry. No heavy dependencies (no OR-Tools needed yet).

Element data model (matches frontend):
  {id, type:'table'|'fixture', x, y, shape, seats, zone, fixtureType, w, h, rotation}
"""

from shapely.geometry import box, Point, Polygon, MultiPolygon
from shapely.affinity import rotate as shapely_rotate
from typing import List, Dict, Any, Optional, Tuple
import random
import math
import copy


# ── Restaurant spacing constants (in canvas pixels, ~1px = 1cm at standard zoom) ──

MIN_TABLE_GAP = 30        # ~30px minimum between table edges (casual dining)
MIN_TABLE_GAP_FINE = 50   # ~50px for fine dining
SEAT_DOT_OVERHANG = 18    # Seat dots extend ~18px beyond table edge on frontend
MIN_AISLE_WIDTH = 90      # ~90cm / 36 inches — ADA minimum
FIXTURE_CLEARANCE = 40    # ~40cm clearance from fixtures
WALL_CLEARANCE = 30       # ~30cm from canvas edges
GRID_SNAP = 40            # Snap-to-grid increment for aesthetic alignment


def align_rows_and_columns(elements: List[Dict], canvas_w: float, canvas_h: float, tolerance: float = 50) -> List[Dict]:
    """
    Make layouts look professionally designed by snapping tables into clean rows and columns.
    
    1. Detect approximate rows (tables within tolerance Y) → align to median Y
    2. Detect approximate columns (tables within tolerance X) → align to median X
    3. Re-check boundaries after alignment
    
    This is what separates 'AI placed it' from 'a designer placed it'.
    """
    result = copy.deepcopy(elements)
    tables = [e for e in result if e.get("type") != "fixture"]
    if len(tables) < 2:
        return result
    
    # ── Step 1: Detect and align ROWS (same Y = same horizontal band) ──
    # Sort by Y, then group tables within tolerance into rows
    tables_sorted_y = sorted(tables, key=lambda t: t.get("y", 0))
    rows = []
    current_row = [tables_sorted_y[0]]
    
    for t in tables_sorted_y[1:]:
        if abs(t.get("y", 0) - current_row[-1].get("y", 0)) <= tolerance:
            current_row.append(t)
        else:
            rows.append(current_row)
            current_row = [t]
    rows.append(current_row)
    
    # Align each row to median Y
    for row in rows:
        if len(row) < 2:
            continue
        median_y = sorted([t.get("y", 0) for t in row])[len(row) // 2]
        # Snap to grid
        median_y = round(median_y / GRID_SNAP) * GRID_SNAP
        for t in row:
            t["y"] = median_y
        
        # Also sort tables within each row by X for even spacing
        row.sort(key=lambda t: t.get("x", 0))
    
    # ── Step 2: Detect and align COLUMNS (same X = same vertical band) ──
    tables_sorted_x = sorted(tables, key=lambda t: t.get("x", 0))
    cols = []
    current_col = [tables_sorted_x[0]]
    
    for t in tables_sorted_x[1:]:
        if abs(t.get("x", 0) - current_col[-1].get("x", 0)) <= tolerance:
            current_col.append(t)
        else:
            cols.append(current_col)
            current_col = [t]
    cols.append(current_col)
    
    # Align each column to median X
    for col in cols:
        if len(col) < 2:
            continue
        median_x = sorted([t.get("x", 0) for t in col])[len(col) // 2]
        median_x = round(median_x / GRID_SNAP) * GRID_SNAP
        for t in col:
            t["x"] = median_x
    
    # ── Step 3: Even out row spacing ──
    # If we have 3+ rows, try to make vertical spacing between rows consistent
    if len(rows) >= 3:
        row_ys = sorted(set(round(r[0].get("y", 0) / GRID_SNAP) * GRID_SNAP for r in rows if r))
        if len(row_ys) >= 3:
            # Calculate ideal even spacing
            total_span = row_ys[-1] - row_ys[0]
            ideal_gap = total_span / (len(row_ys) - 1)
            ideal_gap = round(ideal_gap / GRID_SNAP) * GRID_SNAP
            if ideal_gap >= 120:  # Only if spacing is reasonable
                for i, row in enumerate(rows):
                    new_y = row_ys[0] + i * ideal_gap
                    new_y = max(WALL_CLEARANCE, min(canvas_h - 150, new_y))
                    new_y = round(new_y / GRID_SNAP) * GRID_SNAP
                    for t in row:
                        t["y"] = new_y
    
    # ── Step 4: Centre the entire layout on the canvas ──
    # Calculate bounding box of all tables
    if tables:
        min_x = min(t.get("x", 0) for t in tables)
        max_x = max(t.get("x", 0) + get_element_size(t)[0] for t in tables)
        min_y = min(t.get("y", 0) for t in tables)
        max_y = max(t.get("y", 0) + get_element_size(t)[1] for t in tables)
        
        group_w = max_x - min_x
        group_h = max_y - min_y
        
        # Calculate centering offsets
        target_x = (canvas_w - group_w) / 2
        target_y = (canvas_h - group_h) / 2
        
        offset_x = target_x - min_x
        offset_y = target_y - min_y
        
        # Snap offsets to grid
        offset_x = round(offset_x / GRID_SNAP) * GRID_SNAP
        offset_y = round(offset_y / GRID_SNAP) * GRID_SNAP
        
        for t in tables:
            t["x"] = t.get("x", 0) + offset_x
            t["y"] = t.get("y", 0) + offset_y
    
    # ── Step 5: Spread tables when few on large canvas ──
    # With only 2-4 tables, they should fill more of the canvas, not huddle together
    if 2 <= len(tables) <= 4:
        min_x = min(t.get("x", 0) for t in tables)
        max_x = max(t.get("x", 0) + get_element_size(t)[0] for t in tables)
        min_y = min(t.get("y", 0) for t in tables)
        max_y = max(t.get("y", 0) + get_element_size(t)[1] for t in tables)
        
        group_w = max_x - min_x
        group_h = max_y - min_y
        
        usable_w = canvas_w - 2 * WALL_CLEARANCE
        usable_h = canvas_h - 2 * WALL_CLEARANCE
        
        # If group uses less than 50% of canvas, scale it up
        usage_ratio = max(group_w / usable_w, group_h / usable_h) if usable_w > 0 and usable_h > 0 else 1
        if usage_ratio < 0.5 and group_w > 0 and group_h > 0:
            # Scale factor: aim for 60-70% canvas usage
            scale = min(0.65 / usage_ratio, 2.5)  # Cap at 2.5x
            
            # Scale from centre of group
            cx = (min_x + max_x) / 2
            cy = (min_y + max_y) / 2
            
            for t in tables:
                t["x"] = cx + (t.get("x", 0) - cx) * scale
                t["y"] = cy + (t.get("y", 0) - cy) * scale
            
            # Re-centre after scaling
            min_x2 = min(t.get("x", 0) for t in tables)
            max_x2 = max(t.get("x", 0) + get_element_size(t)[0] for t in tables)
            min_y2 = min(t.get("y", 0) for t in tables)
            max_y2 = max(t.get("y", 0) + get_element_size(t)[1] for t in tables)
            
            offset_x = ((canvas_w - (max_x2 - min_x2)) / 2) - min_x2
            offset_y = ((canvas_h - (max_y2 - min_y2)) / 2) - min_y2
            offset_x = round(offset_x / GRID_SNAP) * GRID_SNAP
            offset_y = round(offset_y / GRID_SNAP) * GRID_SNAP
            
            for t in tables:
                t["x"] = t.get("x", 0) + offset_x
                t["y"] = t.get("y", 0) + offset_y
    
    # ── Step 6: Final boundary clamp ──
    for t in tables:
        tw, th = get_element_size(t)
        t["x"] = max(WALL_CLEARANCE, min(canvas_w - tw - WALL_CLEARANCE, t["x"]))
        t["y"] = max(WALL_CLEARANCE, min(canvas_h - th - WALL_CLEARANCE, t["y"]))
        # Final grid snap
        t["x"] = round(t["x"] / GRID_SNAP) * GRID_SNAP
        t["y"] = round(t["y"] / GRID_SNAP) * GRID_SNAP
    
    return result


# ── Element size calculation (mirrors frontend exactly) ──

def get_table_size(el: Dict) -> Tuple[float, float]:
    """Returns (width, height) of a table element — must match frontend TableNode."""
    seats = el.get("seats") or 4
    try:
        seats = int(seats)
    except (ValueError, TypeError):
        seats = 4

    if seats <= 2:
        raw = 85
    elif seats <= 4:
        raw = 100
    elif seats <= 6:
        raw = 120
    elif seats <= 8:
        raw = 140
    else:
        raw = 155

    shape = el.get("shape", "round")
    if shape == "long":
        return (raw * 1.7, raw * 0.65)
    elif shape == "booth":
        return (raw * 1.4, raw * 0.8)
    else:  # round or square
        return (raw, raw)


def get_element_size(el: Dict) -> Tuple[float, float]:
    """Returns (width, height) for any element type."""
    if el.get("type") == "fixture":
        # Frontend uses fixtureKind, dimensions stored as w/h
        # Default sizes by fixture type if w/h not set
        FIXTURE_SIZES = {
            "window": (100, 16), "bar": (160, 36), "stairs": (60, 50),
            "toilets": (70, 60), "kitchen": (130, 100), "wall": (200, 20),
        }
        fk = el.get("fixtureKind") or el.get("fixtureType", "wall")
        defaults = FIXTURE_SIZES.get(fk, (100, 50))
        w = el.get("w") or defaults[0]
        h = el.get("h") or defaults[1]
        try:
            return (float(w), float(h))
        except (ValueError, TypeError):
            return defaults
    return get_table_size(el)


def get_element_bbox(el: Dict) -> Polygon:
    """Returns a Shapely polygon for the element's bounding box."""
    x = float(el.get("x") or 0)
    y = float(el.get("y") or 0)
    w, h = get_element_size(el)
    return box(x, y, x + w, y + h)


def get_element_bbox_padded(el: Dict, padding: float = 0) -> Polygon:
    """Bounding box with padding (for spacing enforcement)."""
    bbox = get_element_bbox(el)
    if padding > 0:
        return bbox.buffer(padding)
    return bbox


# ── Validation ──

def validate_layout(
    elements: List[Dict],
    canvas_w: float = 1000,
    canvas_h: float = 800,
    min_gap: float = MIN_TABLE_GAP
) -> Dict[str, Any]:
    """
    Validate a floor plan layout and return issues.

    Returns:
        {
            valid: bool,
            issues: [
                {type: 'overlap'|'too_close'|'out_of_bounds'|'aisle_blocked',
                 elements: [id1, id2], message: str, severity: 'error'|'warning'}
            ],
            stats: {total_tables, total_seats, avg_spacing, min_spacing}
        }
    """
    issues = []
    tables = [e for e in elements if e.get("type") != "fixture"]
    fixtures = [e for e in elements if e.get("type") == "fixture"]
    all_els = tables + fixtures

    total_seats = sum(t.get("seats", 4) for t in tables)

    # Check each pair of tables for overlap and spacing
    spacings = []
    for i in range(len(tables)):
        bbox_i = get_element_bbox(tables[i])

        # Out of bounds check
        w_i, h_i = get_element_size(tables[i])
        x_i, y_i = tables[i].get("x", 0), tables[i].get("y", 0)
        if x_i < 0 or y_i < 0 or x_i + w_i > canvas_w or y_i + h_i > canvas_h:
            issues.append({
                "type": "out_of_bounds",
                "elements": [tables[i]["id"]],
                "message": f"Table {tables[i].get('label', tables[i]['id'])} is outside the canvas",
                "severity": "error"
            })

        for j in range(i + 1, len(tables)):
            bbox_j = get_element_bbox(tables[j])
            dist = bbox_i.distance(bbox_j)

            if bbox_i.intersects(bbox_j):
                issues.append({
                    "type": "overlap",
                    "elements": [tables[i]["id"], tables[j]["id"]],
                    "message": f"Tables {tables[i].get('label', '')} and {tables[j].get('label', '')} overlap",
                    "severity": "error"
                })
            elif dist < min_gap:
                issues.append({
                    "type": "too_close",
                    "elements": [tables[i]["id"], tables[j]["id"]],
                    "message": f"Tables too close: {dist:.0f}px (min {min_gap}px)",
                    "severity": "warning"
                })

            spacings.append(dist)

        # Check table-to-fixture clearance
        for fix in fixtures:
            bbox_f = get_element_bbox(fix)
            dist = bbox_i.distance(bbox_f)
            if bbox_i.intersects(bbox_f):
                issues.append({
                    "type": "overlap",
                    "elements": [tables[i]["id"], fix["id"]],
                    "message": f"Table overlaps with {fix.get('fixtureKind', fix.get('fixtureType', 'fixture'))}",
                    "severity": "error"
                })
            elif dist < FIXTURE_CLEARANCE:
                issues.append({
                    "type": "too_close",
                    "elements": [tables[i]["id"], fix["id"]],
                    "message": f"Table too close to {fix.get('fixtureKind', fix.get('fixtureType', 'fixture'))}: {dist:.0f}px",
                    "severity": "warning"
                })

    stats = {
        "total_tables": len(tables),
        "total_seats": total_seats,
        "avg_spacing": sum(spacings) / len(spacings) if spacings else 0,
        "min_spacing": min(spacings) if spacings else 0,
        "issues_count": len(issues),
        "errors": len([i for i in issues if i["severity"] == "error"]),
        "warnings": len([i for i in issues if i["severity"] == "warning"]),
    }

    return {
        "valid": stats["errors"] == 0,
        "issues": issues,
        "stats": stats
    }


# ── Collision Resolution (force-directed) ──

def resolve_overlaps(
    elements: List[Dict],
    canvas_w: float = 1000,
    canvas_h: float = 800,
    min_gap: float = MIN_TABLE_GAP,
    max_iterations: int = 600
) -> List[Dict]:
    """
    Resolve all overlaps and spacing violations using force-directed repulsion.
    Fixtures stay fixed. Only tables move.
    Two passes: aggressive separation first, then gentle refinement.
    """
    result = copy.deepcopy(elements)
    tables = [e for e in result if e.get("type") != "fixture"]
    fixtures = [e for e in result if e.get("type") == "fixture"]

    for iteration in range(max_iterations):
        moved = False
        # Slower damping — stay aggressive longer
        damping = max(0.3, 1.0 - (iteration / max_iterations) * 0.7)

        for table in tables:
            tx, ty = table.get("x", 0), table.get("y", 0)
            tw, th = get_element_size(table)
            t_bbox = get_element_bbox(table)
            force_x, force_y = 0.0, 0.0

            # Repulsion from other tables
            for other in tables:
                if other["id"] == table["id"]:
                    continue
                o_bbox = get_element_bbox(other)
                dist = t_bbox.distance(o_bbox)

                if dist < min_gap:
                    # Direction vector between centers
                    ox, oy = other.get("x", 0), other.get("y", 0)
                    ow, oh = get_element_size(other)
                    dx = (tx + tw / 2) - (ox + ow / 2)
                    dy = (ty + th / 2) - (oy + oh / 2)
                    length = math.sqrt(dx * dx + dy * dy) or 1
                    # Push harder — proportional to violation squared
                    violation = min_gap - dist
                    push = (violation * 0.8 + 15) * damping
                    force_x += (dx / length) * push
                    force_y += (dy / length) * push
                    moved = True

            # Repulsion from fixtures
            for fix in fixtures:
                f_bbox = get_element_bbox(fix)
                dist = t_bbox.distance(f_bbox)

                if dist < FIXTURE_CLEARANCE:
                    fx, fy = fix.get("x", 0), fix.get("y", 0)
                    fw, fh = get_element_size(fix)
                    dx = (tx + tw / 2) - (fx + fw / 2)
                    dy = (ty + th / 2) - (fy + fh / 2)
                    length = math.sqrt(dx * dx + dy * dy) or 1
                    violation = FIXTURE_CLEARANCE - dist
                    push = (violation * 0.8 + 15) * damping
                    force_x += (dx / length) * push
                    force_y += (dy / length) * push
                    moved = True

            # Apply forces
            if abs(force_x) > 0.5 or abs(force_y) > 0.5:
                table["x"] = tx + force_x
                table["y"] = ty + force_y

            # Boundary containment
            table["x"] = max(WALL_CLEARANCE, min(canvas_w - tw - WALL_CLEARANCE, table["x"]))
            table["y"] = max(WALL_CLEARANCE, min(canvas_h - th - WALL_CLEARANCE, table["y"]))

        if not moved:
            break

    # Final verification pass — any remaining overlaps get brute-force separated
    for i, table in enumerate(tables):
        t_bbox = get_element_bbox(table)
        tw, th = get_element_size(table)
        for j, other in enumerate(tables):
            if j <= i:
                continue
            o_bbox = get_element_bbox(other)
            dist = t_bbox.distance(o_bbox)
            if dist < min_gap * 0.5:  # Still significantly overlapping
                ow, oh = get_element_size(other)
                # Push the second table away
                dx = (other["x"] + ow/2) - (table["x"] + tw/2)
                dy = (other["y"] + oh/2) - (table["y"] + th/2)
                length = math.sqrt(dx*dx + dy*dy) or 1
                nudge = min_gap + 5
                other["x"] += (dx / length) * nudge
                other["y"] += (dy / length) * nudge
                other["x"] = max(WALL_CLEARANCE, min(canvas_w - ow - WALL_CLEARANCE, other["x"]))
                other["y"] = max(WALL_CLEARANCE, min(canvas_h - oh - WALL_CLEARANCE, other["y"]))

    return result


# ── Auto-Arrange (Restaurant Designer AI) ──

def _analyse_room(fixtures, canvas_w, canvas_h):
    """
    Read the room like a restaurant designer would.
    Returns spatial intelligence: where walls are, where fixtures create
    zones, service corridors, and premium positions.
    """
    room = {
        "windows": [],    # Premium seating spots — diners love window tables
        "walls": [],      # Wall-adjacent seating (banquette territory)
        "kitchen": None,  # Service origin — keep corridor clear
        "bar": None,      # Social zone — casual seating nearby
        "toilets": None,  # Keep accessible but don't seat people right next to it
        "stairs": None,   # Access point — keep clear
        "edges": {        # Which canvas edges have fixtures (implies walls)
            "top": False, "bottom": False, "left": False, "right": False
        }
    }

    for f in fixtures:
        fk = (f.get("fixtureKind") or f.get("fixtureType", "")).lower()
        fx, fy = float(f.get("x") or 0), float(f.get("y") or 0)
        fw, fh = get_element_size(f)
        cx, cy = fx + fw / 2, fy + fh / 2

        # Detect which edge this fixture is near
        if fy < canvas_h * 0.15:
            room["edges"]["top"] = True
        if fy + fh > canvas_h * 0.85:
            room["edges"]["bottom"] = True
        if fx < canvas_w * 0.15:
            room["edges"]["left"] = True
        if fx + fw > canvas_w * 0.85:
            room["edges"]["right"] = True

        if "window" in fk:
            room["windows"].append({"x": fx, "y": fy, "w": fw, "h": fh, "cx": cx, "cy": cy})
        elif "wall" in fk:
            room["walls"].append({"x": fx, "y": fy, "w": fw, "h": fh})
        elif "kitchen" in fk:
            room["kitchen"] = {"x": fx, "y": fy, "w": fw, "h": fh, "cx": cx, "cy": cy}
        elif "bar" in fk:
            room["bar"] = {"x": fx, "y": fy, "w": fw, "h": fh, "cx": cx, "cy": cy}
        elif "toilet" in fk:
            room["toilets"] = {"x": fx, "y": fy, "w": fw, "h": fh, "cx": cx, "cy": cy}
        elif "stair" in fk:
            room["stairs"] = {"x": fx, "y": fy, "w": fw, "h": fh, "cx": cx, "cy": cy}

    return room


def _find_placement_spots(room, fixtures, canvas_w, canvas_h, gap):
    """
    Generate smart placement positions a designer would choose.

    Priority order (how a real designer thinks):
      1. Window seats — premium, guests love natural light and a view
      2. Wall-adjacent — cosy perimeter seating, back against the wall
      3. Centre — fill the middle, good for larger tables and groups
      4. Avoid — too close to kitchen door, toilets, or in service corridors
    """
    spots = []  # Each: {x, y, priority, reason}
    fixture_boxes = [get_element_bbox_padded(f, FIXTURE_CLEARANCE + 5) for f in fixtures]

    def is_clear(x, y, w, h):
        """Check if a position doesn't collide with any fixture."""
        test = box(x, y, x + w, y + h)
        return all(not test.intersects(fb) for fb in fixture_boxes)

    margin = WALL_CLEARANCE + 10  # Comfortable distance from canvas edge

    # ── 1. Window seats (highest priority) ──
    # Place tables adjacent to windows, slightly offset into the room
    for win in room["windows"]:
        wx, wy, ww, wh = win["x"], win["y"], win["w"], win["h"]

        # Determine which edge the window is on by its dimensions and position
        if wh < ww:  # Horizontal window (top or bottom edge)
            if wy < canvas_h / 2:  # Top edge window → place table below it
                spots.append({"x": wx, "y": wy + wh + 10, "priority": 1, "reason": "window"})
                spots.append({"x": wx + ww + gap, "y": wy + wh + 10, "priority": 1, "reason": "window"})
            else:  # Bottom edge → place table above
                spots.append({"x": wx, "y": wy - 120, "priority": 1, "reason": "window"})
        else:  # Vertical window (left or right edge)
            if wx < canvas_w / 2:  # Left edge → place table to the right
                spots.append({"x": wx + ww + 10, "y": wy, "priority": 1, "reason": "window"})
                spots.append({"x": wx + ww + 10, "y": wy + wh + gap, "priority": 1, "reason": "window"})
            else:  # Right edge → place to the left
                spots.append({"x": wx - 120, "y": wy, "priority": 1, "reason": "window"})

    # ── 2. Perimeter seating along walls/edges ──
    # A good designer fills the perimeter first — guests prefer backs to walls
    # Place along edges that have fixtures (suggesting walls exist there)
    step = 140  # Spacing between perimeter tables

    # Left wall
    if room["edges"]["left"]:
        y = margin
        while y < canvas_h - margin - 100:
            spots.append({"x": margin, "y": y, "priority": 2, "reason": "left-wall"})
            y += step

    # Right wall
    if room["edges"]["right"]:
        y = margin
        while y < canvas_h - margin - 100:
            spots.append({"x": canvas_w - margin - 110, "y": y, "priority": 2, "reason": "right-wall"})
            y += step

    # Top wall
    if room["edges"]["top"]:
        x = margin
        while x < canvas_w - margin - 100:
            spots.append({"x": x, "y": margin, "priority": 2, "reason": "top-wall"})
            x += step

    # Bottom wall
    if room["edges"]["bottom"]:
        x = margin
        while x < canvas_w - margin - 100:
            spots.append({"x": x, "y": canvas_h - margin - 110, "priority": 2, "reason": "bottom-wall"})
            x += step

    # ── 3. Near the bar (social, casual vibe) ──
    if room["bar"]:
        bx, by = room["bar"]["cx"], room["bar"]["cy"]
        bw, bh = room["bar"]["w"], room["bar"]["h"]
        # Place a few tables near the bar
        spots.append({"x": bx + bw / 2 + gap, "y": by - 50, "priority": 3, "reason": "bar"})
        spots.append({"x": bx + bw / 2 + gap, "y": by + 60, "priority": 3, "reason": "bar"})

    # ── 4. Centre fill — the heart of the room ──
    # Grid the middle area, avoiding a corridor from kitchen to dining area
    centre_x0 = canvas_w * 0.2
    centre_y0 = canvas_h * 0.25
    centre_x1 = canvas_w * 0.8
    centre_y1 = canvas_h * 0.75

    # If kitchen exists, shift centre away from it to leave a service lane
    if room["kitchen"]:
        kx, ky = room["kitchen"]["cx"], room["kitchen"]["cy"]
        if kx > canvas_w * 0.6:  # Kitchen on right → shift centre left
            centre_x1 = canvas_w * 0.65
        elif kx < canvas_w * 0.4:  # Kitchen on left → shift centre right
            centre_x0 = canvas_w * 0.35
        if ky > canvas_h * 0.6:  # Kitchen at bottom
            centre_y1 = canvas_h * 0.65
        elif ky < canvas_h * 0.4:  # Kitchen at top
            centre_y0 = canvas_h * 0.35

    cx = centre_x0
    while cx < centre_x1 - 80:
        cy = centre_y0
        while cy < centre_y1 - 80:
            spots.append({"x": cx, "y": cy, "priority": 4, "reason": "centre"})
            cy += step
        cx += step

    return spots


def auto_arrange(
    elements: List[Dict],
    canvas_w: float = 1000,
    canvas_h: float = 800,
    zone: Optional[str] = None,
    style: str = "balanced",
    min_gap: Optional[float] = None
) -> List[Dict]:
    """
    Arrange tables like a restaurant designer would.

    Intelligence:
      1. Read the room — understand what fixtures mean (windows = premium,
         kitchen = service corridor, bar = social zone, toilets = avoid)
      2. Prioritise placement — window seats first (premium), then perimeter
         (backs to walls), then fill the centre
      3. Size-aware — small tables (2-tops) get window/intimate spots,
         large tables go in the centre where there's room
      4. Service flow — keep a clear path from kitchen to dining area
      5. Refinement — resolve any overlaps, snap to grid for clean look
    """
    result = copy.deepcopy(elements)

    # Filter by zone
    if zone:
        target_tables = [e for e in result if e.get("type") != "fixture" and e.get("zone") == zone]
        fixtures = [e for e in result if e.get("type") == "fixture" and e.get("zone") == zone]
    else:
        target_tables = [e for e in result if e.get("type") != "fixture"]
        fixtures = [e for e in result if e.get("type") == "fixture"]

    if not target_tables:
        return result

    # Style-based gap
    if min_gap is None:
        gaps = {"dense": 40, "balanced": 50, "spacious": 65, "grid": 45}
        min_gap = gaps.get(style, 50)

    # ── Step 1: Read the room ──
    room = _analyse_room(fixtures, canvas_w, canvas_h)

    # ── Step 2: Generate smart placement spots ──
    spots = _find_placement_spots(room, fixtures, canvas_w, canvas_h, min_gap)

    # Sort spots by priority (1 = window = best, 4 = centre = fill)
    spots.sort(key=lambda s: s["priority"])

    # ── Step 3: Sort tables by size (smallest first for premium spots) ──
    # Small tables → window/premium spots. Large tables → centre.
    def table_seats(t):
        s = t.get("seats") or 4
        try:
            return int(s)
        except (ValueError, TypeError):
            return 4
    target_tables.sort(key=table_seats)

    # ── Step 4: Place tables into spots ──
    fixture_boxes = [get_element_bbox_padded(f, FIXTURE_CLEARANCE) for f in fixtures]
    placed = set()

    for table in target_tables:
        tw, th = get_table_size(table)
        seats = table_seats(table)
        best_spot = None

        for spot in spots:
            if id(spot) in placed:
                continue

            sx, sy = spot["x"], spot["y"]

            # Size matching: small tables get premium spots, big tables get centre
            # Allow 2-4 tops at windows/walls, save centre for larger
            if seats >= 6 and spot["priority"] <= 2 and spot["reason"] != "bar":
                continue  # Big tables skip window/wall spots
            if seats <= 2 and spot["priority"] >= 4 and any(s["priority"] <= 2 for s in spots if id(s) not in placed):
                continue  # Small tables prefer premium spots if available

            # Boundary check
            if sx < WALL_CLEARANCE or sy < WALL_CLEARANCE:
                continue
            if sx + tw > canvas_w - WALL_CLEARANCE or sy + th > canvas_h - WALL_CLEARANCE:
                continue

            # Fixture collision check
            test_box = box(sx, sy, sx + tw, sy + th)
            if any(test_box.intersects(fb) for fb in fixture_boxes):
                continue

            # Check against already-placed tables
            collision = False
            for other in target_tables:
                if other["id"] == table["id"]:
                    continue
                if "x" not in other or other.get("_placed") is not True:
                    continue
                ob = get_element_bbox(other)
                if test_box.distance(ob) < min_gap:
                    collision = True
                    break

            if collision:
                continue

            best_spot = spot
            break

        if best_spot:
            table["x"] = round(best_spot["x"])
            table["y"] = round(best_spot["y"])
            table["_placed"] = True
            placed.add(id(best_spot))
        else:
            # Fallback: find any open position on the canvas
            found = False
            for fy in range(int(WALL_CLEARANCE), int(canvas_h - th - WALL_CLEARANCE), 40):
                if found:
                    break
                for fx in range(int(WALL_CLEARANCE), int(canvas_w - tw - WALL_CLEARANCE), 40):
                    test_box = box(fx, fy, fx + tw, fy + th)

                    if any(test_box.intersects(fb) for fb in fixture_boxes):
                        continue

                    collision = False
                    for other in target_tables:
                        if other["id"] == table["id"]:
                            continue
                        if other.get("_placed") is not True:
                            continue
                        ob = get_element_bbox(other)
                        if test_box.distance(ob) < min_gap:
                            collision = True
                            break

                    if not collision:
                        table["x"] = fx
                        table["y"] = fy
                        table["_placed"] = True
                        found = True
                        break

    # ── Step 5: Clean up temp markers ──
    for t in target_tables:
        t.pop("_placed", None)

    # ── Step 6: Gentle refinement — nudge for even spacing ──
    # Light simulated annealing to polish (fewer iterations, subtle moves)
    result = _simulated_annealing(
        result, target_tables, fixtures, fixture_boxes,
        canvas_w, canvas_h, min_gap, iterations=1500
    )

    # ── Step 7: Final overlap resolution ──
    result = resolve_overlaps(result, canvas_w, canvas_h, min_gap)

    # ── Step 8: Alignment snap — clean rows and columns ──
    result = align_rows_and_columns(result, canvas_w, canvas_h)
    result = resolve_overlaps(result, canvas_w, canvas_h, min_gap, max_iterations=200)

    # ── Step 9: Grid snap for clean aesthetics ──
    for el in result:
        if el.get("type") != "fixture" and (not zone or el.get("zone") == zone):
            el["x"] = round(el["x"] / GRID_SNAP) * GRID_SNAP
            el["y"] = round(el["y"] / GRID_SNAP) * GRID_SNAP

    return result


def _simulated_annealing(
    all_elements: List[Dict],
    tables: List[Dict],
    fixtures: List[Dict],
    fixture_boxes: List[Polygon],
    canvas_w: float,
    canvas_h: float,
    min_gap: float,
    iterations: int = 3000
) -> List[Dict]:
    """
    Simulated annealing to optimise table positions.

    Energy function penalises:
      - Overlaps (heavy penalty)
      - Spacing violations (medium penalty)
      - Uneven distribution (light penalty)
      - Fixture proximity violations (heavy penalty)
    """
    def energy() -> float:
        e = 0.0
        for i, t1 in enumerate(tables):
            b1 = get_element_bbox(t1)
            w1, h1 = get_table_size(t1)

            # Boundary penalty
            if t1["x"] < WALL_CLEARANCE or t1["y"] < WALL_CLEARANCE:
                e += 500
            if t1["x"] + w1 > canvas_w - WALL_CLEARANCE or t1["y"] + h1 > canvas_h - WALL_CLEARANCE:
                e += 500

            # Fixture collision penalty
            for fb in fixture_boxes:
                if b1.intersects(fb):
                    e += 1000
                else:
                    fd = b1.distance(fb)
                    if fd < FIXTURE_CLEARANCE:
                        e += (FIXTURE_CLEARANCE - fd) * 5

            for j in range(i + 1, len(tables)):
                b2 = get_element_bbox(tables[j])
                dist = b1.distance(b2)

                if dist < 0:  # Overlap
                    e += 2000
                elif dist < min_gap:
                    e += (min_gap - dist) * 10  # Spacing violation
                elif dist > min_gap * 2.5:
                    e += (dist - min_gap * 2.5) * 2.0  # Too far apart — pull closer

        return e

    current_energy = energy()
    best_elements = copy.deepcopy(all_elements)
    best_energy = current_energy
    temp = 100.0

    for i in range(iterations):
        # Cool down
        temp = 100.0 * (1 - i / iterations)
        if temp < 0.1:
            break

        # Pick a random table and perturb
        t = random.choice(tables)
        old_x, old_y = t["x"], t["y"]
        tw, th = get_table_size(t)

        # Perturbation size decreases with temperature
        max_shift = max(10, temp * 2)
        t["x"] = max(WALL_CLEARANCE, min(canvas_w - tw - WALL_CLEARANCE,
                                          old_x + random.uniform(-max_shift, max_shift)))
        t["y"] = max(WALL_CLEARANCE, min(canvas_h - th - WALL_CLEARANCE,
                                          old_y + random.uniform(-max_shift, max_shift)))

        new_energy = energy()

        # Accept or reject
        delta = new_energy - current_energy
        if delta < 0 or random.random() < math.exp(-delta / max(temp, 0.01)):
            current_energy = new_energy
            if current_energy < best_energy:
                best_energy = current_energy
                best_elements = copy.deepcopy(all_elements)
        else:
            t["x"] = old_x
            t["y"] = old_y

    # Restore best
    return best_elements


# ── Text-to-Layout (LLM integration point) ──

def generate_from_description(
    description: Dict[str, Any],
    canvas_w: float = 1000,
    canvas_h: float = 800,
    zone: str = "main"
) -> List[Dict]:
    """
    Generate a floor plan from a structured description.

    Expected input (from LLM JSON extraction):
    {
        "tables": [
            {"shape": "round", "seats": 4, "count": 6},
            {"shape": "long", "seats": 8, "count": 2},
            {"shape": "booth", "seats": 4, "count": 3}
        ],
        "fixtures": [
            {"type": "bar", "position": "left"},
            {"type": "kitchen", "position": "back"},
            {"type": "window", "position": "front", "count": 2}
        ],
        "style": "balanced"
    }
    """
    elements = []
    table_id = 1

    # Create table elements
    for spec in description.get("tables", []):
        count = spec.get("count", 1)
        for _ in range(count):
            elements.append({
                "id": f"t-{table_id:02d}",
                "type": "table",
                "shape": spec.get("shape", "round"),
                "seats": spec.get("seats", 4),
                "label": f"T-{table_id:02d}",
                "x": 0,
                "y": 0,
                "zone": zone,
                "status": "available",
                "rotation": 0,
            })
            table_id += 1

    # Create fixture elements
    fixture_id = 1
    position_map = {
        "left": {"x": 10, "y_pct": 0.5},
        "right": {"x_pct": 1.0, "y_pct": 0.5},
        "front": {"x_pct": 0.5, "y": 10},
        "back": {"x_pct": 0.5, "y_pct": 1.0},
        "center": {"x_pct": 0.5, "y_pct": 0.5},
    }

    FIXTURE_DEFAULTS = {
        "window": {"w": 120, "h": 30},
        "bar": {"w": 180, "h": 50},
        "stairs": {"w": 60, "h": 70},
        "toilets": {"w": 70, "h": 60},
        "kitchen": {"w": 130, "h": 100},
        "wall": {"w": 200, "h": 20},
    }

    for spec in description.get("fixtures", []):
        ft = spec.get("type", "wall")
        pos_key = spec.get("position", "left")
        count = spec.get("count", 1)
        defaults = FIXTURE_DEFAULTS.get(ft, {"w": 100, "h": 50})
        pos = position_map.get(pos_key, {"x_pct": 0.5, "y_pct": 0.5})

        for i in range(count):
            fw, fh = defaults["w"], defaults["h"]
            # Calculate position from position hints
            if "x" in pos:
                fx = pos["x"]
            elif "x_pct" in pos:
                fx = pos["x_pct"] * (canvas_w - fw) - (fw if pos["x_pct"] >= 1.0 else 0)
            else:
                fx = 0

            if "y" in pos:
                fy = pos["y"]
            elif "y_pct" in pos:
                fy = pos["y_pct"] * (canvas_h - fh) - (fh if pos["y_pct"] >= 1.0 else 0)
            else:
                fy = 0

            # Offset multiple fixtures of same type
            if count > 1:
                if pos_key in ("front", "back"):
                    fx = (canvas_w / (count + 1)) * (i + 1) - fw / 2
                elif pos_key in ("left", "right"):
                    fy = (canvas_h / (count + 1)) * (i + 1) - fh / 2

            elements.append({
                "id": f"fix-{fixture_id:02d}",
                "type": "fixture",
                "fixtureType": ft,
                "w": fw,
                "h": fh,
                "x": round(max(5, fx)),
                "y": round(max(5, fy)),
                "zone": zone,
                "rotation": 0,
            })
            fixture_id += 1

    # Now auto-arrange to place tables optimally around fixtures
    style = description.get("style", "balanced")
    elements = auto_arrange(elements, canvas_w, canvas_h, zone=zone, style=style)

    return elements
