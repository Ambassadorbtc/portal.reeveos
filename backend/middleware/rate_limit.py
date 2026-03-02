"""
Rate limiting for ReeveOS API.
Global defaults + per-endpoint overrides.
"""
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from fastapi import Request
from fastapi.responses import JSONResponse

limiter = Limiter(
    key_func=get_remote_address,
    default_limits=["120/minute"],  # Global default: 120 req/min per IP
    storage_uri="memory://",
)


async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
    return JSONResponse(
        status_code=429,
        content={
            "detail": "Too many requests. Please try again later.",
            "retry_after": str(exc.detail).split("per ")[-1] if exc.detail else "1 minute",
        },
    )
