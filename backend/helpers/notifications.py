"""
ReeveOS Notification Service
===========================
Central notification hub — email + SMS for all platform events.

TWO LAYERS:
  1. Legacy functions (notify_booking_created, notify_booking_cancelled) — used by existing routes
  2. New template-based system (send_templated_email, send_templated_sms, notify) — for all new features

New system uses:
  - helpers.email_base for HTML rendering
  - helpers.email_templates for 39 email templates
  - helpers.sms_templates for 30+ SMS templates
  - Resend API (httpx) for email delivery
  - helpers.sms.send_sms for SMS delivery (existing Sendly integration)
  - database.get_database() for logging + dedup
"""

import logging
import asyncio
import httpx
from datetime import datetime, timedelta
from typing import Optional, Dict
from database import get_database

logger = logging.getLogger(__name__)

# Lazy-loaded modules (avoid circular imports at startup)
_email_templates = None
_email_base = None
_sms_templates = None


def _get_email_modules():
    global _email_templates, _email_base
    if _email_templates is None:
        from helpers import email_templates as et
        from helpers import email_base as eb
        _email_templates = et
        _email_base = eb
    return _email_templates, _email_base


def _get_sms_module():
    global _sms_templates
    if _sms_templates is None:
        from helpers import sms_templates as st
        _sms_templates = st
    return _sms_templates


def _get_resend_key():
    try:
        from config import settings
        return settings.resend_api_key
    except Exception:
        import os
        return os.getenv("RESEND_API_KEY")


# ═══════════════════════════════════════════════════════
# TEMPLATE REGISTRY
# ═══════════════════════════════════════════════════════

EMAIL_TEMPLATE_MAP = {
    "booking_confirmed": "booking_confirmed",
    "reservation_confirmed": "reservation_confirmed",
    "reminder_24h": "reminder_24h",
    "cancelled_by_client": "cancelled_by_client",
    "cancelled_by_business": "cancelled_by_business",
    "no_show": "no_show",
    "rescheduled": "rescheduled",
    "form_request": "form_request",
    "form_reminder": "form_reminder",
    "form_flagged": "form_flagged",
    "form_blocked": "form_blocked",
    "form_expiring": "form_expiring",
    "aftercare": "aftercare",
    "review_request": "review_request",
    "welcome_client": "welcome_client",
    "lapsed_client": "lapsed_client",
    "package_progress": "package_progress",
    "payment_receipt": "payment_receipt",
    "payment_failed": "payment_failed",
    "refund": "refund_issued",
    "order_confirmed": "order_confirmed",
    "order_ready": "order_ready",
    "gift_voucher_received": "gift_voucher_received",
    "password_reset": "password_reset",
    "email_verification": "email_verification",
    "audit_report": "audit_report",
    "biz_welcome": "biz_welcome",
    "daily_brief": "daily_brief",
    "weekly_summary": "weekly_summary",
    "monthly_report": "monthly_report",
    "invoice": "invoice",
    "abandoned_cart": "abandoned_cart",
    "schedule_published": "schedule_published",
    "low_stock": "low_stock",
    "purchase_order": "purchase_order",
    "partner_invite": "partner_invite",
    "commission_payout": "commission_payout",
    "website_published": "website_published",
    "epos_end_of_day": "epos_end_of_day",
}

EMAIL_SUBJECTS = {
    "booking_confirmed": "Booking confirmed \u2014 {service}",
    "reservation_confirmed": "Table confirmed \u2014 {date}",
    "reminder_24h": "Reminder: {service} tomorrow at {time}",
    "cancelled_by_client": "Appointment cancelled",
    "cancelled_by_business": "Your appointment has been cancelled",
    "no_show": "We missed you today",
    "rescheduled": "Appointment updated \u2014 {service}",
    "form_request": "One quick step before your appointment",
    "form_reminder": "Your health form is still needed",
    "form_flagged": "Client form needs review \u2014 {client_name}",
    "form_blocked": "We need to talk before your appointment",
    "form_expiring": "Your health form is expiring soon",
    "aftercare": "Aftercare instructions \u2014 {service}",
    "review_request": "How did we do?",
    "welcome_client": "Welcome!",
    "lapsed_client": "We haven\u2019t seen you in a while",
    "package_progress": "Session {current} of {total} complete",
    "payment_receipt": "Payment received \u2014 \u00a3{amount}",
    "payment_failed": "Payment didn\u2019t go through",
    "refund": "Refund on its way \u2014 \u00a3{amount}",
    "order_confirmed": "Order confirmed \u2014 #{ref}",
    "order_ready": "Your order is ready!",
    "gift_voucher_received": "You\u2019ve received a \u00a3{amount} gift voucher!",
    "password_reset": "Reset your password",
    "email_verification": "Verify your email",
    "audit_report": "Your Business Audit is Ready",
    "biz_welcome": "Welcome to ReeveOS",
    "daily_brief": "Today at {biz_name}",
    "weekly_summary": "Your week in review",
    "monthly_report": "{month} Report",
    "invoice": "Your ReeveOS invoice",
    "abandoned_cart": "You left something behind",
    "schedule_published": "Your schedule for next week",
    "low_stock": "Stock running low",
    "purchase_order": "Purchase Order \u2014 {po_number}",
    "partner_invite": "You\u2019ve been invited to join ReeveOS",
    "commission_payout": "You\u2019ve earned \u00a3{amount} this month",
    "website_published": "Your website is live!",
    "epos_end_of_day": "End of day \u2014 {date}",
}

