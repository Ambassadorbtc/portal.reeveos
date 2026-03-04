"""Studio API Routes"""
import logging
from fastapi import APIRouter, HTTPException, Depends
from middleware.auth import get_current_admin
from pydantic import BaseModel

logger = logging.getLogger("studio")
router = APIRouter(prefix="/api/studio", tags=["studio"], dependencies=[Depends(get_current_admin)])


class CaptureRequest(BaseModel):
    url: str
    viewport: str = "desktop"
    wait_extra: int = 1500
    dismiss_cookies: bool = True
    hide_overlays: bool = True
    scroll_lazy: bool = True


@router.post("/capture")
async def start_capture(req: CaptureRequest):
    from services.studio_capture import capture_website
    url = req.url.strip()
    if not url.startswith(("http://", "https://")):
        url = f"https://{url}"
    if req.viewport not in ("desktop", "tablet", "mobile"):
        raise HTTPException(400, "viewport must be desktop, tablet, or mobile")
    result = await capture_website(
        url=url, viewport=req.viewport, wait_extra=req.wait_extra,
        dismiss_cookies=req.dismiss_cookies,
        hide_overlays=req.hide_overlays,
        scroll_lazy=req.scroll_lazy,
    )
    return result


@router.get("/jobs")
async def list_all_jobs(limit: int = 50):
    from services.studio_capture import list_jobs
    return list_jobs(limit)


@router.get("/jobs/{job_id}")
async def get_job_detail(job_id: str):
    from services.studio_capture import get_job
    job = get_job(job_id)
    if not job:
        raise HTTPException(404, "Job not found")
    return job


@router.delete("/jobs/{job_id}")
async def delete_job_endpoint(job_id: str):
    from services.studio_capture import delete_job, get_job
    if not get_job(job_id):
        raise HTTPException(404, "Job not found")
    delete_job(job_id)
    return {"deleted": True, "job_id": job_id}


@router.post("/jobs/{job_id}/figma")
async def export_figma_svg(job_id: str):
    """Generate an editable SVG from a capture's design map for Figma import."""
    from services.studio_capture import get_job, JOBS_DIR
    from services.studio_figma_svg import generate_figma_svg
    import json
    from pathlib import Path

    job = get_job(job_id)
    if not job:
        raise HTTPException(404, "Job not found")

    job_dir = JOBS_DIR / job_id
    design_map_path = job_dir / "design_map.json"

    if not design_map_path.exists():
        raise HTTPException(400, "No design map found. Re-capture this URL to generate one.")

    design_map = json.loads(design_map_path.read_text())

    # Generate SVG
    svg_path = job_dir / "figma_export.svg"
    generate_figma_svg(design_map, svg_path)

    return {
        "job_id": job_id,
        "svg_path": f"/static/studio/jobs/{job_id}/figma_export.svg",
        "svg_size_mb": round(svg_path.stat().st_size / (1024 * 1024), 2),
        "node_count": design_map.get("nodeCount", 0),
    }
