"""
Studio Capture Engine — Stage 1
High-resolution full-page website capture with stealth, cookie dismissal,
lazy-load scrolling, tall page stitching, and multi-viewport support.
"""

import asyncio, json, logging, os, shutil, time, uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional
from PIL import Image
from playwright.async_api import async_playwright, Page

logger = logging.getLogger("studio")

VIEWPORTS = {
    "desktop": {"width": 1440, "height": 900},
    "tablet":  {"width": 768,  "height": 1024},
    "mobile":  {"width": 375,  "height": 812},
}

DPR = 3
CHROMIUM_MAX_HEIGHT = 16384
CAPTURE_TIMEOUT = 60000
SCROLL_DELAY = 300
EXTRA_WAIT_DEFAULT = 1500

COOKIE_ACCEPT_SELECTORS = [
    '#onetrust-accept-btn-handler',
    '#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll',
    '#CybotCookiebotDialogBodyButtonAccept',
    '.cc-accept', '.cc-allow',
    '#cookie-accept', '#cookie-consent-accept',
    '.cookie-accept', '.js-cookie-accept',
    '#gdpr-cookie-accept', '.gdpr-accept',
    'button[id*="accept" i]', 'button[class*="accept" i]',
    'a[id*="accept" i]', '[data-testid*="accept" i]',
    '[aria-label*="accept" i]', '[data-cookie-accept]',
    'button:has-text("Accept All")', 'button:has-text("Accept all")',
    'button:has-text("Accept Cookies")', 'button:has-text("Accept cookies")',
    'button:has-text("Allow All")', 'button:has-text("Allow all")',
    'button:has-text("I Accept")', 'button:has-text("I agree")',
    'button:has-text("Got it")', 'button:has-text("Agree")',
    'a:has-text("Accept All")', 'a:has-text("Accept all")',
]

OVERLAY_SELECTORS = [
    '#onetrust-banner-sdk', '#onetrust-consent-sdk',
    '#CybotCookiebotDialog', '.cc-window', '.cc-banner',
    '#cookie-banner', '#cookie-consent', '#cookie-notice',
    '.cookie-banner', '.cookie-consent', '.cookie-notice',
    '.cookie-popup', '.cookie-modal', '.gdpr-banner', '.consent-banner',
    '[class*="cookie-banner" i]', '[class*="cookie-consent" i]',
    '[class*="cookie-notice" i]', '[id*="cookie-banner" i]',
    '[class*="popup-overlay" i]', '[class*="modal-overlay" i]',
    '.newsletter-popup', '.email-popup',
]

JOBS_DIR = Path(__file__).parent.parent / "static" / "studio" / "jobs"
JOBS_DIR.mkdir(parents=True, exist_ok=True)
_jobs: dict = {}


def get_job(job_id: str) -> Optional[dict]:
    if job_id in _jobs:
        return _jobs[job_id]
    job_path = JOBS_DIR / job_id / "job.json"
    if job_path.exists():
        job = json.loads(job_path.read_text())
        _jobs[job_id] = job
        return job
    return None


def list_jobs(limit: int = 50) -> list:
    if JOBS_DIR.exists():
        for d in JOBS_DIR.iterdir():
            if d.is_dir() and d.name.startswith("studio_"):
                if d.name not in _jobs:
                    meta = d / "job.json"
                    if meta.exists():
                        try: _jobs[d.name] = json.loads(meta.read_text())
                        except: pass
    return sorted(_jobs.values(), key=lambda j: j.get("created_at", ""), reverse=True)[:limit]


def delete_job(job_id: str) -> bool:
    job_dir = JOBS_DIR / job_id
    if job_dir.exists(): shutil.rmtree(job_dir)
    _jobs.pop(job_id, None)
    return True


async def _dismiss_cookies(page: Page) -> bool:
    for selector in COOKIE_ACCEPT_SELECTORS:
        try:
            btn = page.locator(selector).first
            if await btn.is_visible(timeout=400):
                await btn.click(timeout=2000)
                logger.info(f"Cookie dismissed: {selector}")
                await page.wait_for_timeout(500)
                return True
        except: continue
    return False


async def _hide_overlays(page: Page) -> int:
    try:
        return await page.evaluate("""(selectors) => {
            let c = 0;
            for (const s of selectors) {
                try { document.querySelectorAll(s).forEach(el => { el.style.setProperty('display','none','important'); c++; }); } catch(e) {}
            }
            document.querySelectorAll('*').forEach(el => {
                try {
                    const st = getComputedStyle(el); const z = parseInt(st.zIndex)||0;
                    if ((st.position==='fixed'||st.position==='sticky') && z > 999) {
                        const t = el.tagName.toLowerCase();
                        if (t!=='nav' && t!=='header' && !el.querySelector('nav')) {
                            const r = el.getBoundingClientRect();
                            if (r.width > window.innerWidth*0.4 || r.height > window.innerHeight*0.4) { el.style.setProperty('display','none','important'); c++; }
                        }
                    }
                } catch(e) {}
            });
            return c;
        }""", OVERLAY_SELECTORS)
    except: return 0