# Business-facing templates sent FROM "ReeveOS", not the business name
BUSINESS_FACING = {
    "biz_welcome", "daily_brief", "weekly_summary", "monthly_report",
    "invoice", "schedule_published", "low_stock", "form_flagged",
    "commission_payout", "website_published", "epos_end_of_day",
    "partner_invite", "purchase_order", "audit_report",
}


# ═══════════════════════════════════════════════════════
# NEW: TEMPLATE-BASED EMAIL SENDING
# ═══════════════════════════════════════════════════════

async def send_templated_email(
    to: str,
    template: str,
    business: dict,
    data: dict,
    dedup_key: str = None,
    dedup_window_hours: int = 24,
) -> dict:
    """Send an email using the new template system."""
    db = get_database()
    et, eb = _get_email_modules()

    # Dedup check
    if dedup_key and db:
        try:
            existing = await db.email_log.find_one({
                "dedup_key": dedup_key,
                "status": "sent",
                "sent_at": {"$gte": datetime.utcnow() - timedelta(hours=dedup_window_hours)}
            })
            if existing:
                logger.info(f"Dedup: skipping {template} to {to} (key={dedup_key})")
                return {"success": True, "message_id": None, "error": "duplicate_skipped"}
        except Exception as e:
            logger.warning(f"Dedup check failed: {e}")

    # Get template function
    fn_name = EMAIL_TEMPLATE_MAP.get(template)
    if not fn_name:
        logger.error(f"Unknown email template: {template}")
        return {"success": False, "message_id": None, "error": f"unknown_template: {template}"}

    fn = getattr(et, fn_name, None)
    if not fn:
        logger.error(f"Template function not found: {fn_name}")
        return {"success": False, "message_id": None, "error": f"missing_function: {fn_name}"}

    # Render body HTML
    try:
        body_html = fn(data)
    except Exception as e:
        logger.error(f"Template render error ({template}): {e}")
        return {"success": False, "message_id": None, "error": f"render_error: {str(e)}"}

    # Build business dict for wrapper
    is_biz_facing = template in BUSINESS_FACING
    biz_dict = {
        "name": "ReeveOS" if is_biz_facing else business.get("business_name", business.get("name", "ReeveOS")),
        "address": business.get("address", ""),
        "email": business.get("email", ""),
        "logo_url": business.get("logo_url"),
    }

    # White-label logic
    plan = business.get("plan", "free")
    show_powered = plan in ("free", "starter") and not is_biz_facing
    show_unsub = template in ("audit_report", "lapsed_client", "abandoned_cart", "partner_invite")

    full_html = eb.render_email(body_html, biz_dict, show_powered=show_powered, show_unsub=show_unsub)

    # Subject line
    subject_template = EMAIL_SUBJECTS.get(template, "Notification")
    try:
        subject = subject_template.format(**data)
    except (KeyError, IndexError):
        subject = subject_template

    # From config
    from_name = "ReeveOS" if is_biz_facing else business.get("business_name", business.get("name", "ReeveOS"))
    from_email = "notifications@send.reeveos.app"
    reply_to = business.get("email", "support@reeveos.app")

    # Send via Resend
    resend_key = _get_resend_key()
    if not resend_key:
        logger.error("RESEND_API_KEY not set")
        return {"success": False, "message_id": None, "error": "no_api_key"}

    result = {"success": False, "message_id": None, "error": None}

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.post(
                "https://api.resend.com/emails",
                headers={
                    "Authorization": f"Bearer {resend_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "from": f"{from_name} <{from_email}>",
                    "to": [to],
                    "reply_to": reply_to,
                    "subject": subject,
                    "html": full_html,
                }
            )
            if response.status_code in (200, 201):
                resp_data = response.json()
                result["success"] = True
                result["message_id"] = resp_data.get("id")
            else:
                result["error"] = f"resend_{response.status_code}: {response.text[:200]}"
                logger.error(f"Resend error: {result['error']}")
    except Exception as e:
        result["error"] = f"send_error: {str(e)}"
        logger.error(f"Email send error: {e}")

    # Log to MongoDB
    if db:
        try:
            await db.email_log.insert_one({
                "to": to,
                "template": template,
                "subject": subject,
                "business_id": str(business.get("_id", "")),
                "status": "sent" if result["success"] else "failed",
                "message_id": result.get("message_id"),
                "error": result.get("error"),
                "dedup_key": dedup_key,
                "sent_at": datetime.utcnow(),
            })
        except Exception as e:
            logger.error(f"Failed to log email: {e}")

    return result


