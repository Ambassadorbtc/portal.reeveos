"""
Route registry — organized into subdirectories.

Structure:
  routes/
    auth.py              — authentication
    admin/               — admin panel (portaladmin.rezvo.app)
      core.py            — /admin overview, businesses, users, bookings, subscriptions
      extended.py        — /admin health, audit, errors, analytics, security
      command_centre.py  — /admin/command-centre
      library.py         — /admin/library
    public/              — consumer-facing (no auth)
      directory.py       — /directory
      book.py            — /book
      voice_search.py    — /api/voice-search
      webhooks.py        — /webhooks
    dashboard/           — business owner portal
      overview.py        — /dashboard
      bookings.py        — /bookings
      calendar.py        — /calendar
      ...etc
    epos/                — restaurant EPOS features
      orders.py          — /orders
      kds.py             — /kds
      inventory.py       — /inventory
      ...etc
    platform/            — platform-wide tools
      agent.py           — /agent (AI agent)
      outreach.py        — /outreach (email campaigns)
      linkedin.py        — /linkedin (social automation)

server.py imports from here — all router names preserved.
"""

# ─── Auth (root level) ───
from .auth import router as auth_router

# ─── Admin ───
from .admin.core import router as admin_router
from .admin.extended import router as admin_extended_router
from .admin.command_centre import router as command_centre_router
from .admin.library import router as library_router

# ─── Public ───
from .public.directory import router as directory_router
from .public.book import router as book_router
from .public.voice_search import router as voice_search_router
from .public.webhooks import router as email_webhooks_router
from .public.client_portal import router as client_portal_router

# ─── Dashboard ───
from .dashboard.overview import router as dashboard_router
from .dashboard.consultation import router as consultation_router
from .dashboard.bookings import router as bookings_router
from .dashboard.calendar import router as calendar_router
from .dashboard.users import router as users_router
from .dashboard.businesses import router as businesses_router
from .dashboard.tables import router as tables_router
from .dashboard.staff import router as staff_router
from .dashboard.services import router as services_router
from .dashboard.reviews import router as reviews_router
from .dashboard.analytics import router as analytics_router
from .dashboard.reputation import router as reputation_router
from .dashboard.growth import router as growth_router
from .dashboard.payments import router as payments_router
from .dashboard.settings import router as settings_router
from .dashboard.support import router as support_router
from .dashboard.notifications import router as notifications_router
from .dashboard.insights import router as insights_router
from .dashboard.marketing import router as marketing_router
from .dashboard.chatbot import router as chatbot_router
from .dashboard.studio import router as studio_router
from .dashboard.services_v2 import router as run4_services_router
from .dashboard.menu import router as run4_menu_router
from .dashboard.staff_v2 import router as run5_staff_router
from .dashboard.booking_page import router as run6_booking_page_router
from .dashboard.clients import router as run7_clients_router
from .dashboard.settings_v2 import router as run13_settings_router
from .dashboard.calendar_routes import router as calendar_routes_router
from .dashboard.packages import router as packages_router

# ─── EPOS ───
from .epos.orders import router as orders_router
from .epos.kds import router as kds_router
from .epos.inventory import router as inventory_router
from .epos.ai import router as epos_ai_router
from .epos.labour import router as labour_router
from .epos.online_ordering import router as online_ordering_router
from .epos.pay_at_table import router as pay_at_table_router
from .epos.cash_and_tax import router as cash_and_tax_router
from .epos.ops import router as ops_router
from .epos.table_management import router as table_management_router
from .epos.tronc import router as tronc_router
from .epos.delivery import router as delivery_aggregation_router
from .epos.allergens import router as allergen_management_router
from .epos.accounting import router as accounting_router

# ─── Platform ───
from .platform.agent import router as agent_router
from .platform.outreach import router as outreach_router
from .platform.outreach import webhook_router as outreach_webhook_router
from .platform.linkedin import router as linkedin_router


__all__ = [
    "auth_router",
    "admin_router", "admin_extended_router", "command_centre_router", "library_router",
    "directory_router", "book_router", "voice_search_router", "email_webhooks_router",
    "dashboard_router", "bookings_router", "calendar_router", "users_router",
    "businesses_router", "tables_router", "staff_router", "services_router",
    "reviews_router", "analytics_router", "reputation_router", "growth_router",
    "payments_router", "settings_router", "support_router", "notifications_router",
    "insights_router", "marketing_router", "chatbot_router", "studio_router",
    "run4_services_router", "run4_menu_router", "run5_staff_router",
    "run6_booking_page_router", "run7_clients_router", "run13_settings_router",
    "calendar_routes_router",
    "packages_router",
    "orders_router", "kds_router", "inventory_router", "epos_ai_router",
    "labour_router", "online_ordering_router", "pay_at_table_router",
    "cash_and_tax_router", "ops_router", "table_management_router", "tronc_router",
    "delivery_aggregation_router", "allergen_management_router", "accounting_router",
    "agent_router", "outreach_router", "outreach_webhook_router", "linkedin_router",
    "consultation_router", "client_portal_router",
]
