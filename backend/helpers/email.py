"""
ReeveOS Email Service
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
DEFAULT_FROM = "ReeveOS <bookings@mail.reeveos.app>"
CAMPAIGNS_FROM = "ReeveOS <campaigns@mail.reeveos.app>"
INSIGHTS_FROM = "ReeveOS Website Review <reviews@mail.reeveos.app>"
NOREPLY_FROM = "ReeveOS <noreply@mail.reeveos.app>"

# For multi-domain strategy (future)
DOMAIN_MAP = {
    "transactional": "mail.reeveos.app",        # booking confirmations, password resets
    "campaigns": "mail.reeveos.app",            # owner marketing campaigns
    "insights": "mail.reeveos.app",             # audit reports, drip campaigns
    "growth": "mail.reeveos.app",               # warm lead outreach, diner notifications
}


# ─── Template Engine ─── #

def render_template(template: str, variables: Dict[str, Any]) -> str:
    """Simple variable substitution: {variable_name} → value."""
    rendered = template
    for key, value in variables.items():
        rendered = rendered.replace(f"{{{key}}}", str(value) if value else "")
    return rendered


def wrap_html(body_html: str, preheader: str = "") -> str:
    """Wrap content in a responsive email template with ReeveOS branding."""
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>ReeveOS</title>
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
      <h1>ReeveOS</h1>
    </div>
    <div class="body">
      {body_html}
    </div>
    <div class="footer">
      <p>&copy; {datetime.now().year} ReeveOS &middot; Your High Street, Booked</p>
      <p><a href="{{{{unsubscribe_url}}}}">Unsubscribe</a> &middot; <a href="https://reeveos.app/privacy">Privacy</a></p>
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
    <p>We received a request to reset your ReeveOS password. Click the button below to choose a new one:</p>
    <p style="text-align:center;"><a href="{reset_url}" class="cta">Reset Password</a></p>
    <p style="font-size:13px; color:#6b7280;">This link expires in 1 hour. If you didn't request this, you can safely ignore this email.</p>
    """

    html = wrap_html(body, preheader="Reset your ReeveOS password")

    return await send_email(
        to=to,
        subject="Reset your ReeveOS password",
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
    signup_url: str = "https://reeveos.app/for-business",
):
    """Warm lead email sent when enough diners request a restaurant."""
    body = f"""
    <h2>{notify_count} people want to book at {restaurant_name}</h2>
    <p>Hi {owner_name},</p>
    <p><strong>{notify_count} local diners</strong> have tried to book a table at {restaurant_name} through ReeveOS, but you're not listed yet.</p>
    <p>These are real customers, ready to book — and you're missing out on every single one.</p>
    <div style="background:#fef3c7; border-left:4px solid #f59e0b; padding:16px; border-radius:0 8px 8px 0; margin:16px 0;">
      <p style="margin:0; font-weight:600;">Unlike Deliveroo or UberEats, ReeveOS charges zero commission.</p>
      <p style="margin:8px 0 0; font-size:13px;">No hidden fees. No percentage of orders. Customers book direct with you.</p>
    </div>
    <p>It takes 5 minutes to get listed:</p>
    <p style="text-align:center;"><a href="{signup_url}" class="cta">Claim Your Listing — Free</a></p>
    <p style="font-size:13px; color:#6b7280;">ReeveOS is a Nottingham-based platform helping independent restaurants take back control from high-commission delivery apps. Questions? Reply to this email.</p>
    """

    html = wrap_html(body, preheader=f"{notify_count} diners want to book at {restaurant_name}")

    return await send_email(
        to=to,
        subject=f"{notify_count} customers are trying to book {restaurant_name}",
        html=html,
        from_email=CAMPAIGNS_FROM,
        reply_to="hello@reeveos.app",
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
    """Notify diners when a restaurant they wanted joins ReeveOS."""
    body = f"""
    <h2>Great news! {restaurant_name} is now on ReeveOS &#127881;</h2>
    <p>Hi {diner_name},</p>
    <p>Remember when you tried to book at <strong>{restaurant_name}</strong>? They've just joined ReeveOS, and you can now book a table directly!</p>
    <p style="text-align:center;"><a href="{booking_url}" class="cta">Book a Table</a></p>
    <p style="font-size:13px; color:#6b7280;">You're receiving this because you asked to be notified when {restaurant_name} joined ReeveOS.</p>
    """

    html = wrap_html(body, preheader=f"{restaurant_name} just joined ReeveOS — book now!")

    return await send_email(
        to=to,
        subject=f"{restaurant_name} is now on ReeveOS — book your table!",
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
        reply_to="hello@reeveos.app",
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
        reply_to="hello@reeveos.app",
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


# ─── Missing Templates: Orders, Cancellations, Welcome ─── #

async def send_order_confirmation(
    to: str,
    customer_name: str,
    business_name: str,
    order_number: str,
    order_type: str,
    items: list,
    total: float,
    estimated_minutes: int = 30,
    delivery_address: str = "",
    track_url: str = "",
):
    """Confirmation email for online orders (collection/delivery)."""
    items_html = "".join(
        f"<tr><td style='padding:6px 0; border-bottom:1px solid #f0f0f0;'>{i.get('name','Item')}</td>"
        f"<td style='padding:6px 0; border-bottom:1px solid #f0f0f0; text-align:right;'>x{i.get('quantity',1)}</td>"
        f"<td style='padding:6px 0; border-bottom:1px solid #f0f0f0; text-align:right;'>£{(i.get('unit_price',0) * i.get('quantity',1)):.2f}</td></tr>"
        for i in items
    )

    type_label = "Delivery" if order_type == "delivery" else "Collection"
    address_html = f"<p><strong>Delivery to:</strong> {delivery_address}</p>" if delivery_address else ""

    body = f"""
    <h2>Order Confirmed! 🎉</h2>
    <p>Hi {customer_name},</p>
    <p>Your {type_label.lower()} order from <strong>{business_name}</strong> has been confirmed.</p>
    <div style="background:#f0fdf4; border-left:4px solid #1B4332; padding:16px; border-radius:0 8px 8px 0; margin:16px 0;">
      <p style="margin:0;"><strong>Order #{order_number}</strong></p>
      <p style="margin:4px 0 0;"><strong>Estimated {type_label.lower()}:</strong> {estimated_minutes} minutes</p>
      {address_html}
    </div>
    <table style="width:100%; border-collapse:collapse; margin:16px 0; font-size:14px;">
      <thead><tr style="border-bottom:2px solid #e5e7eb;">
        <th style="text-align:left; padding:8px 0;">Item</th>
        <th style="text-align:right; padding:8px 0;">Qty</th>
        <th style="text-align:right; padding:8px 0;">Price</th>
      </tr></thead>
      <tbody>{items_html}</tbody>
      <tfoot><tr>
        <td colspan="2" style="padding:12px 0; font-weight:700; font-size:16px;">Total</td>
        <td style="padding:12px 0; text-align:right; font-weight:700; font-size:16px;">£{total:.2f}</td>
      </tr></tfoot>
    </table>
    {"<p><a href='" + track_url + "' class='cta'>Track Your Order</a></p>" if track_url else ""}
    """

    html = wrap_html(body, preheader=f"Order #{order_number} confirmed — {type_label} in ~{estimated_minutes} mins")

    return await send_email(
        to=to,
        subject=f"Order Confirmed — {business_name} #{order_number}",
        html=html,
        tags=[{"name": "type", "value": "order_confirmation"}],
    )


async def send_order_status_update(
    to: str,
    customer_name: str,
    business_name: str,
    order_number: str,
    new_status: str,
    track_url: str = "",
):
    """Notify customer of order status change."""
    status_messages = {
        "preparing": ("Your order is being prepared! 👨‍🍳", "The kitchen is working on your order now."),
        "ready": ("Your order is ready! ✅", "Head over to collect your order — it's waiting for you."),
        "delivered": ("Order delivered! 🎉", "Your order has been delivered. Enjoy your meal!"),
        "cancelled": ("Order cancelled", "Your order has been cancelled. If you didn't request this, please contact the restaurant."),
    }

    title, message = status_messages.get(new_status, (f"Order update: {new_status}", f"Your order status is now: {new_status}"))

    body = f"""
    <h2>{title}</h2>
    <p>Hi {customer_name},</p>
    <p>{message}</p>
    <div style="background:#f0fdf4; border-left:4px solid #1B4332; padding:16px; border-radius:0 8px 8px 0; margin:16px 0;">
      <p style="margin:0;"><strong>Order #{order_number}</strong> at {business_name}</p>
    </div>
    {"<p><a href='" + track_url + "' class='cta'>Track Order</a></p>" if track_url else ""}
    """

    html = wrap_html(body, preheader=f"Order #{order_number}: {title}")

    return await send_email(
        to=to,
        subject=f"{title} — {business_name}",
        html=html,
        tags=[{"name": "type", "value": "order_status"}],
    )


async def send_cancellation_confirmation(
    to: str,
    client_name: str,
    business_name: str,
    booking_date: str,
    booking_time: str,
    booking_ref: str = "",
    cancelled_by: str = "customer",
    reason: str = "",
):
    """Booking cancellation confirmation."""
    if cancelled_by == "customer":
        intro = "Your booking has been cancelled as requested."
    else:
        intro = f"Unfortunately, {business_name} has had to cancel your booking."
        if reason:
            intro += f" Reason: {reason}"

    body = f"""
    <h2>Booking Cancelled</h2>
    <p>Hi {client_name},</p>
    <p>{intro}</p>
    <div style="background:#fef2f2; border-left:4px solid #dc2626; padding:16px; border-radius:0 8px 8px 0; margin:16px 0;">
      <p style="margin:0;"><strong>Date:</strong> {booking_date}</p>
      <p style="margin:4px 0 0;"><strong>Time:</strong> {booking_time}</p>
      <p style="margin:4px 0 0;"><strong>Ref:</strong> {booking_ref}</p>
    </div>
    <p>Would you like to rebook?</p>
    <p><a href="https://reeveos.co.uk" class="cta">Find a Table</a></p>
    """

    html = wrap_html(body, preheader=f"Booking at {business_name} on {booking_date} has been cancelled")

    return await send_email(
        to=to,
        subject=f"Booking Cancelled — {business_name}",
        html=html,
        tags=[{"name": "type", "value": "booking_cancellation"}],
    )


async def send_welcome_business(
    to: str,
    owner_name: str,
    business_name: str,
    dashboard_url: str = "https://portal.rezvo.app",
):
    """Welcome email for newly registered businesses."""
    body = f"""
    <h2>Welcome to ReeveOS! 🎉</h2>
    <p>Hi {owner_name},</p>
    <p>You've just taken the first step towards <strong>zero-commission bookings</strong> for {business_name}. Nice one.</p>
    <p>Here's what to do next:</p>
    <div style="margin:16px 0;">
      <p>✅ <strong>Set up your booking page</strong> — customise your availability, table layout, and services</p>
      <p>✅ <strong>Add your menu</strong> — ready for online ordering and QR table ordering</p>
      <p>✅ <strong>Invite your team</strong> — give staff access to manage bookings and EPOS</p>
      <p>✅ <strong>Share your booking link</strong> — add it to your website, Instagram bio, and Google listing</p>
    </div>
    <p style="text-align:center;"><a href="{dashboard_url}" class="cta">Open Your Dashboard</a></p>
    <p style="font-size:13px; color:#6b7280;">Need help getting set up? Reply to this email — we're here to help, and it's free.</p>
    """

    html = wrap_html(body, preheader=f"Welcome to ReeveOS — let's get {business_name} set up")

    return await send_email(
        to=to,
        subject=f"Welcome to ReeveOS — Let's get {business_name} live!",
        html=html,
        reply_to="hello@reeveos.app",
        tags=[{"name": "type", "value": "welcome_business"}],
    )


async def send_deposit_receipt(
    to: str,
    client_name: str,
    business_name: str,
    booking_date: str,
    booking_time: str,
    deposit_amount: float,
    booking_ref: str = "",
    party_size: int = 2,
):
    """Deposit payment receipt."""
    body = f"""
    <h2>Deposit Payment Received</h2>
    <p>Hi {client_name},</p>
    <p>Your deposit of <strong>£{deposit_amount:.2f}</strong> for {business_name} has been processed.</p>
    <div style="background:#f0fdf4; border-left:4px solid #1B4332; padding:16px; border-radius:0 8px 8px 0; margin:16px 0;">
      <p style="margin:0;"><strong>Date:</strong> {booking_date}</p>
      <p style="margin:4px 0 0;"><strong>Time:</strong> {booking_time}</p>
      <p style="margin:4px 0 0;"><strong>Party:</strong> {party_size} guests</p>
      <p style="margin:4px 0 0;"><strong>Deposit:</strong> £{deposit_amount:.2f}</p>
      <p style="margin:4px 0 0;"><strong>Ref:</strong> {booking_ref}</p>
    </div>
    <p style="font-size:13px; color:#6b7280;">This deposit will be deducted from your final bill. Cancellation policy applies — check with {business_name} for details.</p>
    """

    html = wrap_html(body, preheader=f"£{deposit_amount:.2f} deposit received for {business_name}")

    return await send_email(
        to=to,
        subject=f"Deposit Received — {business_name} ({booking_ref})",
        html=html,
        tags=[{"name": "type", "value": "deposit_receipt"}],
    )