# ═══════════════════════════════════════════════════════
# NEW: TEMPLATE-BASED SMS SENDING
# ═══════════════════════════════════════════════════════

async def send_templated_sms(
    to: str,
    template: str,
    business: dict,
    data: dict,
    dedup_key: str = None,
) -> dict:
    """Send an SMS using the new template system via existing Sendly helper."""
    db = get_database()
    st = _get_sms_module()

    # Dedup check
    if dedup_key and db:
        try:
            existing = await db.sms_log.find_one({
                "dedup_key": dedup_key,
                "status": "sent",
                "sent_at": {"$gte": datetime.utcnow() - timedelta(hours=1)}
            })
            if existing:
                logger.info(f"Dedup: skipping SMS {template} to {to}")
                return {"success": True, "error": "duplicate_skipped"}
        except Exception as e:
            logger.warning(f"SMS dedup check failed: {e}")

    # Get SMS text
    biz_dict = {"name": business.get("business_name", business.get("name", "ReeveOS"))}
    text = st.get_sms(template, biz_dict, data)

    if not text:
        logger.error(f"Unknown SMS template: {template}")
        return {"success": False, "error": f"unknown_template: {template}"}

    # Send via existing Sendly helper
    result = {"success": False, "error": None}
    try:
        from helpers.sms import send_sms as sendly_send
        sms_result = await sendly_send(to=to, body=text)
        result["success"] = sms_result.get("success", False)
        result["error"] = sms_result.get("error")
    except Exception as e:
        result["error"] = f"send_error: {str(e)}"
        logger.error(f"SMS send error: {e}")

    # Log to MongoDB
    if db:
        try:
            await db.sms_log.insert_one({
                "to": to,
                "template": template,
                "text": text,
                "business_id": str(business.get("_id", "")),
                "status": "sent" if result["success"] else "failed",
                "error": result.get("error"),
                "dedup_key": dedup_key,
                "sent_at": datetime.utcnow(),
            })
        except Exception as e:
            logger.error(f"Failed to log SMS: {e}")

    return result


# ═══════════════════════════════════════════════════════
# CONVENIENCE: SEND BOTH EMAIL + SMS
# ═══════════════════════════════════════════════════════

async def notify(
    email: str,
    phone: str,
    template: str,
    business: dict,
    data: dict,
    email_only: bool = False,
    sms_only: bool = False,
    dedup_key: str = None,
) -> dict:
    """Send both email and SMS for a notification event."""
    results = {"email": None, "sms": None}

    if not sms_only and email:
        results["email"] = await send_templated_email(
            to=email, template=template, business=business,
            data=data, dedup_key=f"email_{dedup_key}" if dedup_key else None,
        )

    if not email_only and phone:
        results["sms"] = await send_templated_sms(
            to=phone, template=template, business=business,
            data=data, dedup_key=f"sms_{dedup_key}" if dedup_key else None,
        )

    return results


# ═══════════════════════════════════════════════════════
# LEGACY FUNCTIONS — used by existing routes
# book.py imports notify_booking_created, notify_booking_cancelled
# DO NOT REMOVE
# ═══════════════════════════════════════════════════════

def _format_date(date_str: str) -> str:
    try:
        dt = datetime.strptime(date_str, "%Y-%m-%d")
        return dt.strftime("%A %d %B %Y")
    except Exception:
        return date_str


def _format_time(time_str: str) -> str:
    try:
        h, m = map(int, time_str.split(":"))
        suffix = "am" if h < 12 else "pm"
        display_h = h if h <= 12 else h - 12
        if display_h == 0:
            display_h = 12
        return f"{display_h}:{m:02d}{suffix}"
    except Exception:
        return time_str


