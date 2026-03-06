from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware


def setup_cors(app: FastAPI):
    origins = [
        # Local dev
        "http://localhost:5173",
        "http://localhost:3000",
        "http://localhost:8000",
        # Consumer directory
        "https://rezvo.co.uk",
        "https://www.rezvo.co.uk",
        "https://reevenow.co.uk",
        "https://www.reevenow.co.uk",
        # Business portal
        "https://rezvo.app",
        "https://www.rezvo.app",
        "https://portal.rezvo.app",
        "https://portaladmin.rezvo.app",
        "https://book.rezvo.app",
        "https://reeveos.app",
        "https://portal.reeveos.app",
        "https://portaladmin.reeveos.app",
        "https://reevenow.com",
        "https://www.reevenow.com",
        "https://www.reeveos.app",
        "https://webportal.reeveos.app",
        "https://adminportal.reeveos.app",
        "https://book.reeveos.app",
        "https://staging.reeveos.app",
        # Dashboard (legacy)
        "https://dashboard.rezvo.co.uk",
    ]

    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "X-Requested-With"],
        max_age=600,
    )