async def _get_dims(page: Page) -> tuple:
    try:
        d = await page.evaluate("""() => ({
            h: Math.max(
                document.body?.scrollHeight || 0,
                document.body?.offsetHeight || 0,
                document.documentElement?.scrollHeight || 0,
                document.documentElement?.offsetHeight || 0
            ),
            w: Math.max(
                document.body?.scrollWidth || 0,
                document.documentElement?.scrollWidth || 0
            ),
            vh: window.innerHeight || 0
        })""")
        return d["h"], d["w"], d["vh"]
    except: return 0, 0, 0


async def _scroll_lazy(page: Page) -> int:
    ph, _, vh = await _get_dims(page)
    if ph == 0 or vh == 0: return 0
    cur, iters = 0, 200  # More iterations for very tall pages
    while cur < ph and iters > 0:
        await page.evaluate(f"window.scrollTo(0,{cur})")
        await page.wait_for_timeout(SCROLL_DELAY)
        nh, _, _ = await _get_dims(page)
        if nh > ph: ph = nh
        cur += vh; iters -= 1
    # Scroll to absolute bottom to trigger any remaining lazy content
    await page.evaluate("window.scrollTo(0, document.documentElement.scrollHeight)")
    await page.wait_for_timeout(1000)
    # Re-measure — page may have grown
    nh, _, _ = await _get_dims(page)
    if nh > ph: ph = nh
    # Scroll back to top
    await page.evaluate("window.scrollTo(0,0)")
    await page.wait_for_timeout(500)
    return ph


async def _capture_screenshot(page: Page, out: Path, dpr: int = DPR) -> dict:
    ph, pw, vh = await _get_dims(page)
    if ph == 0:
        await page.screenshot(path=str(out), full_page=False, type="png")
        return {"page_width": pw, "page_height": ph, "dpr": dpr, "pixel_width": 0, "pixel_height": 0, "stitched": False, "sections": 1, "file_size_mb": round(out.stat().st_size/(1024*1024), 2)}

    aph = ph * dpr
    info = {"page_width": pw, "page_height": ph, "dpr": dpr, "pixel_width": pw*dpr, "pixel_height": aph, "stitched": False, "sections": 1}

    if aph <= CHROMIUM_MAX_HEIGHT:
        await page.screenshot(path=str(out), full_page=True, type="png")
    else:
        # Stitch mode — scroll through page capturing viewport-sized chunks
        # DO NOT resize viewport (causes page reflow and content loss)
        logger.info(f"Stitching: {aph}px > {CHROMIUM_MAX_HEIGHT}px (page: {ph}px CSS, viewport: {vh}px)")
        sections, cy, idx = [], 0, 0
        while cy < ph:
            await page.evaluate(f"window.scrollTo(0,{cy})")
            await page.wait_for_timeout(400)  # Wait for render after scroll
            sp = out.parent / f"_s{idx}.png"
            await page.screenshot(path=str(sp), full_page=False, type="png")
            sections.append({"path": sp, "y": cy * dpr, "h": vh * dpr})
            cy += vh
            idx += 1
            # Re-check page height (content may still be loading)
            nh, _, _ = await _get_dims(page)
            if nh > ph:
                ph = nh
                aph = ph * dpr
                info["pixel_height"] = aph
                info["page_height"] = ph

        # Stitch all sections together
        total_w = pw * dpr
        total_h = ph * dpr
        stitched = Image.new("RGB", (total_w, total_h))
        for s in sections:
            img = Image.open(s["path"])
            # Last section might extend beyond page — crop if needed
            paste_y = s["y"]
            if paste_y + img.height > total_h:
                crop_h = total_h - paste_y
                if crop_h > 0:
                    img = img.crop((0, 0, img.width, crop_h))
                else:
                    img.close()
                    os.remove(s["path"])
                    continue
            stitched.paste(img, (0, paste_y))
            img.close()
            os.remove(s["path"])

        stitched.save(str(out), "PNG", optimize=True)
        stitched.close()
        info["stitched"] = True
        info["sections"] = idx

    info["file_size_mb"] = round(out.stat().st_size/(1024*1024), 2)
    return info