async def notify_booking_created(booking: dict, business: dict):
    """
    Fire all notifications for a new booking.
    Called from routes/public/book.py after booking insert.
    Uses new template system for customer, legacy for owner alerts.
    """
    try:
        from models.normalize import normalize_booking
        nb = normalize_booking(booking)
        cust_name = nb["customer"]["name"] or "Guest"
        cust_email = nb["customer"]["email"]
        cust_phone = nb["customer"]["phone"]
        biz_name = business.get("name", "")
        date_str = nb["date"]
        time_str = nb["time"]
        party_size = nb["partySize"]
        reference = nb["reference"]
        formatted_date = _format_date(date_str)
        formatted_time = _format_time(time_str)
        booking_id = str(booking.get("_id", ""))
        slug = business.get("slug", "")

        biz_type = business.get("business_type", business.get("category", ""))
        template = "reservation_confirmed" if biz_type in ("restaurant", "cafe", "bar") else "booking_confirmed"

        service_name = ""
        service = booking.get("service")
        if isinstance(service, dict):
            service_name = service.get("name", "")
        elif isinstance(service, str):
            service_name = service

        data = {
            "client_name": cust_name.split()[0] if cust_name != "Guest" else "there",
            "business_name": biz_name,
            "service": service_name or "your appointment",
            "date": formatted_date,
            "time": formatted_time,
            "duration": str(booking.get("duration", "")),
            "staff": "",
            "staff_role": "",
            "booking_fee": str(booking.get("deposit_amount", 0)),
            "party_size": str(party_size) if party_size else "",
            "ref": reference or "",
            "location": business.get("address", ""),
            "needs_form": False,
            "form_url": f"https://portal.reeveos.app/client/{slug}/form",
            "link": f"https://portal.reeveos.app/book/{slug}/confirmation/{booking_id}",
            "reschedule_url": f"https://portal.reeveos.app/book/{slug}/reschedule/{booking_id}",
            "cancel_url": f"https://portal.reeveos.app/book/{slug}/cancel/{booking_id}",
        }

        # Staff info
        staff_id = booking.get("staff_id") or booking.get("staffId")
        if staff_id:
            db = get_database()
            if db:
                from bson import ObjectId
                try:
                    staff = await db.staff.find_one({"_id": ObjectId(str(staff_id))})
                    if staff:
                        data["staff"] = staff.get("name", "")
                        data["staff_role"] = staff.get("role", "")
                except Exception:
                    pass

        tasks = []

        # Customer: new template system
        if cust_email:
            tasks.append(send_templated_email(
                to=cust_email, template=template, business=business,
                data=data, dedup_key=f"booking_{booking_id}",
            ))
        if cust_phone:
            tasks.append(send_templated_sms(
                to=cust_phone, template=template, business=business,
                data=data, dedup_key=f"sms_booking_{booking_id}",
            ))

        # Owner: legacy system (still works fine)
        owner_email = business.get("email")
        if owner_email:
            try:
                from helpers.email import send_email as legacy_send, wrap_html, NOREPLY_FROM
                party_html = f'<p style="margin:4px 0 0;"><strong>Party size:</strong> {party_size} guests</p>' if party_size else ""
                notes = booking.get("notes", "")
                notes_html = f'<p style="margin:4px 0 0;"><strong>Notes:</strong> {notes}</p>' if notes else ""
                body = f"""
                <h2>New Booking</h2>
                <p>You have a new booking at <strong>{biz_name}</strong>.</p>
                <div style="background:#FFF8E7; border-left:4px solid #C9A84C; padding:16px; border-radius:0 8px 8px 0; margin:16px 0;">
                  <p style="margin:0;"><strong>Customer:</strong> {cust_name}</p>
                  <p style="margin:4px 0 0;"><strong>Date:</strong> {formatted_date}</p>
                  <p style="margin:4px 0 0;"><strong>Time:</strong> {formatted_time}</p>
                  {party_html}
                  <p style="margin:4px 0 0;"><strong>Ref:</strong> {reference}</p>
                  {notes_html}
                </div>
                <p style="text-align:center;"><a href="https://portal.reeveos.app/dashboard/bookings" class="cta">View in Dashboard</a></p>
                """
                html = wrap_html(body, preheader=f"New booking: {cust_name} \u2014 {formatted_date}")
                tasks.append(legacy_send(
                    to=owner_email,
                    subject=f"New Booking: {cust_name} \u2014 {formatted_date} at {formatted_time}",
                    html=html, from_email=NOREPLY_FROM,
                ))
            except Exception as e:
                logger.error(f"Owner alert email setup failed: {e}")

        owner_phone = business.get("phone")
        if owner_phone:
            try:
                from helpers.sms import send_sms as sendly_send, new_booking_alert_sms
                msg = new_booking_alert_sms(
                    client_name=cust_name, booking_date=formatted_date,
                    booking_time=formatted_time, party_size=party_size,
                )
                tasks.append(sendly_send(to=owner_phone, body=msg))
            except Exception as e:
                logger.error(f"Owner alert SMS setup failed: {e}")

        if tasks:
            results = await asyncio.gather(*tasks, return_exceptions=True)
            db = get_database()
            if db:
                await db.bookings.update_one(
                    {"_id": booking["_id"]},
                    {"$set": {
                        "notifications.confirmationSent": True,
                        "notifications.confirmationSentAt": datetime.utcnow(),
                        "updatedAt": datetime.utcnow(),
                    }}
                )
            successes = sum(1 for r in results if isinstance(r, dict) and r.get("success"))
            failures = sum(1 for r in results if isinstance(r, dict) and not r.get("success"))
            errors = sum(1 for r in results if isinstance(r, Exception))
            logger.info(f"Booking {booking_id} notifications: {successes} sent, {failures} failed, {errors} errors")
            for r in results:
                if isinstance(r, Exception):
                    logger.error(f"Notification error: {r}")

    except Exception as e:
        logger.error(f"notify_booking_created failed: {e}")


