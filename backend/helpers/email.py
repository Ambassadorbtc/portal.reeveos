"""
Rezvo Email Service
====================
Core email engine using Resend API.
Handles: transactional emails, campaign blasts, drip sequences, tracking.

Resend free tier: 3,000 emails/month, 100/day
Resend Pro ($20/mo): 50,000 emails/month, no daily limit
"""

import resend
import logging
import hashlib
import hmac
from datetime import datetime
from typing import Optional, List, Dict, Any
from config import settings
from database import get_database

logger = logging.getLogger(__name__)

# ─── Resend Setup ─── #

resend.api_key = settings.resend_api_key

# Sending domains & from addresses
DEFAULT_FROM = "Rezvo <bookings@mail.rezvo.app>"
CAMPAIGNS_FROM = "Rezvo <campaigns@mail.rezvo.app>"
INSIGHTS_FROM = "Rezvo Website Review <reviews@mail.rezvo.app>"
NOREPLY_FROM = "Rezvo <noreply@mail.rezvo.app>"

# For multi-domain strategy (future)
DOMAIN_MAP = {
    "transactional": "mail.rezvo.app",        # booking confirmations, password resets
    "campaigns": "mail.rezvo.app",            # owner marketing campaigns
    "insights": "mail.rezvo.app",             # audit reports, drip campaigns
    "growth": "mail.rezvo.app",               # warm lead outreach, diner notifications
}


# ─── Template Engine ─── #

def render_template(template: str, variables: Dict[str, Any]) -> str:
    """Simple variable substitution: {variable_name} → value."""
    rendered = template
    for key, value in variables.items():
        rendered = rendered.replace(f"{{{key}}}", str(value) if value else "")
    return rendered


