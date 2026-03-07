"""
ReeveOS Background Scheduler
============================
Runs periodic tasks:
- Process drip email queue (every 15 min)
- Send booking reminders (every hour)
- Process aftercare email queue (every 5 min)
- Check insights report expiry for drip emails (daily)
"""

import asyncio
import logging
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

_scheduler_task = None


async def _run_scheduler():
    """Main scheduler loop."""
    from routes.dashboard.marketing import process_drip_queue
    from database import get_database

    logger.info("Email scheduler started")

    drip_interval = 15 * 60     # 15 minutes
    reminder_interval = 60 * 60  # 1 hour
    aftercare_interval = 5 * 60  # 5 minutes
    insights_interval = 24 * 60 * 60  # 24 hours

    last_drip = datetime.utcnow()
    last_reminder = datetime.utcnow()
    last_aftercare = datetime.utcnow()
    last_insights = datetime.utcnow()

    while True:
        try:
            now = datetime.utcnow()

            # ─── Process Drip Queue ─── #
            if (now - last_drip).total_seconds() >= drip_interval:
                try:
                    result = await process_drip_queue()
                    if result.get("processed", 0) > 0:
                        logger.info(f"Drip queue: processed {result['processed']} enrollments")
                    last_drip = now
                except Exception as e:
                    logger.error(f"Drip queue error: {e}")

            # ─── Send Booking Reminders ─── #
            if (now - last_reminder).total_seconds() >= reminder_interval:
                try:
                    await _send_booking_reminders()
                    last_reminder = now
                except Exception as e:
                    logger.error(f"Booking reminder error: {e}")

            # ─── Process Aftercare Email Queue ─── #
            if (now - last_aftercare).total_seconds() >= aftercare_interval:
                try:
                    await _process_aftercare_queue()
                    last_aftercare = now
                except Exception as e:
                    logger.error(f"Aftercare queue error: {e}")

            # ─── Insights Report Drip ─── #
            if (now - last_insights).total_seconds() >= insights_interval:
                try:
                    await _send_insights_drip_emails()
                    last_insights = now
                except Exception as e:
                    logger.error(f"Insights drip error: {e}")

            # ─── AI Agent Tasks ─── #
            try:
                from agent.scheduler import run_agent_tick
                await run_agent_tick()
            except Exception as e:
                logger.error(f"Agent tick error: {e}")

            await asyncio.sleep(60)  # Check every minute

        except asyncio.CancelledError:
            logger.info("Email scheduler stopped")
            break
        except Exception as e:
            logger.error(f"Scheduler error: {e}")
            await asyncio.sleep(60)


async def _send_booking_reminders():
    """Send 24h and 2h booking reminders via email AND SMS."""
    from database import get_database
    from helpers.email import send_booking_reminder

    db = get_database()
    if not db:
        return

    now = datetime.utcnow()

    # 24-hour reminders
    window_24h_start = now + timedelta(hours=23, minutes=30)
    window_24h_end = now + timedelta(hours=24, minutes=30)

    bookings_24h = await db.bookings.find({
        "status": {"$in": ["confirmed", "pending"]},
        "date": {"$gte": window_24h_start.isoformat()[:10], "$lte": window_24h_end.isoformat()[:10]},
        "reminder_24h_sent": {"$ne": True},
    }).to_list(100)

    sms_sent = 0
    for booking in bookings_24h:
        from models.normalize import normalize_booking
        nb = normalize_booking(booking)
        email = nb["customer"]["email"]
        phone = nb["customer"].get("phone", "")
        client_name = nb["customer"]["name"] or "there"

        # Get business name
        business = await db.businesses.find_one({"_id": nb["businessId"]})
        if not business:
            from bson import ObjectId
            try:
                business = await db.businesses.find_one({"_id": ObjectId(nb["businessId"])})
            except Exception:
                pass
        business_name = business.get("name", "") if business else ""

        # Email reminder
        if email:
            try:
                await send_booking_reminder(
                    to=email,
                    client_name=client_name,
                    business_name=business_name,
                    booking_date=nb["date"],
                    booking_time=nb["time"],
                    hours_until=24,
                    manage_url=f"https://reeveos.app/bookings/{booking['_id']}",
                )
            except Exception as e:
                logger.error(f"Email reminder failed for {email}: {e}")

        # SMS reminder (parallel to email)
        if phone:
            try:
                from helpers.sms import send_sms, booking_reminder_sms
                sms_body = booking_reminder_sms(
                    client_name=client_name.split()[0] if client_name != "there" else "there",
                    business_name=business_name,
                    booking_date=nb["date"],
                    booking_time=nb["time"],
                )
                await send_sms(phone, sms_body)
                sms_sent += 1
            except Exception as e:
                logger.error(f"SMS reminder failed for {phone}: {e}")

        await db.bookings.update_one(
            {"_id": booking["_id"]},
            {"$set": {"reminder_24h_sent": True}},
        )

    # 2-hour reminders (similar logic)
    window_2h_start = now + timedelta(hours=1, minutes=30)
    window_2h_end = now + timedelta(hours=2, minutes=30)

    # For 2h reminders we'd need datetime comparison, not just date
    # This is simplified — in production you'd combine date + time fields

    if bookings_24h:
        logger.info(f"Sent {len(bookings_24h)} booking reminders (24h email + {sms_sent} SMS)")


