from pathlib import Path
from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from contextlib import asynccontextmanager
import uuid
import logging
import database
from middleware.cors import setup_cors
from middleware.rate_limit import limiter
from routes import (
    auth_router,
    admin_partners_router,
    book_router,
    dashboard_router,
    calendar_router,
    users_router,
    businesses_router,
    bookings_router,
    directory_router,
    tables_router,
    staff_router,
    services_router,
    reviews_router,
    analytics_router,
    reputation_router,
    growth_router,
    payments_router,
    settings_router,
    support_router,
    voice_search_router,
    run4_services_router,
    run4_menu_router,
    run5_staff_router,
    run6_booking_page_router,
    run7_clients_router,
    crm_router,
    shop_router,
    meet_router,
    run13_settings_router,
    chatbot_router,
    insights_router,
    marketing_router,
    email_webhooks_router,
    linkedin_router,
    agent_router,
    outreach_router,
    outreach_webhook_router,
    admin_router,
    command_centre_router,
    admin_extended_router,
    orders_router,
    kds_router,
    inventory_router,
    epos_ai_router,
    labour_router,
    online_ordering_router,
    pay_at_table_router,
    cash_and_tax_router,
    ops_router,
    library_router,
    studio_router,
    notifications_router,
    allergen_management_router,
    tronc_router,
    consultation_router,
    client_portal_router,
    packages_router,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await database.connect_to_mongo()


    # Create audit log indexes
    from middleware.audit import ensure_audit_indexes
    await ensure_audit_indexes()
    # Start background email scheduler (drip sequences, reminders, agent tasks)
    from helpers.scheduler import start_scheduler, stop_scheduler
    start_scheduler()
    # Create agent indexes + register tools
    try:
        from agent.indexes import ensure_agent_indexes
        await ensure_agent_indexes()
        from agent.tools.all_tools import register_all_tools
        register_all_tools()
    except Exception as e:
        import logging
        logging.getLogger("agent").error(f"Agent init error: {e}")
    # Create library indexes (full-text search)
    try:
        from routes.admin.library import _ensure_indexes as ensure_library_indexes
        await ensure_library_indexes()
    except Exception as e:
        import logging
        logging.getLogger("library").error(f"Library index init error: {e}")
    # Create website builder indexes (TTL for analytics, etc.)
    try:
        from routes.dashboard.website_builder import ensure_website_indexes
        await ensure_website_indexes()
    except Exception as e:
        import logging
        logging.getLogger("website_builder").error(f"Website builder index init error: {e}")
    yield
    stop_scheduler()
    await database.close_mongo_connection()


import os

_is_prod = os.getenv("ENVIRONMENT", "production") == "production"

app = FastAPI(
    title="ReeveOS API",
    description="Your High Street, Booked - Multi-vertical booking platform for UK restaurants, barbers, salons, and spas",
    version="1.0.0",
    lifespan=lifespan,
    docs_url=None if _is_prod else "/docs",
    redoc_url=None if _is_prod else "/redoc",
    openapi_url=None if _is_prod else "/openapi.json",
)

setup_cors(app)

# Security headers middleware (VULN-013)
from middleware.security import SecurityMiddleware
app.add_middleware(SecurityMiddleware)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ── Audit logging middleware: log admin + write actions to audit_log ──
from starlette.middleware.base import BaseHTTPMiddleware

class AuditMiddleware(BaseHTTPMiddleware):
    """Log admin and mutating (POST/PUT/PATCH/DELETE) requests to audit_log collection."""
    SKIP_PATHS = {"/api/health", "/api/auth/refresh", "/api/admin/health/check", "/api/agent/"}

    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        # Only log admin routes and mutating requests (not GETs to regular routes)
        path = request.url.path
        method = request.method
        should_log = (
            "/admin/" in path or
            (method in ("POST", "PUT", "PATCH", "DELETE") and not any(path.startswith(s) for s in self.SKIP_PATHS))
        )
        if should_log and response.status_code < 500:
            try:
                from middleware.audit import log_audit_event, AuditAction, get_client_ip
                # Determine action from method
                action_map = {"POST": AuditAction.CREATE, "PUT": AuditAction.UPDATE,
                              "PATCH": AuditAction.UPDATE, "DELETE": AuditAction.DELETE, "GET": AuditAction.READ}
                action = action_map.get(method, AuditAction.READ)
                if "/admin/" in path:
                    action = AuditAction.ADMIN_ACCESS
                # Extract user info from auth header (non-blocking, best-effort)
                user_id = ""
                user_email = ""
                try:
                    auth = request.headers.get("authorization", "")
                    if auth.startswith("Bearer "):
                        import jwt
                        token = auth.split(" ", 1)[1]
                        payload = jwt.decode(token, options={"verify_signature": False})
                        user_id = payload.get("sub", "")
                        user_email = payload.get("email", "")
                except Exception:
                    pass
                await log_audit_event(
                    action=action, resource_type=path.split("/")[2] if len(path.split("/")) > 2 else "unknown",
                    endpoint=path, method=method, ip_address=get_client_ip(request),
                    user_id=user_id, user_email=user_email,
                )
            except Exception:
                pass  # Never let audit logging break requests
        return response

app.add_middleware(AuditMiddleware)

# ── Global exception handler: NEVER leak tenant data in errors ──
_error_logger = logging.getLogger("error_handler")

@app.exception_handler(Exception)
async def safe_exception_handler(request: Request, exc: Exception):
    """
    Catches ALL unhandled exceptions. Returns a safe, generic error
    with an opaque reference ID. NEVER includes stack traces, SQL errors,
    tenant data, or any internal details in the response.
    Also writes to error_log collection for the Error Logs dashboard.
    """
    import traceback
    error_ref = str(uuid.uuid4())[:8].upper()
    _error_logger.critical(
        f"Unhandled exception ref={error_ref}: {type(exc).__name__}: {exc}",
        exc_info=True,
        extra={"error_ref": error_ref, "path": str(request.url.path)}
    )
    # Write to MongoDB error_log for the admin Error Logs dashboard
    try:
        from database import get_database
        db = get_database()
        if db is not None:
            from datetime import datetime
            severity = "critical" if "database" in str(exc).lower() or "mongo" in str(exc).lower() else "error"
            await db.error_log.insert_one({
                "reference": error_ref,
                "severity": severity,
                "type": type(exc).__name__,
                "message": str(exc)[:500],
                "path": str(request.url.path),
                "method": request.method,
                "traceback": traceback.format_exc()[-2000:],
                "created_at": datetime.utcnow(),
            })
    except Exception:
        pass  # Never let error logging break the error handler
    return JSONResponse(
        status_code=500,
        content={
            "detail": "Something went wrong. Please try again.",
            "reference": error_ref,
        }
    )

app.include_router(auth_router)
app.include_router(book_router)
app.include_router(dashboard_router)
app.include_router(calendar_router)
app.include_router(users_router)
app.include_router(businesses_router)
app.include_router(bookings_router)
app.include_router(directory_router)
app.include_router(tables_router)
app.include_router(staff_router)
app.include_router(services_router)
app.include_router(reviews_router)
app.include_router(analytics_router)
app.include_router(reputation_router)
app.include_router(growth_router)
app.include_router(payments_router)
app.include_router(settings_router)
app.include_router(support_router)
app.include_router(voice_search_router)
app.include_router(run4_services_router)
app.include_router(run4_menu_router)
app.include_router(run5_staff_router)
app.include_router(run6_booking_page_router)
app.include_router(run7_clients_router)
app.include_router(crm_router)
app.include_router(shop_router)
app.include_router(meet_router)
app.include_router(run13_settings_router)
app.include_router(chatbot_router)
app.include_router(insights_router)
app.include_router(marketing_router)
app.include_router(email_webhooks_router)
app.include_router(linkedin_router)
app.include_router(agent_router)
app.include_router(outreach_router)
app.include_router(outreach_webhook_router)  # Public — Resend webhooks (no auth)
app.include_router(admin_router)
app.include_router(command_centre_router)
app.include_router(admin_extended_router)
app.include_router(orders_router)
app.include_router(kds_router)
app.include_router(inventory_router)
app.include_router(epos_ai_router)
app.include_router(labour_router)
app.include_router(online_ordering_router)
app.include_router(pay_at_table_router)
app.include_router(cash_and_tax_router)
app.include_router(ops_router)
app.include_router(library_router)
app.include_router(admin_partners_router)
app.include_router(studio_router)
app.include_router(notifications_router)
app.include_router(allergen_management_router)
app.include_router(tronc_router)
app.include_router(consultation_router)
app.include_router(client_portal_router)
app.include_router(packages_router)

# Public support chat (no auth required — marketing site AI)
from routes.support_chat import router as public_support_chat_router
app.include_router(public_support_chat_router)

# Loyalty & Rewards
from routes.dashboard.loyalty import router as loyalty_router
app.include_router(loyalty_router)

# Client Photos (Before & After)
from routes.dashboard.client_photos import router as client_photos_router
app.include_router(client_photos_router)

# Consent Template Library
from routes.dashboard.consent_templates import router as consent_templates_router
app.include_router(consent_templates_router)

# Social Booking (embed widget, FB/IG integration)
from routes.dashboard.social_booking import router as social_booking_router
app.include_router(social_booking_router)

# Injection Point Mapping
from routes.dashboard.injection_mapping import router as injection_mapping_router
app.include_router(injection_mapping_router)

# Academy / Training Mode
from routes.dashboard.academy import router as academy_router
app.include_router(academy_router)

# Operators (Self-Employed) Management
from routes.dashboard.operators import router as operators_router
app.include_router(operators_router)

# Mothership Dashboard & Settlements
from routes.dashboard.mothership import router as mothership_router
app.include_router(mothership_router)

# Client Notes (Staff Alerts, Appointment Notes, Client Booking Notes)
from routes.dashboard.client_notes import router as client_notes_router
app.include_router(client_notes_router)

# Blocked Times (Calendar block slots)
from routes.dashboard.blocked_times import router as blocked_times_router
app.include_router(blocked_times_router)

# Clinical Workflow (Check-in, Completion, Therapist Preference)
from routes.dashboard.clinical_workflow import router as clinical_workflow_router
app.include_router(clinical_workflow_router)

# Treatment Add-ons & Product Upsells
from routes.dashboard.addons import router as addons_router
app.include_router(addons_router)

# Abandoned Cart Tracking
from routes.dashboard.abandoned_cart import router as abandoned_cart_router
app.include_router(abandoned_cart_router)

# Staff Rota (4-week rotating schedule, overrides, availability)
from routes.dashboard.rota import router as rota_router
app.include_router(rota_router)

# Treatment Consumable Tracking
from routes.dashboard.consumables import router as consumables_router
app.include_router(consumables_router)

# Website Builder (Pages, Settings, Images, Templates, AI, Domains, Analytics)
from routes.dashboard.website_builder import router as website_builder_router
app.include_router(website_builder_router)

# Public Website Renderer (SSR pages at /site/{subdomain}/{slug})
from routes.public.website_renderer import router as website_renderer_router
app.include_router(website_renderer_router)

# Blog Engine (CRUD, publish, schedule)
from routes.dashboard.blog import router as blog_router
app.include_router(blog_router)

# Public Contact Form Submissions
from routes.public.forms import router as forms_router
app.include_router(forms_router)

# Static uploads for booking page logo/cover
static_dir = Path("/opt/rezvo-app/uploads")
try:
    static_dir.mkdir(parents=True, exist_ok=True)
except OSError:
    pass
app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")

# Site assets (tracker.js for public website analytics)
site_assets_dir = Path("/opt/rezvo-app/backend/static")
if site_assets_dir.exists():
    app.mount("/site-assets", StaticFiles(directory=str(site_assets_dir)), name="site-assets")


@app.get("/")
async def root():
    return {
        "message": "ReeveOS API",
        "version": "1.0.0",
        "status": "operational"
    }


@app.get("/health")
async def health_check():
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
