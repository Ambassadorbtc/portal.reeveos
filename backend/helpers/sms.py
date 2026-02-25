"""
Rezvo SMS Service
=================
SMS notifications via Twilio.
Twilio free trial: ~$15 credit, ~£0.04/SMS to UK numbers.
Twilio Pay-as-you-go: no monthly fee, just per-message.
"""

import logging
from typing import Optional, Dict
from config import settings

logger = logging.getLogger(__name__)

_twilio_client = None


def _get_client():
    global _twilio_client
    if _twilio_client is None:
        if not settings.twilio_account_sid or not settings.twilio_auth_token:
            return None
        from twilio.rest import Client
        _twilio_client = Client(settings.twilio_account_sid, settings.twilio_auth_token)
    return _twilio_client


async def send_sms(to: str, body: str) -> Dict:
    """
    Send an SMS via Twilio.
    `to` should be E.164 format, e.g. +447700900000
    Returns: {"success": True/False, "sid": "...", "error": "..."}
    """
    if not settings.twilio_phone_number:
        logger.warning("Twilio not configured — SMS not sent")
        return {"success": False, "error": "SMS service not configured"}

    client = _get_client()
    if not client:
        return {"success": False, "error": "Twilio credentials missing"}

    # Normalise UK numbers
    to = normalise_uk_phone(to)
    if not to:
        return {"success": False, "error": "Invalid phone number"}

    try:
        message = client.messages.create(
            body=body,
            from_=settings.twilio_phone_number,
            to=to,
        )
        logger.info(f"SMS sent to {to}: {message.sid}")
        return {"success": True, "sid": message.sid, "to": to}
    except Exception as e:
        logger.error(f"SMS failed to {to}: {str(e)}")
        return {"success": False, "error": str(e), "to": to}


def normalise_uk_phone(phone: str) -> Optional[str]:
    """Convert UK phone to E.164 format."""
    if not phone:
        return None
    # Strip spaces, dashes, dots
    phone = phone.replace(" ", "").replace("-", "").replace(".", "").strip()
    # Already E.164
    if phone.startswith("+") and len(phone) >= 12:
        return phone
    # UK format: 07xxx → +447xxx
    if phone.startswith("07") and len(phone) == 11:
        return f"+44{phone[1:]}"
    # Already has 44 prefix without +
    if phone.startswith("44") and len(phone) >= 12:
        return f"+{phone}"
    # International format without +
    if phone.startswith("00"):
        return f"+{phone[2:]}"
    return None


# ─── SMS Templates ─── #

def booking_confirmation_sms(
    client_name: str,
    business_name: str,
    booking_date: str,
    booking_time: str,
    party_size: int = 0,
    reference: str = "",
) -> str:
    """Customer booking confirmation SMS."""
    party = f" for {party_size}" if party_size else ""
    return (
        f"Hi {client_name}! Your booking at {business_name} is confirmed.\n"
        f"📅 {booking_date} at {booking_time}{party}\n"
        f"Ref: {reference}\n"
        f"— Powered by Rezvo"
    )


def new_booking_alert_sms(
    client_name: str,
    booking_date: str,
    booking_time: str,
    party_size: int = 0,
    channel: str = "online",
) -> str:
    """Owner/staff new booking alert SMS."""
    party = f" ({party_size} guests)" if party_size else ""
    return (
        f"🔔 New booking: {client_name}{party}\n"
        f"{booking_date} at {booking_time}\n"
        f"Via: {channel}\n"
        f"— Rezvo"
    )


def booking_cancelled_sms(
    client_name: str,
    business_name: str,
    booking_date: str,
    booking_time: str,
) -> str:
    """Customer cancellation confirmation SMS."""
    return (
        f"Hi {client_name}, your booking at {business_name} on "
        f"{booking_date} at {booking_time} has been cancelled.\n"
        f"— Rezvo"
    )


def booking_reminder_sms(
    client_name: str,
    business_name: str,
    booking_date: str,
    booking_time: str,
) -> str:
    """Booking reminder SMS (24h before)."""
    return (
        f"Reminder: {client_name}, your booking at {business_name} is "
        f"tomorrow at {booking_time}.\n"
        f"See you there! — Rezvo"
    )