async def _process_aftercare_queue():
    """
    Process queued aftercare emails — sent 15-30 min after appointment completion.
    Templates per treatment type: microneedling, peel, rf, polynucleotides, lymphatic, dermaplaning.
    """
    from database import get_database
    from scripts.send_aftercare import AFTERCARE_CONTENT

    db = get_database()
    if not db:
        return

    now = datetime.utcnow()
    queue = await db.aftercare_queue.find({
        "sent": False,
        "send_after": {"$lte": now},
    }).to_list(50)

    if not queue:
        return

    sent_count = 0
    for item in queue:
        treatment_type = item.get("treatment_type", "")
        content = AFTERCARE_CONTENT.get(treatment_type)
        if not content:
            await db.aftercare_queue.update_one({"_id": item["_id"]}, {"$set": {"sent": True, "skipped": True}})
            continue

        client_email = item.get("client_email")
        client_name = item.get("client_name", "")
        business_id = item.get("business_id")

        biz = await db.businesses.find_one({"_id": business_id}) if business_id else None
        biz_name = (biz or {}).get("name", "Your Clinic")

        try:
            from helpers.email import send_email
            await send_email(
                to=client_email,
                subject=content["subject"],
                body=f"Hi {client_name},\n\n{content['body']}\n\nWarm regards,\n{biz_name}",
                from_name=biz_name,
            )
            sent_count += 1
        except Exception as e:
            logger.error(f"Aftercare email failed for {client_email}: {e}")

        await db.aftercare_queue.update_one(
            {"_id": item["_id"]},
            {"$set": {"sent": True, "sent_at": now}}
        )

        # Insurance documentation log
        await db.aftercare_log.insert_one({
            "business_id": business_id,
            "booking_id": item.get("booking_id"),
            "client_email": client_email,
            "client_name": client_name,
            "treatment_type": treatment_type,
            "treatment_name": item.get("treatment_name", treatment_type),
            "sent_at": now,
            "template_subject": content["subject"],
        })

    if sent_count:
        logger.info(f"Aftercare: sent {sent_count}/{len(queue)} emails")


async def _send_insights_drip_emails():
    """
    Check insights reports and send drip emails at:
    - 10 days before expiry
    - 5 days before expiry
    - 1 day before expiry
    """
    from database import get_database
    from helpers.email import send_insights_reminder

    db = get_database()
    if not db:
        return

    now = datetime.utcnow()

    # Find reports with owner emails that haven't been fully dripped
    reports = await db.insights_reports.find({
        "owner_email": {"$exists": True, "$ne": ""},
        "expires_at": {"$gte": now},
    }).to_list(200)

    sent_count = 0

    for report in reports:
        expires_at = report.get("expires_at")
        if not isinstance(expires_at, datetime):
            continue

        days_left = (expires_at - now).days
        drip_sent = report.get("drip_sent", [])

        # Determine which drip to send
        drip_day = None
        if days_left <= 1 and "1_day" not in drip_sent:
            drip_day = "1_day"
        elif days_left <= 5 and "5_day" not in drip_sent:
            drip_day = "5_day"
        elif days_left <= 10 and "10_day" not in drip_sent:
            drip_day = "10_day"

        if not drip_day:
            continue

        slug = report.get("slug", "")
        report_url = f"https://reeveos.app/insights/{slug}"

        await send_insights_reminder(
            to=report["owner_email"],
            owner_name=report.get("owner_name", "there"),
            business_name=report.get("business_name", "your business"),
            report_url=report_url,
            days_left=days_left,
        )

        # Mark drip as sent
        await db.insights_reports.update_one(
            {"_id": report["_id"]},
            {"$push": {"drip_sent": drip_day}},
        )
        sent_count += 1

    if sent_count:
        logger.info(f"Sent {sent_count} insights drip emails")


def start_scheduler():
    """Start the background scheduler. Call from app lifespan."""
    global _scheduler_task
    loop = asyncio.get_event_loop()
    _scheduler_task = loop.create_task(_run_scheduler())
    return _scheduler_task


def stop_scheduler():
    """Stop the background scheduler."""
    global _scheduler_task
    if _scheduler_task:
        _scheduler_task.cancel()
