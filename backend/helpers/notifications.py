"""
ReeveOS Notification Service
===========================
Orchestrates email + SMS for booking lifecycle events.
Fires asynchronously so booking creation doesn't block.

Events handled:
  - booking_created: customer confirmation + owner alert
  - booking_cancelled: customer + owner notification
  - booking_updated: customer notification of changes
  - booking_reminder: 24h before (triggered by scheduler)
"""

import logging
import asyncio
from datetime import datetime
from typing import Optional, Dict
from database import get_database

logger = logging.getLogger(__name__)


def _format_date(date_str: str) -> str:
    """Convert 2026-02-26 to 'Wednesday 26 February 2026'."""
    try:
        dt = datetime.strptime(date_str, "%Y-%m-%d")
        return dt.strftime("%A %d %B %Y")
    except Exception:
        return date_str


def _format_time(time_str: str) -> str:
    """Convert 14:30 to '2:30pm'."""
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
    Called after booking is inserted into DB.
    Runs email + SMS in parallel, never blocks the booking response.
    """
    try:
        tasks = []

        cust = booking.get("customer", {})
        cust_name = cust.get("name", "Guest")
        cust_email = cust.get("email")
        cust_phone = cust.get("phone")
        biz_name = business.get("name", "")
        date_str = booking.get("date", "")
        time_str = booking.get("time", "")
        party_size = booking.get("partySize", 0)
        reference = booking.get("reference", "")
        status = booking.get("status", "confirmed")
        formatted_date = _format_date(date_str)
        formatted_time = _format_time(time_str)
        manage_url = f"https://portal.reeveos.app/book/{business.get('slug', '')}/booking/{booking.get('_id', '')}"

        # ── Customer confirmation email ──
        if cust_email:
            tasks.append(_send_customer_confirmation_email(
                to=cust_email,
                client_name=cust_name,
                business_name=biz_name,
                booking_date=formatted_date,
                booking_time=formatted_time,
                party_size=party_size,
                reference=reference,
                manage_url=manage_url,
                status=status,
                service=booking.get("service"),
            ))

        # ── Customer confirmation SMS ──
        if cust_phone:
            tasks.append(_send_customer_confirmation_sms(
                to=cust_phone,
                client_name=cust_name,
                business_name=biz_name,
                booking_date=formatted_date,
                booking_time=formatted_time,
                party_size=party_size,
                reference=reference,
            ))

        # ── Owner/staff alert email ──
        owner_email = business.get("email")
        if owner_email:
            tasks.append(_send_owner_alert_email(
                to=owner_email,
                business_name=biz_name,
                client_name=cust_name,
                client_phone=cust_phone or "Not provided",
                booking_date=formatted_date,
                booking_time=formatted_time,
                party_size=party_size,
                reference=reference,
                notes=booking.get("notes", ""),
                occasion=booking.get("occasion", ""),
                channel=booking.get("channel", "online"),
            ))

        # ── Owner/staff alert SMS ──
        owner_phone = business.get("phone")
        if owner_phone:
            tasks.append(_send_owner_alert_sms(
                to=owner_phone,
                client_name=cust_name,
                booking_date=formatted_date,
                booking_time=formatted_time,
                party_size=party_size,
            ))

        # ── Also notify all staff with notifications enabled ──
        for staff in business.get("staff", []):
            staff_phone = staff.get("phone")
            if staff_phone and staff_phone != owner_phone:
                # Only send to staff with manager/owner permissions or notification enabled
                perms = staff.get("permissions", "staff")
                if perms in ("owner", "manager", "admin"):
                    tasks.append(_send_owner_alert_sms(
                        to=staff_phone,
                        client_name=cust_name,
                        booking_date=formatted_date,
                        booking_time=formatted_time,
                        party_size=party_size,
                    ))

        # Fire all notifications in parallel
        if tasks:
            results = await asyncio.gather(*tasks, return_exceptions=True)

            # Update booking notification flags
            db = get_database()
            await db.bookings.update_one(
                {"_id": booking["_id"]},
                {"$set": {
                    "notifications.confirmationSent": True,
                    "notifications.confirmationSentAt": datetime.utcnow(),
                    "updatedAt": datetime.utcnow(),
                }}
            )

            # Log results
            successes = sum(1 for r in results if isinstance(r, dict) and r.get("success"))
            failures = sum(1 for r in results if isinstance(r, dict) and not r.get("success"))
            errors = sum(1 for r in results if isinstance(r, Exception))
            logger.info(f"Booking {booking['_id']} notifications: {successes} sent, {failures} failed, {errors} errors")

            for r in results:
                if isinstance(r, Exception):
                    logger.error(f"Notification error: {r}")

    except Exception as e:
        logger.error(f"notify_booking_created failed: {e}")


async def notify_booking_cancelled(booking: dict, business: dict, cancelled_by: str = "customer"):
    """Notify when a booking is cancelled."""
    try:
        tasks = []
        cust = booking.get("customer", {})
        cust_name = cust.get("name", "Guest")
        biz_name = business.get("name", "")
        formatted_date = _format_date(booking.get("date", ""))
        formatted_time = _format_time(booking.get("time", ""))

        # Customer cancellation email
        cust_email = cust.get("email")
        if cust_email:
            from helpers.email import send_email, wrap_html
            body = f"""
            <h2>Booking Cancelled</h2>
            <p>Hi {cust_name},</p>
            <p>Your booking at <strong>{biz_name}</strong> has been cancelled.</p>
            <div style="background:#fef2f2; border-left:4px solid #dc2626; padding:16px; border-radius:0 8px 8px 0; margin:16px 0;">
              <p style="margin:0;"><strong>Date:</strong> {formatted_date}</p>
              <p style="margin:4px 0 0;"><strong>Time:</strong> {formatted_time}</p>
            </div>
            <p>Want to rebook? <a href="https://portal.reeveos.app/book/{business.get('slug', '')}" class="cta">Book Again</a></p>
            """
            html = wrap_html(body, preheader=f"Your booking at {biz_name} has been cancelled")
            tasks.append(send_email(
                to=cust_email,
                subject=f"Booking Cancelled — {biz_name}",
                html=html,
                tags=[{"name": "type", "value": "booking_cancelled"}],
            ))

        # Customer cancellation SMS
        cust_phone = cust.get("phone")
        if cust_phone:
            from helpers.sms import send_sms, booking_cancelled_sms
            msg = booking_cancelled_sms(cust_name, biz_name, formatted_date, formatted_time)
            tasks.append(send_sms(to=cust_phone, body=msg))

        # Owner notification
        owner_email = business.get("email")
        if owner_email:
            from helpers.email import send_email, wrap_html, NOREPLY_FROM
            body = f"""
            <h2>Booking Cancelled ❌</h2>
            <p><strong>{cust_name}</strong> has cancelled their booking.</p>
            <div style="background:#fef2f2; border-left:4px solid #dc2626; padding:16px; border-radius:0 8px 8px 0; margin:16px 0;">
              <p style="margin:0;"><strong>Date:</strong> {formatted_date}</p>
              <p style="margin:4px 0 0;"><strong>Time:</strong> {formatted_time}</p>
              <p style="margin:4px 0 0;"><strong>Cancelled by:</strong> {cancelled_by}</p>
            </div>
            """
            html = wrap_html(body, preheader=f"{cust_name} cancelled their booking")
            tasks.append(send_email(
                to=owner_email,
                subject=f"Booking Cancelled: {cust_name} — {formatted_date}",
                html=html,
                from_email=NOREPLY_FROM,
                tags=[{"name": "type", "value": "booking_cancelled_owner"}],
            ))

        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)

    except Exception as e:
        logger.error(f"notify_booking_cancelled failed: {e}")


# ─── Internal send helpers ─── #

async def _send_customer_confirmation_email(**kwargs) -> Dict:
    """Send booking confirmation email to customer."""
    try:
        from helpers.email import send_booking_confirmation
        return await send_booking_confirmation(
            to=kwargs["to"],
            client_name=kwargs["client_name"],
            business_name=kwargs["business_name"],
            booking_date=kwargs["booking_date"],
            booking_time=kwargs["booking_time"],
            party_size=kwargs.get("party_size", 0),
            service_name=(kwargs.get("service") or {}).get("name", ""),
            booking_ref=kwargs.get("reference", ""),
            manage_url=kwargs.get("manage_url", ""),
        )
    except Exception as e:
        logger.error(f"Customer confirmation email failed: {e}")
        return {"success": False, "error": str(e)}


async def _send_customer_confirmation_sms(**kwargs) -> Dict:
    """Send booking confirmation SMS to customer."""
    try:
        from helpers.sms import send_sms, booking_confirmation_sms
        msg = booking_confirmation_sms(
            client_name=kwargs["client_name"],
            business_name=kwargs["business_name"],
            booking_date=kwargs["booking_date"],
            booking_time=kwargs["booking_time"],
            party_size=kwargs.get("party_size", 0),
            reference=kwargs.get("reference", ""),
        )
        return await send_sms(to=kwargs["to"], body=msg)
    except Exception as e:
        logger.error(f"Customer confirmation SMS failed: {e}")
        return {"success": False, "error": str(e)}


async def _send_owner_alert_email(**kwargs) -> Dict:
    """Send new booking alert email to restaurant owner."""
    try:
        from helpers.email import send_email, wrap_html, NOREPLY_FROM

        notes_html = ""
        if kwargs.get("notes"):
            notes_html = f'<p style="margin:4px 0 0;"><strong>Notes:</strong> {kwargs["notes"]}</p>'
        occasion_html = ""
        if kwargs.get("occasion"):
            occasion_html = f'<p style="margin:4px 0 0;"><strong>Occasion:</strong> {kwargs["occasion"]}</p>'

        party_html = ""
        if kwargs.get("party_size"):
            party_html = f'<p style="margin:4px 0 0;"><strong>Party size:</strong> {kwargs["party_size"]} guests</p>'

        body = f"""
        <h2>New Booking 🔔</h2>
        <p>You have a new booking at <strong>{kwargs['business_name']}</strong>.</p>
        <div style="background:#f0fdf4; border-left:4px solid #1B4332; padding:16px; border-radius:0 8px 8px 0; margin:16px 0;">
          <p style="margin:0;"><strong>Customer:</strong> {kwargs['client_name']}</p>
          <p style="margin:4px 0 0;"><strong>Phone:</strong> {kwargs['client_phone']}</p>
          <p style="margin:4px 0 0;"><strong>Date:</strong> {kwargs['booking_date']}</p>
          <p style="margin:4px 0 0;"><strong>Time:</strong> {kwargs['booking_time']}</p>
          {party_html}
          <p style="margin:4px 0 0;"><strong>Ref:</strong> {kwargs['reference']}</p>
          <p style="margin:4px 0 0;"><strong>Booked via:</strong> {kwargs['channel']}</p>
          {occasion_html}
          {notes_html}
        </div>
        <p style="text-align:center;"><a href="https://portal.reeveos.app/dashboard/bookings" class="cta">View in Dashboard</a></p>
        """

        html = wrap_html(body, preheader=f"New booking: {kwargs['client_name']} — {kwargs['booking_date']}")

        return await send_email(
            to=kwargs["to"],
            subject=f"🔔 New Booking: {kwargs['client_name']} — {kwargs['booking_date']} at {kwargs['booking_time']}",
            html=html,
            from_email=NOREPLY_FROM,
            tags=[{"name": "type", "value": "new_booking_owner"}],
        )
    except Exception as e:
        logger.error(f"Owner alert email failed: {e}")
        return {"success": False, "error": str(e)}


async def _send_owner_alert_sms(**kwargs) -> Dict:
    """Send new booking alert SMS to restaurant owner/manager."""
    try:
        from helpers.sms import send_sms, new_booking_alert_sms
        msg = new_booking_alert_sms(
            client_name=kwargs["client_name"],
            booking_date=kwargs["booking_date"],
            booking_time=kwargs["booking_time"],
            party_size=kwargs.get("party_size", 0),
        )
        return await send_sms(to=kwargs["to"], body=msg)
    except Exception as e:
        logger.error(f"Owner alert SMS failed: {e}")
        return {"success": False, "error": str(e)}
