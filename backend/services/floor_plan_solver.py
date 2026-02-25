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
MIN_AISLE_WIDTH = 90      # ~90cm / 36 inches — ADA minimum
FIXTURE_CLEARANCE = 40    # ~40cm clearance from fixtures
WALL_CLEARANCE = 30       # ~30cm from canvas edges
GRID_SNAP = 20            # Snap-to-grid increment for aesthetic alignment


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
    max_iterations: int = 200
) -> List[Dict]:
    """
    Resolve all overlaps and spacing violations using force-directed repulsion.
    Fixtures stay fixed. Only tables move.
    """
    result = copy.deepcopy(elements)
    tables = [e for e in result if e.get("type") != "fixture"]
    fixtures = [e for e in result if e.get("type") == "fixture"]

    for iteration in range(max_iterations):
        moved = False

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
                    # Push proportional to violation
                    push = (min_gap - dist + 5) * 0.3
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
                    push = (FIXTURE_CLEARANCE - dist + 5) * 0.4
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

    return result


# ── Auto-Arrange (the main algorithm) ──

def auto_arrange(
    elements: List[Dict],
    canvas_w: float = 1000,
    canvas_h: float = 800,
    zone: Optional[str] = None,
    style: str = "balanced",  # 'balanced', 'dense', 'spacious', 'grid'
    min_gap: Optional[float] = None
) -> List[Dict]:
    """
    Automatically arrange tables on the floor plan.

    Algorithm:
      1. Separate fixtures (immovable) and tables (moveable)
      2. Compute available space (canvas minus fixture zones)
      3. Initial placement using intelligent grid
      4. Optimise with simulated annealing
      5. Final overlap resolution pass
      6. Snap to grid for clean aesthetics

    Args:
        elements: Current element list
        canvas_w/h: Canvas dimensions
        zone: Only arrange elements in this zone (None = all)
        style: Layout style preference
        min_gap: Override minimum table gap

    Returns:
        Updated elements list with new x/y positions (only tables moved)
    """
    result = copy.deepcopy(elements)

    # Filter by zone if specified
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
        gaps = {"dense": 25, "balanced": 35, "spacious": 55, "grid": 30}
        min_gap = gaps.get(style, 35)

    # ── Step 1: Compute available space ──
    # Build obstacle map from fixtures
    fixture_boxes = [get_element_bbox_padded(f, FIXTURE_CLEARANCE) for f in fixtures]

    # Available area = canvas minus wall clearance
    avail_x0 = WALL_CLEARANCE
    avail_y0 = WALL_CLEARANCE
    avail_x1 = canvas_w - WALL_CLEARANCE
    avail_y1 = canvas_h - WALL_CLEARANCE

    # ── Step 2: Sort tables by size (largest first for better packing) ──
    def table_area(t):
        w, h = get_table_size(t)
        return w * h
    target_tables.sort(key=table_area, reverse=True)

    # ── Step 3: Tight grid placement (pack, don't spread) ──
    n = len(target_tables)
    usable_w = avail_x1 - avail_x0
    usable_h = avail_y1 - avail_y0

    # Estimate average table size for grid calculation
    avg_tw = sum(get_table_size(t)[0] for t in target_tables) / n
    avg_th = sum(get_table_size(t)[1] for t in target_tables) / n

    # Calculate tight grid — pack based on actual table sizes, not canvas size
    cell_w = avg_tw + min_gap
    cell_h = avg_th + min_gap
    cols = max(1, int(usable_w / cell_w))
    if cols > n:
        cols = n  # Don't use more columns than tables
    rows = max(1, math.ceil(n / cols))

    # Keep cell size tight — DON'T expand to fill canvas
    # Only expand slightly if there's room and it looks better
    actual_grid_w = cols * cell_w
    actual_grid_h = rows * cell_h

    # If grid fits comfortably, add a little breathing room but NOT full spread
    if actual_grid_w < usable_w * 0.9:
        cell_w = min(cell_w * 1.2, usable_w / cols)
        actual_grid_w = cols * cell_w
    if actual_grid_h < usable_h * 0.9:
        cell_h = min(cell_h * 1.2, usable_h / rows)
        actual_grid_h = rows * cell_h

    # Centre the grid group on the canvas
    offset_x = avail_x0 + (usable_w - actual_grid_w) / 2
    offset_y = avail_y0 + (usable_h - actual_grid_h) / 2

    # Place tables in grid cells, centred within each cell
    for idx, table in enumerate(target_tables):
        col = idx % cols
        row = idx // cols
        tw, th = get_table_size(table)

        # Centre table within its tight cell
        cx = offset_x + col * cell_w + (cell_w - tw) / 2
        cy = offset_y + row * cell_h + (cell_h - th) / 2

        table["x"] = round(cx)
        table["y"] = round(cy)

    # ── Step 4: Push away from fixtures ──
    for table in target_tables:
        t_bbox = get_element_bbox(table)
        tw, th = get_table_size(table)

        for f_box in fixture_boxes:
            if t_bbox.intersects(f_box):
                # Find nearest clear position
                # Try shifting right, then down, then left, then up
                shifts = [
                    (min_gap + tw, 0), (0, min_gap + th),
                    (-(min_gap + tw), 0), (0, -(min_gap + th))
                ]
                best_shift = None
                best_dist = float("inf")

                for sx, sy in shifts:
                    nx = table["x"] + sx
                    ny = table["y"] + sy
                    if avail_x0 <= nx <= avail_x1 - tw and avail_y0 <= ny <= avail_y1 - th:
                        test_box = box(nx, ny, nx + tw, ny + th)
                        if not test_box.intersects(f_box):
                            d = abs(sx) + abs(sy)
                            if d < best_dist:
                                best_dist = d
                                best_shift = (nx, ny)

                if best_shift:
                    table["x"], table["y"] = best_shift

    # ── Step 5: Simulated annealing optimisation ──
    result = _simulated_annealing(
        result, target_tables, fixtures, fixture_boxes,
        canvas_w, canvas_h, min_gap, iterations=3000
    )

    # ── Step 6: Final overlap resolution ──
    result = resolve_overlaps(result, canvas_w, canvas_h, min_gap)

    # ── Step 7: Grid snap for clean look ──
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
                elif dist > min_gap * 3:
                    e += (dist - min_gap * 3) * 1.0  # Too far apart — pull closer

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