async def notify_booking_cancelled(booking: dict, business: dict, cancelled_by: str = "customer"):
    """Notify when a booking is cancelled. Uses new template system for customer."""
    try:
        tasks = []
        cust = booking.get("customer", {})
        cust_name = cust.get("name", "Guest")
        cust_email = cust.get("email")
        cust_phone = cust.get("phone")
        biz_name = business.get("name", "")
        formatted_date = _format_date(booking.get("date", ""))
        formatted_time = _format_time(booking.get("time", ""))
        booking_id = str(booking.get("_id", ""))
        slug = business.get("slug", "")

        template = "cancelled_by_client" if cancelled_by == "customer" else "cancelled_by_business"

        service_name = ""
        service = booking.get("service")
        if isinstance(service, dict):
            service_name = service.get("name", "")
        elif isinstance(service, str):
            service_name = service

        data = {
            "client_name": cust_name.split()[0] if cust_name != "Guest" else "there",
            "service": service_name or "your appointment",
            "date": formatted_date,
            "time": formatted_time,
            "booking_fee": str(booking.get("deposit_amount", 0)),
            "within_window": False,
            "reason": booking.get("cancellation_reason", ""),
            "rebook_url": f"https://portal.reeveos.app/book/{slug}",
            "link": f"https://portal.reeveos.app/book/{slug}",
        }

        if cust_email:
            tasks.append(send_templated_email(
                to=cust_email, template=template, business=business,
                data=data, dedup_key=f"cancel_{booking_id}",
            ))
        if cust_phone:
            tasks.append(send_templated_sms(
                to=cust_phone, template=template, business=business,
                data=data, dedup_key=f"sms_cancel_{booking_id}",
            ))

        # Owner notification (legacy)
        owner_email = business.get("email")
        if owner_email:
            try:
                from helpers.email import send_email as legacy_send, wrap_html, NOREPLY_FROM
                body = f"""
                <h2>Booking Cancelled</h2>
                <p><strong>{cust_name}</strong> has cancelled their booking.</p>
                <div style="background:#fef2f2; border-left:4px solid #dc2626; padding:16px; border-radius:0 8px 8px 0; margin:16px 0;">
                  <p style="margin:0;"><strong>Date:</strong> {formatted_date}</p>
                  <p style="margin:4px 0 0;"><strong>Time:</strong> {formatted_time}</p>
                  <p style="margin:4px 0 0;"><strong>Cancelled by:</strong> {cancelled_by}</p>
                </div>
                """
                html = wrap_html(body, preheader=f"{cust_name} cancelled their booking")
                tasks.append(legacy_send(
                    to=owner_email,
                    subject=f"Booking Cancelled: {cust_name} \u2014 {formatted_date}",
                    html=html, from_email=NOREPLY_FROM,
                ))
            except Exception as e:
                logger.error(f"Owner cancel alert failed: {e}")

        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)

    except Exception as e:
        logger.error(f"notify_booking_cancelled failed: {e}")