async def capture_website(url: str, viewport: str = "desktop", wait_extra: int = EXTRA_WAIT_DEFAULT,
                          dismiss_cookies: bool = True, hide_overlays: bool = True, scroll_lazy: bool = True) -> dict:
    job_id = f"studio_{uuid.uuid4().hex[:12]}"
    job_dir = JOBS_DIR / job_id
    job_dir.mkdir(parents=True, exist_ok=True)
    vp = VIEWPORTS.get(viewport, VIEWPORTS["desktop"])

    job = {"job_id": job_id, "url": url, "viewport": viewport, "viewport_size": vp,
           "dpr": DPR, "status": "starting", "created_at": datetime.now(timezone.utc).isoformat(), "steps": [], "error": None}
    _jobs[job_id] = job

    def step(msg):
        job["steps"].append({"time": time.time(), "msg": msg})
        logger.info(f"[{job_id}] {msg}")

    try:
        step("Launching browser")
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=["--no-sandbox","--disable-setuid-sandbox","--disable-dev-shm-usage","--disable-gpu"])

            context = await browser.new_context(viewport=vp, device_scale_factor=DPR,
                user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
                locale="en-GB", timezone_id="Europe/London")
            page = await context.new_page()

            try:
                from playwright_stealth import stealth_async
                await stealth_async(page); step("Stealth active")
            except ImportError: step("Standard mode")

            job["status"] = "navigating"; step(f"Navigating to {url}")
            try:
                resp = await page.goto(url, wait_until="networkidle", timeout=CAPTURE_TIMEOUT)
                job["http_status"] = resp.status if resp else None; step(f"Loaded (HTTP {job['http_status']})")
            except:
                try:
                    resp = await page.goto(url, wait_until="domcontentloaded", timeout=CAPTURE_TIMEOUT)
                    job["http_status"] = resp.status if resp else None; step(f"Fallback loaded (HTTP {job['http_status']})")
                except Exception as e: raise Exception(f"Navigation failed: {e}")

            await page.wait_for_timeout(wait_extra)

            if dismiss_cookies:
                job["status"] = "dismissing_cookies"
                if await _dismiss_cookies(page): step("Cookies dismissed")

            if hide_overlays:
                n = await _hide_overlays(page)
                if n: step(f"Hid {n} overlays")

            if scroll_lazy:
                job["status"] = "scrolling"; step("Scrolling for lazy content")
                h = await _scroll_lazy(page); step(f"Page height: {h}px")

            await page.wait_for_timeout(1000)
            try: job["page_title"] = await page.title()
            except: job["page_title"] = ""

            job["status"] = "capturing"; step("Capturing screenshot")
            ss_path = job_dir / "screenshot.png"
            cap = await _capture_screenshot(page, ss_path)
            job["capture"] = cap
            step(f"Captured: {cap['pixel_width']}x{cap['pixel_height']}px ({cap['file_size_mb']}MB)")
            if cap["stitched"]: step(f"Stitched {cap['sections']} sections")

            try:
                thumb = job_dir / "thumbnail.png"
                await page.set_viewport_size(vp); await page.evaluate("window.scrollTo(0,0)"); await page.wait_for_timeout(200)
                await page.screenshot(path=str(thumb), full_page=False, type="png"); step("Thumbnail saved")
            except: step("Thumbnail skipped")

            try:
                job["page_meta"] = await page.evaluate("""() => ({
                    title: document.title||'', description: document.querySelector('meta[name="description"]')?.content||'',
                    favicon: document.querySelector('link[rel="icon"]')?.href||document.querySelector('link[rel="shortcut icon"]')?.href||'',
                    ogImage: document.querySelector('meta[property="og:image"]')?.content||'',
                    fonts: [...new Set([...document.querySelectorAll('body *')].slice(0,500).map(e=>getComputedStyle(e).fontFamily).filter(f=>f))].slice(0,20),
                    colorCount: [...new Set([...document.querySelectorAll('body *')].slice(0,500).map(e=>getComputedStyle(e).backgroundColor).filter(c=>c&&c!=='rgba(0, 0, 0, 0)'))].length
                })""")
            except: job["page_meta"] = {}

            await context.close(); await browser.close()

        job["status"] = "complete"; job["completed_at"] = datetime.now(timezone.utc).isoformat()
        job["screenshot_path"] = f"/static/studio/jobs/{job_id}/screenshot.png"
        job["thumbnail_path"] = f"/static/studio/jobs/{job_id}/thumbnail.png"
        job["duration_seconds"] = round(job["steps"][-1]["time"] - job["steps"][0]["time"], 2)
        step(f"Done in {job['duration_seconds']}s")
        (job_dir / "job.json").write_text(json.dumps(job, indent=2, default=str))
        return job
    except Exception as e:
        job["status"] = "error"; job["error"] = str(e); step(f"ERROR: {e}")
        logger.exception(f"[{job_id}] Capture failed")
        try: (job_dir / "job.json").write_text(json.dumps(job, indent=2, default=str))
        except: pass
        return job
