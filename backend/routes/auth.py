from fastapi import APIRouter, HTTPException, status, Depends, Request
from datetime import datetime, timedelta
from bson import ObjectId
from database import get_database
from config import settings
from models.user import UserCreate, UserResponse, UserRole
from middleware.auth import create_access_token, create_refresh_token
from middleware.rate_limit import limiter
from pydantic import BaseModel, EmailStr
from typing import Optional

router = APIRouter(prefix="/auth", tags=["auth"])
import bcrypt as _bcrypt

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return _bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))
    except Exception:
        return False


def get_password_hash(password: str) -> str:
    return _bcrypt.hashpw(password.encode("utf-8"), _bcrypt.gensalt()).decode("utf-8")


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str = ""
    token_type: str = "bearer"
    user: Optional[dict] = None


class PasswordResetRequest(BaseModel):
    email: EmailStr


class PasswordResetConfirm(BaseModel):
    token: str
    new_password: str


@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(user_data: UserCreate):
    db = get_database()
    
    existing_user = await db.users.find_one({"email": user_data.email})
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Business portal registration: allow business_owner and diner roles
    # Diner accounts are created via the client portal (Reeve Now), not here
    # but we still accept it for backwards compatibility
    ALLOWED_SELF_REGISTRATION_ROLES = {"diner", "business_owner", "owner"}
    safe_role = user_data.role.value if user_data.role.value in ALLOWED_SELF_REGISTRATION_ROLES else "business_owner"
    # Normalise legacy "owner" to "business_owner"
    if safe_role == "owner":
        safe_role = "business_owner"

    user_dict = {
        "email": user_data.email,
        "name": user_data.name,
        "phone": user_data.phone,
        "role": safe_role,
        "password_hash": get_password_hash(user_data.password),
        "avatar": None,
        "saved_businesses": [],
        "booking_history": [],
        "review_history": [],
        "business_ids": [],
        "stripe_connected": False,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    result = await db.users.insert_one(user_dict)
    user_id = str(result.inserted_id)
    
    access_token = create_access_token(data={"sub": user_id})
    refresh_token = create_refresh_token(data={"sub": user_id})
    
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": {
            "id": user_id,
            "email": user_dict["email"],
            "name": user_dict["name"],
            "phone": user_dict.get("phone"),
            "role": user_dict["role"],
            "avatar": user_dict.get("avatar"),
            "saved_businesses": user_dict.get("saved_businesses", []),
            "business_ids": user_dict.get("business_ids", []),
            "stripe_connected": user_dict.get("stripe_connected", False),
            "created_at": user_dict["created_at"].isoformat(),
        },
    }


@router.post("/login")
@limiter.limit("5/minute")
async def login(request: Request, login_data: LoginRequest):
    db = get_database()
    
    user = await db.users.find_one({"email": login_data.email})
    if not user or not verify_password(login_data.password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )
    
    access_token = create_access_token(data={"sub": str(user["_id"])})
    refresh_token = create_refresh_token(data={"sub": str(user["_id"])})
    
    # Build user response dict directly (avoids Pydantic model → dict coercion issues)
    user_dict = {
        "id": str(user["_id"]),
        "email": user.get("email", ""),
        "name": user.get("name", ""),
        "phone": user.get("phone"),
        "role": user.get("role", "diner"),
        "avatar": user.get("avatar"),
        "saved_businesses": user.get("saved_businesses", []),
        "business_ids": [str(bid) for bid in user.get("business_ids", [])],
        "stripe_connected": user.get("stripe_connected", False),
        "created_at": user.get("created_at", datetime.utcnow()).isoformat() if user.get("created_at") else datetime.utcnow().isoformat(),
    }
    
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": user_dict,
    }


class RefreshRequest(BaseModel):
    refresh_token: str


@router.post("/refresh")
@limiter.limit("10/minute")
async def refresh_access_token(request: Request, body: RefreshRequest):
    """Exchange a valid refresh token for a new access token."""
    from jose import JWTError, jwt as jose_jwt
    
    try:
        payload = jose_jwt.decode(
            body.refresh_token, settings.jwt_secret_key,
            algorithms=[settings.jwt_algorithm]
        )
        if payload.get("token_type") != "refresh":
            raise HTTPException(401, "Invalid token type")
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(401, "Invalid refresh token")
    except JWTError:
        raise HTTPException(401, "Invalid or expired refresh token")
    
    db = get_database()
    try:
        user = await db.users.find_one({"_id": ObjectId(user_id)})
    except Exception:
        user = await db.users.find_one({"_id": user_id})
    
    if not user:
        raise HTTPException(401, "User not found")
    
    new_access = create_access_token(data={"sub": str(user["_id"])})
    return {"access_token": new_access, "token_type": "bearer"}


@router.post("/password-reset-request")
@limiter.limit("3/minute")
async def request_password_reset(request: Request, reset_req: PasswordResetRequest):
    db = get_database()
    
    user = await db.users.find_one({"email": reset_req.email})
    if not user:
        # Return same message whether user exists or not (prevent enumeration)
        return {"detail": "If the email exists, a reset link has been sent"}
    
    reset_token = create_access_token(
        data={"sub": str(user["_id"]), "type": "password_reset"},
        expires_delta=timedelta(hours=1)
    )
    
    # TODO: Send reset email with token via Resend/SendGrid
    # For now, log it server-side only — NEVER return token in HTTP response
    import logging
    logging.getLogger("auth").info(f"Password reset requested for {reset_req.email}")
    
    return {"detail": "If the email exists, a reset link has been sent"}


@router.post("/password-reset-confirm")
async def confirm_password_reset(request: PasswordResetConfirm):
    """Verify reset token and update password."""
    from jose import JWTError, jwt as jose_jwt
    
    try:
        payload = jose_jwt.decode(
            request.token, settings.jwt_secret_key,
            algorithms=[settings.jwt_algorithm]
        )
        if payload.get("type") != "password_reset":
            raise HTTPException(400, "Invalid reset token")
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(400, "Invalid reset token")
    except JWTError:
        raise HTTPException(400, "Invalid or expired reset token")
    
    db = get_database()
    try:
        user = await db.users.find_one({"_id": ObjectId(user_id)})
    except Exception:
        user = await db.users.find_one({"_id": user_id})
    
    if not user:
        raise HTTPException(400, "Invalid reset token")
    
    new_hash = get_password_hash(request.new_password)
    await db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {"password_hash": new_hash, "updated_at": datetime.utcnow()}}
    )
    
    return {"detail": "Password reset successfully"}


# ─── Admin Login ───────────────────────────────────────────
@router.post("/admin-login")
@limiter.limit("5/minute")
async def admin_login(request: Request, login_data: LoginRequest):
    """Admin-only login — requires role == 'admin'."""
    db = get_database()

    user = await db.users.find_one({"email": login_data.email})
    if not user or not verify_password(login_data.password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )

    if user.get("role", "").lower() not in ("platform_admin", "super_admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized — admin access only",
        )

    access_token = create_access_token(data={"sub": str(user["_id"])})
    refresh_token = create_refresh_token(data={"sub": str(user["_id"])})

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": {
            "id": str(user["_id"]),
            "email": user["email"],
            "name": user.get("name", "Admin"),
            "role": user["role"],
            "avatar": user.get("avatar"),
        },
    }