def wrap_html(body_html: str, preheader: str = "") -> str:
    """Wrap content in a responsive email template with Rezvo branding."""
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>Rezvo</title>
<!--[if mso]><style>body,table,td{{font-family:Arial,Helvetica,sans-serif!important;}}</style><![endif]-->
<style>
  body {{ margin:0; padding:0; background:#f4f4f5; -webkit-font-smoothing:antialiased; }}
  .wrapper {{ width:100%; background:#f4f4f5; padding:32px 0; }}
  .container {{ max-width:600px; margin:0 auto; background:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 1px 3px rgba(0,0,0,0.08); }}
  .header {{ background:#1B4332; padding:24px 32px; text-align:center; }}
  .header img {{ height:32px; }}
  .header h1 {{ color:#ffffff; font-family:'Figtree',Arial,sans-serif; font-size:20px; margin:0; font-weight:600; letter-spacing:-0.01em; }}
  .body {{ padding:32px; font-family:'Figtree',Arial,sans-serif; color:#1a1a1a; font-size:15px; line-height:1.6; }}
  .body h2 {{ color:#1B4332; font-size:18px; margin:0 0 16px; font-weight:600; }}
  .body p {{ margin:0 0 16px; }}
  .body a {{ color:#1B4332; font-weight:500; }}
  .cta {{ display:inline-block; background:#1B4332; color:#ffffff!important; padding:12px 28px; border-radius:8px; text-decoration:none; font-weight:600; font-size:15px; margin:8px 0; }}
  .cta:hover {{ background:#2D6A4F; }}
  .footer {{ padding:24px 32px; background:#f9fafb; text-align:center; font-size:12px; color:#9ca3af; font-family:'Figtree',Arial,sans-serif; border-top:1px solid #e5e7eb; }}
  .footer a {{ color:#6b7280; text-decoration:underline; }}
  .preheader {{ display:none!important; visibility:hidden; mso-hide:all; font-size:1px; color:#f4f4f5; line-height:1px; max-height:0; max-width:0; opacity:0; overflow:hidden; }}
  @media only screen and (max-width:640px) {{
    .container {{ margin:0 12px!important; }}
    .body {{ padding:24px 20px!important; }}
  }}
</style>
</head>
<body>
<span class="preheader">{preheader}</span>
<div class="wrapper">
  <div class="container">
    <div class="header">
      <h1>Rezvo</h1>
    </div>
    <div class="body">
      {body_html}
    </div>
    <div class="footer">
      <p>&copy; {datetime.now().year} Rezvo &middot; Your High Street, Booked</p>
      <p><a href="{{{{unsubscribe_url}}}}">Unsubscribe</a> &middot; <a href="https://rezvo.app/privacy">Privacy</a></p>
    </div>
  </div>
</div>
<!-- Tracking pixel -->
<img src="{{{{tracking_pixel_url}}}}" width="1" height="1" style="display:none;" alt="">
</body>
</html>"""


# ─── Core Send Functions ─── #

async def send_email(
    to: str,
    subject: str,
    html: str,
    from_email: str = DEFAULT_FROM,
    reply_to: Optional[str] = None,
    tags: Optional[List[Dict]] = None,
    headers: Optional[Dict] = None,
) -> Dict:
    """
    Send a single email via Resend.
    Returns: {"id": "msg_xxx", "success": True} or {"error": "...", "success": False}
    """
    if not settings.resend_api_key:
        logger.warning("No Resend API key configured — email not sent")
        return {"success": False, "error": "Email service not configured"}

    try:
        params = {
            "from_": from_email,
            "to": [to],
            "subject": subject,
            "html": html,
        }
        if reply_to:
            params["reply_to"] = [reply_to]
        if tags:
            params["tags"] = tags
        if headers:
            params["headers"] = headers

        result = resend.Emails.send(params)

        logger.info(f"Email sent to {to}: {result.get('id', 'unknown')}")
        return {"success": True, "id": result.get("id"), "to": to}

    except Exception as e:
        logger.error(f"Email send failed to {to}: {str(e)}")
        return {"success": False, "error": str(e), "to": to}


async def send_batch(
    recipients: List[Dict],
    subject: str,
    html_template: str,
    from_email: str = CAMPAIGNS_FROM,
    tags: Optional[List[Dict]] = None,
) -> Dict:
    """
    Send batch emails with per-recipient variable substitution.
    Each recipient: {"email": "...", "name": "...", ...extra_vars}

    Resend supports batch API (up to 100 per call).
    For larger lists, we chunk and send sequentially.
    """
    if not settings.resend_api_key:
        return {"success": False, "error": "Email service not configured", "sent": 0, "failed": 0}

    results = {"sent": 0, "failed": 0, "errors": []}
    CHUNK_SIZE = 100

    for i in range(0, len(recipients), CHUNK_SIZE):
        chunk = recipients[i:i + CHUNK_SIZE]

        batch_params = []
        for recipient in chunk:
            # Render template with recipient's variables
            rendered_html = render_template(html_template, recipient)
            rendered_subject = render_template(subject, recipient)

            batch_params.append({
                "from_": from_email,
                "to": [recipient["email"]],
                "subject": rendered_subject,
                "html": rendered_html,
                "tags": tags or [],
            })

        try:
            # Resend batch endpoint
            batch_result = resend.Batch.send(batch_params)
            results["sent"] += len(chunk)
            logger.info(f"Batch sent: {len(chunk)} emails (chunk {i // CHUNK_SIZE + 1})")
        except Exception as e:
            results["failed"] += len(chunk)
            results["errors"].append(str(e))
            logger.error(f"Batch send failed: {str(e)}")

    results["success"] = results["failed"] == 0
    return results


# ─── Transactional Email Templates ─── #

async def send_booking_confirmation(
    to: str,
    client_name: str,
    business_name: str,
    booking_date: str,
    booking_time: str,
    service_name: str = "",
    party_size: int = 0,
    booking_ref: str = "",
    manage_url: str = "",
):
    """Send booking confirmation to diner/client."""
    if party_size:
        details = f"<p><strong>Party size:</strong> {party_size} guests</p>"
    else:
        details = f"<p><strong>Service:</strong> {service_name}</p>" if service_name else ""

    body = f"""
    <h2>Booking Confirmed! &#127881;</h2>
    <p>Hi {client_name},</p>
    <p>Your booking at <strong>{business_name}</strong> is confirmed.</p>
    <div style="background:#f0fdf4; border-left:4px solid #1B4332; padding:16px; border-radius:0 8px 8px 0; margin:16px 0;">
      <p style="margin:0;"><strong>Date:</strong> {booking_date}</p>
      <p style="margin:4px 0 0;"><strong>Time:</strong> {booking_time}</p>
      {details}
      <p style="margin:4px 0 0;"><strong>Ref:</strong> {booking_ref}</p>
    </div>
    <p><a href="{manage_url}" class="cta">Manage Booking</a></p>
    <p style="font-size:13px; color:#6b7280;">Need to change something? You can modify or cancel up to 24 hours before your booking.</p>
    """

    html = wrap_html(body, preheader=f"Your booking at {business_name} on {booking_date} is confirmed")

    return await send_email(
        to=to,
        subject=f"Booking Confirmed — {business_name}",
        html=html,
        tags=[{"name": "type", "value": "booking_confirmation"}],
    )


async def send_booking_reminder(
    to: str,
    client_name: str,
    business_name: str,
    booking_date: str,
    booking_time: str,
    hours_until: int = 24,
    manage_url: str = "",
):
    """Send booking reminder (24h or 2h before)."""
    body = f"""
    <h2>Reminder: Your booking is {'tomorrow' if hours_until >= 12 else 'coming up soon'}!</h2>
    <p>Hi {client_name},</p>
    <p>Just a friendly reminder about your booking at <strong>{business_name}</strong>.</p>
    <div style="background:#f0fdf4; border-left:4px solid #1B4332; padding:16px; border-radius:0 8px 8px 0; margin:16px 0;">
      <p style="margin:0;"><strong>Date:</strong> {booking_date}</p>
      <p style="margin:4px 0 0;"><strong>Time:</strong> {booking_time}</p>
    </div>
    <p><a href="{manage_url}" class="cta">View Booking</a></p>
    <p style="font-size:13px; color:#6b7280;">Can't make it? Please cancel at least 24 hours in advance.</p>
    """

    html = wrap_html(body, preheader=f"Reminder: {business_name} — {booking_date} at {booking_time}")

    return await send_email(
        to=to,
        subject=f"Reminder: {business_name} — {booking_date}",
        html=html,
        tags=[{"name": "type", "value": "booking_reminder"}],
    )


async def send_review_request(
    to: str,
    client_name: str,
    business_name: str,
    review_url: str,
):
    """Post-visit review request with smart routing."""
    body = f"""
    <h2>How was your visit?</h2>
    <p>Hi {client_name},</p>
    <p>Thanks for visiting <strong>{business_name}</strong>! We'd love to hear about your experience.</p>
    <p>It only takes 30 seconds:</p>
    <p style="text-align:center;"><a href="{review_url}" class="cta">Leave a Review</a></p>
    <p style="font-size:13px; color:#6b7280;">Your feedback helps {business_name} improve and helps other customers make great choices.</p>
    """

    html = wrap_html(body, preheader=f"How was your visit to {business_name}?")

    return await send_email(
        to=to,
        subject=f"How was {business_name}?",
        html=html,
        tags=[{"name": "type", "value": "review_request"}],
    )


async def send_password_reset(to: str, name: str, reset_url: str):
    """Password reset email."""
    body = f"""
    <h2>Reset your password</h2>
    <p>Hi {name},</p>
    <p>We received a request to reset your Rezvo password. Click the button below to choose a new one:</p>
    <p style="text-align:center;"><a href="{reset_url}" class="cta">Reset Password</a></p>
    <p style="font-size:13px; color:#6b7280;">This link expires in 1 hour. If you didn't request this, you can safely ignore this email.</p>
    """

    html = wrap_html(body, preheader="Reset your Rezvo password")

    return await send_email(
        to=to,
        subject="Reset your Rezvo password",
        html=html,
        from_email=NOREPLY_FROM,
        tags=[{"name": "type", "value": "password_reset"}],
    )


# ─── Platform-Level Emails (Growth Engine) ─── #

async def send_warm_lead_email(
    to: str,
    restaurant_name: str,
    notify_count: int,
    owner_name: str = "there",
    signup_url: str = "https://rezvo.app/for-business",
):
    """Warm lead email sent when enough diners request a restaurant."""
    body = f"""
    <h2>{notify_count} people want to book at {restaurant_name}</h2>
    <p>Hi {owner_name},</p>
    <p><strong>{notify_count} local diners</strong> have tried to book a table at {restaurant_name} through Rezvo, but you're not listed yet.</p>
    <p>These are real customers, ready to book — and you're missing out on every single one.</p>
    <div style="background:#fef3c7; border-left:4px solid #f59e0b; padding:16px; border-radius:0 8px 8px 0; margin:16px 0;">
      <p style="margin:0; font-weight:600;">Unlike Deliveroo or UberEats, Rezvo charges zero commission.</p>
      <p style="margin:8px 0 0; font-size:13px;">No hidden fees. No percentage of orders. Customers book direct with you.</p>
    </div>
    <p>It takes 5 minutes to get listed:</p>
    <p style="text-align:center;"><a href="{signup_url}" class="cta">Claim Your Listing — Free</a></p>
    <p style="font-size:13px; color:#6b7280;">Rezvo is a Nottingham-based platform helping independent restaurants take back control from high-commission delivery apps. Questions? Reply to this email.</p>
    """

    html = wrap_html(body, preheader=f"{notify_count} diners want to book at {restaurant_name}")

    return await send_email(
        to=to,
        subject=f"{notify_count} customers are trying to book {restaurant_name}",
        html=html,
        from_email=CAMPAIGNS_FROM,
        reply_to="hello@rezvo.app",
        tags=[
            {"name": "type", "value": "warm_lead"},
            {"name": "restaurant", "value": restaurant_name},
        ],
    )


async def send_diner_notification(
    to: str,
    diner_name: str,
    restaurant_name: str,
    booking_url: str,
):
    """Notify diners when a restaurant they wanted joins Rezvo."""
    body = f"""
    <h2>Great news! {restaurant_name} is now on Rezvo &#127881;</h2>
    <p>Hi {diner_name},</p>
    <p>Remember when you tried to book at <strong>{restaurant_name}</strong>? They've just joined Rezvo, and you can now book a table directly!</p>
    <p style="text-align:center;"><a href="{booking_url}" class="cta">Book a Table</a></p>
    <p style="font-size:13px; color:#6b7280;">You're receiving this because you asked to be notified when {restaurant_name} joined Rezvo.</p>
    """

    html = wrap_html(body, preheader=f"{restaurant_name} just joined Rezvo — book now!")

    return await send_email(
        to=to,
        subject=f"{restaurant_name} is now on Rezvo — book your table!",
        html=html,
        tags=[
            {"name": "type", "value": "diner_notification"},
            {"name": "restaurant", "value": restaurant_name},
        ],
    )


async def send_insights_report(
    to: str,
    owner_name: str,
    business_name: str,
    report_url: str,
    score: int,
    expires_in_days: int = 15,
):
    """Send the business insights audit report link."""
    if score < 35:
        urgency = "needs urgent attention"
        color = "#dc2626"
    elif score < 50:
        urgency = "has room for improvement"
        color = "#f59e0b"
    elif score < 70:
        urgency = "is doing okay but could do better"
        color = "#2563eb"
    else:
        urgency = "is performing well"
        color = "#16a34a"

    body = f"""
    <h2>Your Free Business Health Report</h2>
    <p>Hi {owner_name},</p>
    <p>We've completed a digital health check for <strong>{business_name}</strong>.</p>
    <div style="text-align:center; margin:24px 0;">
      <div style="display:inline-block; width:80px; height:80px; border-radius:50%; background:{color}; line-height:80px; font-size:28px; font-weight:700; color:#fff;">{score}</div>
      <p style="margin:8px 0 0; font-weight:600; color:{color};">Your online presence {urgency}</p>
    </div>
    <p>Your personalised report covers:</p>
    <p>&bull; Website speed &amp; mobile experience<br>
    &bull; Google visibility &amp; SEO health<br>
    &bull; Review reputation across platforms<br>
    &bull; Commission savings potential<br>
    &bull; Actionable recommendations</p>
    <p style="text-align:center;"><a href="{report_url}" class="cta">View Your Report</a></p>
    <p style="font-size:13px; color:#dc2626; font-weight:500;">This link expires in {expires_in_days} days.</p>
    <p style="font-size:13px; color:#6b7280;">Questions? Reply to this email — we're happy to walk you through the findings.</p>
    """

    html = wrap_html(body, preheader=f"{business_name} scored {score}/100 — see your full report")

    return await send_email(
        to=to,
        subject=f"{business_name} — Your Free Digital Health Score: {score}/100",
        html=html,
        from_email=INSIGHTS_FROM,
        reply_to="hello@rezvo.app",
        tags=[
            {"name": "type", "value": "insights_report"},
            {"name": "score", "value": str(score)},
        ],
    )


async def send_insights_reminder(
    to: str,
    owner_name: str,
    business_name: str,
    report_url: str,
    days_left: int,
):
    """Drip email: report expiring soon."""
    if days_left <= 3:
        urgency_text = f"Your report expires in <strong>{days_left} days</strong>"
        subject = f"Expiring soon: {business_name} health report ({days_left} days left)"
    elif days_left <= 5:
        urgency_text = f"Your report expires in <strong>{days_left} days</strong>"
        subject = f"Don't miss your {business_name} report — {days_left} days left"
    else:
        urgency_text = f"Your report expires in <strong>{days_left} days</strong>"
        subject = f"Reminder: Your {business_name} digital health report"

    body = f"""
    <h2>Your report is still waiting</h2>
    <p>Hi {owner_name},</p>
    <p>We sent you a free digital health report for <strong>{business_name}</strong> — have you had a chance to look?</p>
    <div style="background:#fef2f2; border-left:4px solid #dc2626; padding:16px; border-radius:0 8px 8px 0; margin:16px 0;">
      <p style="margin:0; font-weight:600; color:#dc2626;">{urgency_text}</p>
      <p style="margin:4px 0 0; font-size:13px;">Once it expires, the data can't be recovered.</p>
    </div>
    <p style="text-align:center;"><a href="{report_url}" class="cta">View Report Now</a></p>
    """

    html = wrap_html(body, preheader=f"{days_left} days left to view your {business_name} report")

    return await send_email(
        to=to,
        subject=subject,
        html=html,
        from_email=INSIGHTS_FROM,
        reply_to="hello@rezvo.app",
        tags=[
            {"name": "type", "value": "insights_reminder"},
            {"name": "days_left", "value": str(days_left)},
        ],
    )


# ─── Email Event Logging ─── #

async def log_email_event(
    email_id: str,
    event_type: str,
    recipient: str,
    metadata: Optional[Dict] = None,
):
    """Log email delivery events to MongoDB for analytics."""
    db = get_database()
    if not db:
        return

    event = {
        "email_id": email_id,
        "event_type": event_type,  # sent, delivered, opened, clicked, bounced, complained
        "recipient": recipient,
        "metadata": metadata or {},
        "created_at": datetime.utcnow(),
    }

    await db.email_events.insert_one(event)


async def get_email_stats(
    business_id: Optional[str] = None,
    campaign_id: Optional[str] = None,
    days: int = 30,
) -> Dict:
    """Get email delivery stats."""
    db = get_database()
    if not db:
        return {}

    since = datetime.utcnow() - __import__("datetime").timedelta(days=days)

    match_filter = {"created_at": {"$gte": since}}
    if campaign_id:
        match_filter["metadata.campaign_id"] = campaign_id

    pipeline = [
        {"$match": match_filter},
        {"$group": {
            "_id": "$event_type",
            "count": {"$sum": 1},
        }},
    ]

    stats = {}
    async for doc in db.email_events.aggregate(pipeline):
        stats[doc["_id"]] = doc["count"]

    total = stats.get("sent", 0)
    return {
        "total_sent": total,
        "delivered": stats.get("delivered", 0),
        "opened": stats.get("opened", 0),
        "clicked": stats.get("clicked", 0),
        "bounced": stats.get("bounced", 0),
        "complained": stats.get("complained", 0),
        "open_rate": round(stats.get("opened", 0) / max(total, 1) * 100, 1),
        "click_rate": round(stats.get("clicked", 0) / max(total, 1) * 100, 1),
        "bounce_rate": round(stats.get("bounced", 0) / max(total, 1) * 100, 1),
    }


# ─── Resend Webhook Verification ─── #

def verify_resend_webhook(payload: bytes, signature: str, secret: str) -> bool:
    """Verify Resend webhook signature."""
    expected = hmac.new(
        secret.encode(),
        payload,
        hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(expected, signature)
