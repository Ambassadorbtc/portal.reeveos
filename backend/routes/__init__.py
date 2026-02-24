from .auth import router as auth_router
from .book import router as book_router
from .dashboard import router as dashboard_router
from .calendar import router as calendar_router
from .users import router as users_router
from .businesses import router as businesses_router
from .bookings import router as bookings_router
from .directory import router as directory_router
from .tables import router as tables_router
from .staff import router as staff_router
from .services import router as services_router
from .reviews import router as reviews_router
from .analytics import router as analytics_router
from .reputation import router as reputation_router
from .growth import router as growth_router
from .payments import router as payments_router
from .settings import router as settings_router
from .support import router as support_router
from .voice_search import router as voice_search_router
from .run4_services import router as run4_services_router
from .run4_menu import router as run4_menu_router
from .run5_staff import router as run5_staff_router
from .run6_booking_page import router as run6_booking_page_router
from .run7_clients import router as run7_clients_router
from .run13_settings import router as run13_settings_router
from .chatbot import router as chatbot_router

__all__ = [
    "auth_router",
    "book_router",
    "dashboard_router",
    "calendar_router",
    "users_router",
    "businesses_router",
    "bookings_router",
    "directory_router",
    "tables_router",
    "staff_router",
    "services_router",
    "reviews_router",
    "analytics_router",
    "reputation_router",
    "growth_router",
    "payments_router",
    "settings_router",
    "support_router",
    "voice_search_router",
    "run4_services_router",
    "run4_menu_router",
    "run5_staff_router",
    "run6_booking_page_router",
    "run7_clients_router",
    "run13_settings_router",
    "chatbot_router",
]
