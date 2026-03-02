"""
Input validation & sanitisation helpers.
Used across routes to validate emails, phones, and sanitise text.
"""
import re
from fastapi import HTTPException

EMAIL_RE = re.compile(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$')
UK_PHONE_RE = re.compile(r'^(\+44|0)\d{9,10}$')
STRIP_TAGS_RE = re.compile(r'<[^>]+>')


def validate_email(email: str) -> str:
    """Validate and normalise email."""
    email = email.strip().lower()
    if not EMAIL_RE.match(email):
        raise HTTPException(400, "Invalid email address")
    if len(email) > 254:
        raise HTTPException(400, "Email too long")
    return email


def validate_phone(phone: str) -> str:
    """Validate UK phone number format."""
    phone = re.sub(r'[\s\-\(\)]', '', phone.strip())
    if not UK_PHONE_RE.match(phone):
        raise HTTPException(400, "Invalid UK phone number")
    return phone


def sanitise_text(text: str, max_length: int = 2000) -> str:
    """Strip HTML tags and enforce max length."""
    if not text:
        return ""
    text = STRIP_TAGS_RE.sub('', text)
    text = text.strip()
    if len(text) > max_length:
        text = text[:max_length]
    return text


def validate_party_size(size: int, max_size: int = 30) -> int:
    """Validate booking party size."""
    if size < 1:
        raise HTTPException(400, "Party size must be at least 1")
    if size > max_size:
        raise HTTPException(400, f"Party size cannot exceed {max_size}. Please call for large bookings.")
    return size


def validate_business_id(bid: str) -> str:
    """Basic ObjectId format check."""
    if not bid or len(bid) != 24 or not re.match(r'^[0-9a-fA-F]{24}$', bid):
        raise HTTPException(400, "Invalid business ID")
    return bid
