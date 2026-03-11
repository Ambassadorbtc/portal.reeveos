"""
ReeveOS Email Templates
========================
33 unique email templates. Each function returns body HTML
that gets wrapped by email_base.render_email().

Usage:
    from helpers.email_templates import booking_confirmed
    from helpers.email_base import render_email
    
    body = booking_confirmed(data)
    html = render_email(body, business=biz_dict)
"""

from helpers.email_base import (
    heading, paragraph, detail_card, alert, button, divider,
    staff_card, icon_row, reassurance_box, line_item, total_row,
    detail_row, stat_box, GOLD, BLACK, MUTED, TEXT, BG, BORDER,
    LIGHT_GOLD, WHITE, WARN_BG, WARN_TX, RED_BG, RED_TX, GREEN_BG, GREEN_TX,
    RED_BD, WARN_BD, GREEN_BD
)


# ═══════════════════════════════════════
# TRANSACTIONAL — BOOKINGS (SALON)
# ═══════════════════════════════════════

def booking_confirmed(d: dict) -> str:
    """d: client_name, service, date, time, duration, staff, location, booking_fee, form_url, booking_url"""
    form_alert = ""
    if d.get("needs_form"):
        form_alert = alert("Consultation form required — please complete your health form before arriving. Without it, your therapist cannot proceed.") + button("Complete My Consultation Form", d.get("form_url", "#"))
    
    return (
        heading(f"You're booked in, {d['client_name']}")
        + paragraph(f"Your appointment at <strong>{d.get('business_name', '')}</strong> has been confirmed.")
        + detail_card([
            {"label": "Service", "value": d["service"]},
            {"label": "Date & Time", "value": f"{d['date']} at {d['time']}"},
            {"label": "Duration", "value": d.get("duration", "")},
            {"label": "With", "value": d.get("staff", "")},
            {"label": "Booking Fee", "value": f"£{d.get('booking_fee', '0')} paid"},
        ])
        + form_alert
        + paragraph("Need to reschedule or cancel? Please give us at least 48 hours' notice.", muted=True)
        + button("Reschedule", d.get("reschedule_url", "#"), secondary=True)
        + button("Cancel", d.get("cancel_url", "#"), secondary=True)
        + divider(gold=True)
        + staff_card(d.get("staff", ""), d.get("staff_role", "Therapist"))
        + paragraph("Add to calendar: Google | Apple | Outlook", muted=True, small=True)
    )


def reservation_confirmed(d: dict) -> str:
    """d: client_name, date, time, party_size, location, ref, booking_url"""
    return (
        heading(f"Table confirmed, {d['client_name']}")
        + paragraph(f"Your reservation at <strong>{d.get('business_name', '')}</strong> is all set.")
        + detail_card([
            {"label": "Date & Time", "value": f"{d['date']} at {d['time']}"},
            {"label": "Party Size", "value": f"{d['party_size']} guests"},
            {"label": "Location", "value": d.get("location", "")},
            {"label": "Booking Ref", "value": d.get("ref", "")},
        ])
        + alert("Please arrive within 15 minutes of your reservation time to guarantee your table.")
        + button("View Reservation Details", d.get("booking_url", "#"))
        + paragraph("Need to change your plans? Contact us at least 24 hours in advance.", muted=True)
        + divider()
        + paragraph("We look forward to welcoming you.", muted=True, small=True)
    )


def reminder_24h(d: dict) -> str:
    """d: client_name, service, time, staff, confirm_url, reschedule_url, cancel_url"""
    return (
        heading(f"See you tomorrow, {d['client_name']}")
        + detail_card([
            {"label": "Service", "value": d["service"]},
            {"label": "Date & Time", "value": f"Tomorrow at {d['time']}"},
            {"label": "With", "value": d.get("staff", "")},
        ])
        + paragraph("Please arrive 5 minutes early. If you need to reschedule, please let us know as soon as possible.")
        + button("Confirm My Appointment", d.get("confirm_url", "#"))
        + button("Reschedule", d.get("reschedule_url", "#"), secondary=True)
        + button("Cancel", d.get("cancel_url", "#"), secondary=True)
    )


def cancelled_by_client(d: dict) -> str:
    """d: client_name, service, date, time, booking_fee, within_window, rebook_url"""
    fee_alert = ""
    if d.get("within_window"):
        fee_alert = alert(f"Your booking fee of £{d.get('booking_fee', '0')} has been retained as you cancelled within the 48-hour window.", "error")
    return (
        heading("Appointment cancelled")
        + paragraph(f"Your <strong>{d['service']}</strong> on {d['date']} at {d['time']} has been cancelled.")
        + fee_alert
        + paragraph("We understand things come up. If there were special circumstances, please get in touch.")
        + button("Rebook Now", d.get("rebook_url", "#"))
    )


def cancelled_by_business(d: dict) -> str:
    """d: client_name, service, date, time, reason, rebook_url"""
    return (
        heading(f"Sorry, {d['client_name']}")
        + paragraph(f"We've had to cancel your <strong>{d['service']}</strong> on {d['date']} at {d['time']}.")
        + paragraph(d.get("reason", "We'll be in touch to rebook at a time that works for you."))
        + paragraph("Any booking fee you paid will be fully refunded within 5-10 working days.")
        + button("Rebook Now", d.get("rebook_url", "#"))
    )


def no_show(d: dict) -> str:
    """d: client_name, service, booking_fee, rebook_url"""
    return (
        heading(f"We missed you, {d['client_name']}")
        + paragraph(f"We noticed you didn't make it to your <strong>{d['service']}</strong> today.")
        + paragraph(f"As per our booking policy, your booking fee of £{d.get('booking_fee', '0')} has been retained. We understand things come up — if there were special circumstances, please get in touch.", muted=True)
        + button("Rebook My Appointment", d.get("rebook_url", "#"))
    )


def rescheduled(d: dict) -> str:
    """d: client_name, service, new_date, new_time, staff, booking_url"""
    return (
        heading(f"Appointment updated, {d['client_name']}")
        + paragraph(f"Your <strong>{d['service']}</strong> has been moved to a new date and time.")
        + detail_card([
            {"label": "Service", "value": d["service"]},
            {"label": "New Date & Time", "value": f"{d['new_date']} at {d['new_time']}"},
            {"label": "With", "value": d.get("staff", "")},
        ])
        + button("View Booking Details", d.get("booking_url", "#"))
    )


# ═══════════════════════════════════════
# CONSULTATION FORMS
# ═══════════════════════════════════════

def form_request(d: dict) -> str:
    """d: client_name, service, date, time, form_url"""
    return (
        heading("One quick step before your appointment")
        + paragraph(f"Hi {d['client_name']}, before your <strong>{d['service']}</strong> on {d['date']}, we need you to complete a short health consultation form.")
        + paragraph("This helps us make sure your treatment is safe and tailored to you. It takes about 3 minutes on your phone.")
        + detail_card([
            {"label": "Your appointment", "value": d["service"]},
            {"label": "Date", "value": f"{d['date']}, {d['time']}"},
        ])
        + alert("Form status: Not yet completed")
        + button("Complete My Form — 3 Minutes", d.get("form_url", "#"))
        + divider()
        + icon_row("&#9877;", "Medical history", "So we know what's safe for your skin")
        + icon_row("&#128138;", "Current medications", "Some medications affect treatment")
        + icon_row("&#9997;", "Consent & signature", "Digital signature, done on your phone")
        + divider()
        + paragraph("Your information is stored securely under UK GDPR and only used for treatment planning. Your form is valid for 6 months.", muted=True, small=True)
    )


def form_reminder(d: dict) -> str:
    """d: client_name, service, date, form_url"""
    return (
        heading("Friendly reminder about your health form")
        + paragraph(f"Hi {d['client_name']}, your <strong>{d['service']}</strong> is tomorrow and we still need your consultation form.")
        + alert("Without a completed form, your therapist cannot proceed with treatment.", "error")
        + button("Complete My Form Now", d.get("form_url", "#"))
        + paragraph("It takes 3 minutes on your phone.", muted=True, small=True)
    )


def form_flagged(d: dict) -> str:
    """d: client_name, service, date, time, flag_reason, review_url, contact_url (sent to therapist)"""
    return (
        heading("Client form needs review")
        + detail_card([
            {"label": "Client", "value": d["client_name"]},
            {"label": "Appointment", "value": f"{d['service']} — {d['date']}, {d['time']}"},
        ])
        + alert(f"FLAGGED: {d['flag_reason']}", "error")
        + paragraph("Please review the full consultation form and decide whether to proceed, modify treatment, or contact the client.")
        + button("Review Form", d.get("review_url", "#"))
        + button("Contact Client", d.get("contact_url", "#"), secondary=True)
    )


def form_blocked(d: dict) -> str:
    """d: client_name, service, contact_url (sent to client)"""
    return (
        heading("We need to talk before your appointment")
        + paragraph(f"Hi {d['client_name']}, based on your consultation form answers, your <strong>{d['service']}</strong> treatment cannot proceed as booked.")
        + alert("This is for your safety — certain medical conditions require additional assessment before this treatment type.", "error")
        + paragraph("Your therapist will contact you to discuss alternative options or to arrange a pre-treatment consultation.")
        + paragraph("Any booking fee will be fully refunded or transferred to an alternative treatment.", muted=True)
        + button("Contact Us", d.get("contact_url", "#"))
    )


def form_expiring(d: dict) -> str:
    """d: client_name, expiry_date, form_url"""
    return (
        heading("Your health form is expiring soon")
        + paragraph(f"Hi {d['client_name']}, your consultation form expires on <strong>{d['expiry_date']}</strong>. Please review and re-sign before your next appointment.")
        + button("Review My Form", d.get("form_url", "#"))
        + paragraph("This keeps your records up to date and ensures your treatments remain safe.", muted=True, small=True)
    )


# ═══════════════════════════════════════
# AFTERCARE + REVIEWS
# ═══════════════════════════════════════

def aftercare(d: dict) -> str:
    """d: client_name, service, instructions (list of {"do": bool, "text": str}), next_session, rebook_url"""
    instructions_html = ""
    for item in d.get("instructions", []):
        icon = "&#10003;" if item.get("do") else "&#10007;"
        instructions_html += icon_row(icon, item["title"], item["desc"])
    
    return (
        heading(f"Thank you for visiting, {d['client_name']}")
        + paragraph(f"Here are your aftercare instructions for today's <strong>{d['service']}</strong>:")
        + alert("Important: Follow these instructions carefully for best results and to avoid complications.")
        + f'<div style="margin:16px 0;padding:16px 20px;background-color:{BG};border-radius:4px;">{instructions_html}</div>'
        + paragraph("If you experience anything unexpected, please contact us immediately.", muted=True)
        + paragraph(f"Your next session is recommended in <strong>{d.get('next_session', '4-6 weeks')}</strong>.")
        + button("Book My Next Session", d.get("rebook_url", "#"))
    )


def review_request(d: dict) -> str:
    """d: client_name, service, staff, review_url"""
    return (
        heading("How did we do?")
        + paragraph(f"We hope you enjoyed your <strong>{d['service']}</strong> with {d.get('staff', 'us')} today.")
        + paragraph("Your feedback helps us improve and helps other clients find us.")
        + f'<div style="text-align:center;margin:24px 0;"><span style="font-size:32px;letter-spacing:8px;color:{GOLD};">&#9733;&#9733;&#9733;&#9733;&#9733;</span><p style="margin:8px 0 0;font-size:12px;color:{MUTED};">Tap to rate your experience</p></div>'
        + button("Leave a Review", d.get("review_url", "#"))
        + paragraph("It takes less than a minute and means the world to us.", muted=True, small=True)
    )


# ═══════════════════════════════════════
# CLIENT LIFECYCLE
# ═══════════════════════════════════════

def welcome_client(d: dict) -> str:
    """d: client_name, service, login_url"""
    return (
        heading(f"Welcome to the family, {d['client_name']}")
        + paragraph(f"We loved having you in today for your <strong>{d['service']}</strong>. Here's what you can do with your account:")
        + icon_row("&#128197;", "Book appointments online 24/7", "No need to call — book any time")
        + icon_row("&#128203;", "View your treatment history", "Track your progress over time")
        + icon_row("&#128196;", "Manage consultation forms", "Update your health info anytime")
        + icon_row("&#11088;", "Earn loyalty rewards", "Points on every visit")
        + button("Log Into My Account", d.get("login_url", "#"))
        + paragraph("Thanks for choosing us — we look forward to seeing you again.", muted=True, small=True)
    )


def lapsed_client(d: dict) -> str:
    """d: client_name, business_name, rebook_url"""
    return (
        heading(f"It's been a while, {d['client_name']}")
        + paragraph(f"We haven't seen you at <strong>{d.get('business_name', '')}</strong> for a couple of months and wanted to check in.")
        + paragraph("Your skin works best with consistent care — would you like to book your next session?")
        + button("Book Now", d.get("rebook_url", "#"))
    )


# ═══════════════════════════════════════
# PACKAGES
# ═══════════════════════════════════════

def package_progress(d: dict) -> str:
    """d: client_name, package, current, total, remaining, expires, rebook_url"""
    return (
        heading(f"Session {d['current']} of {d['total']} complete")
        + paragraph(f"Great progress, {d['client_name']}! You've completed session {d['current']} of your <strong>{d['package']}</strong>.")
        + detail_card([
            {"label": "Package", "value": f"{d['package']} — {d['total']} Sessions"},
            {"label": "Sessions used", "value": f"{d['current']} of {d['total']}"},
            {"label": "Remaining", "value": f"{d['remaining']} sessions"},
            {"label": "Expires", "value": d.get("expires", "")},
        ])
        + paragraph("Your next session is recommended in 4-6 weeks.")
        + button("Book Next Session", d.get("rebook_url", "#"))
    )


# ═══════════════════════════════════════
# PAYMENTS — PLAIN ENGLISH STYLE
# ═══════════════════════════════════════

def payment_receipt(d: dict) -> str:
    """d: client_name, amount, card_last4, date, service, duration, booking_fee, paid_today, ref, staff"""
    items_html = f'''<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
        {line_item(f"{d['service']} ({d.get('duration', '')})", f"£{d['amount']}")}
        {line_item(f"Booking fee (already paid)", f"-£{d.get('booking_fee', '0')}", muted=True)}
        {total_row("Paid today", f"£{d.get('paid_today', d['amount'])}")}
    </table>'''
    
    details_html = f'''<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:16px 0;">
        {detail_row("Reference", d.get("ref", ""))}
        {detail_row("Therapist", d.get("staff", ""))}
    </table>'''
    
    return (
        heading(f"Thanks for your payment, {d['client_name']}")
        + reassurance_box(f"£{d['amount']}", f"paid by <strong>Visa ending {d.get('card_last4', '****')}</strong> on <strong>{d['date']}</strong>.")
        + items_html
        + details_html
        + paragraph("This is your receipt. You don't need to do anything with it — we've saved a copy to your account too.", muted=True, small=True)
    )


def payment_failed(d: dict) -> str:
    """d: client_name, amount, update_url"""
    return (
        heading("Payment didn't go through")
        + paragraph(f"Hi {d['client_name']}, your payment of <strong>£{d['amount']}</strong> didn't go through.")
        + alert("Please update your card details to keep your booking.", "error")
        + button("Update My Card", d.get("update_url", "#"))
    )


def refund_issued(d: dict) -> str:
    """d: client_name, amount, card_last4"""
    return (
        heading("Refund on its way")
        + paragraph(f"Hi {d['client_name']}, a refund of <strong>£{d['amount']}</strong> has been issued to your card ending <strong>{d.get('card_last4', '****')}</strong>.")
        + paragraph("Allow 5-10 working days for it to appear in your account.")
    )


# ═══════════════════════════════════════
# ORDERS
# ═══════════════════════════════════════

def order_confirmed(d: dict) -> str:
    """d: client_name, ref, items (list of {"name", "qty", "price"}), total, delivery_address, delivery_est, track_url"""
    items_html = ""
    for item in d.get("items", []):
        items_html += f'''<tr>
            <td style="padding:12px 0;border-bottom:1px solid {BORDER};font-family:Arial,Helvetica,sans-serif;">
                <span style="font-size:14px;font-weight:bold;color:{BLACK};">{item["name"]}</span><br/>
                <span style="font-size:12px;color:{MUTED};">Qty: {item["qty"]}</span>
            </td>
            <td style="padding:12px 0;border-bottom:1px solid {BORDER};font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:bold;color:{BLACK};text-align:right;">{item["price"]}</td>
        </tr>'''
    
    return (
        heading("Order confirmed")
        + paragraph(f"Thanks for your order, {d['client_name']}! Here's your summary:")
        + detail_card([
            {"label": "Order Number", "value": d.get("ref", "")},
            {"label": "Date", "value": d.get("date", "")},
        ])
        + f'<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:20px 0;">{items_html}{total_row("Total", f"£{d["""total"""]}")}</table>'
        + button("Track My Order", d.get("track_url", "#"))
        + paragraph("If you have any questions about your order, reply to this email.", muted=True, small=True)
    )


def order_ready(d: dict) -> str:
    """d: ref, address, directions_url"""
    return (
        heading("Your order is ready!")
        + alert("Your order is prepared and waiting for you.", "success")
        + detail_card([
            {"label": "Order", "value": d.get("ref", "")},
            {"label": "Collect from", "value": d.get("address", "")},
        ])
        + button("Get Directions", d.get("directions_url", "#"))
        + paragraph("Please collect within 30 minutes for the best quality.", muted=True, small=True)
    )


# ═══════════════════════════════════════
# GIFT VOUCHERS
# ═══════════════════════════════════════

def gift_voucher_received(d: dict) -> str:
    """d: amount, sender_name, message, code, valid_until, business_name, redeem_url"""
    return (
        f'<div style="text-align:center;padding:20px 0;">'
        f'<p style="font-size:14px;color:{GOLD};font-weight:bold;letter-spacing:3px;text-transform:uppercase;margin:0 0 8px;">You\'ve received a gift</p>'
        f'<p style="font-size:48px;font-weight:bold;color:{GOLD};margin:0 0 4px;">£{d["amount"]}</p>'
        f'<p style="font-size:14px;color:{MUTED};margin:0;">Gift Voucher</p></div>'
        + f'<div style="margin:20px 0;padding:20px;background-color:{LIGHT_GOLD};border-radius:8px;text-align:center;">'
        f'<p style="font-size:12px;color:{MUTED};margin:0 0 4px;">From</p>'
        f'<p style="font-size:16px;font-weight:bold;color:{BLACK};margin:0 0 8px;">{d["sender_name"]}</p>'
        f'<p style="font-size:14px;color:{MUTED};margin:0;font-style:italic;">&ldquo;{d.get("message", "")}&rdquo;</p></div>'
        + detail_card([
            {"label": "Voucher Code", "value": d["code"]},
            {"label": "Valid until", "value": d.get("valid_until", "")},
            {"label": "Redeemable at", "value": d.get("business_name", "")},
        ])
        + button("Book & Redeem", d.get("redeem_url", "#"))
        + paragraph("To use your voucher, book any treatment online and enter your code at checkout.", muted=True, small=True)
    )


# ═══════════════════════════════════════
# ACCOUNT
# ═══════════════════════════════════════

def password_reset(d: dict) -> str:
    """d: reset_url, ip, timestamp"""
    return (
        heading("Reset your password")
        + paragraph("We received a request to reset your password. Click the button below to set a new one.")
        + button("Reset My Password", d.get("reset_url", "#"))
        + divider()
        + paragraph("This link expires in 1 hour.", muted=True, small=True)
        + paragraph("If you didn't request this, you can safely ignore this email. Your password won't change.", muted=True, small=True)
        + paragraph(f"For security, this request was made from:<br/>IP: {d.get('ip', 'Unknown')}<br/>Time: {d.get('timestamp', '')}", muted=True, small=True)
    )


def email_verification(d: dict) -> str:
    """d: verify_url"""
    return (
        heading("Verify your email")
        + paragraph("Please confirm your email address to complete your account setup.")
        + button("Verify My Email", d.get("verify_url", "#"))
        + divider()
        + paragraph("This link expires in 24 hours. If you didn't create an account, please ignore this email.", muted=True, small=True)
    )


# ═══════════════════════════════════════
# CAMPAIGN
# ═══════════════════════════════════════

def audit_report(d: dict) -> str:
    """d: owner_name, business_name, score, findings (list of {"text", "color": "red"|"amber"}), report_url"""
    score = d.get("score", 0)
    score_color = GREEN_TX if score >= 70 else WARN_TX if score >= 45 else RED_TX
    score_label = "Good" if score >= 70 else "Needs Work" if score >= 45 else "Action Required"
    bar_color = GREEN_BD if score >= 70 else WARN_BD if score >= 45 else RED_BD
    
    findings_html = ""
    for f in d.get("findings", []):
        dot_color = RED_BD if f.get("color") == "red" else WARN_BD
        findings_html += f'<p style="margin:0 0 8px;font-size:13px;color:{TEXT};"><span style="display:inline-block;width:8px;height:8px;border-radius:4px;background-color:{dot_color};margin-right:8px;"></span>{f["text"]}</p>'
    
    return (
        heading("Your Business Audit is Ready")
        + paragraph(f"Hi {d.get('owner_name', '')},")
        + paragraph(f"We put together a free digital health report for <strong>{d.get('business_name', '')}</strong>, covering your Google presence, website performance, social media, and online booking setup.")
        + f'<div style="text-align:center;margin:20px 0;padding:20px;">'
        f'<span style="font-size:48px;font-weight:bold;color:{GOLD};">{score}</span>'
        f'<span style="font-size:18px;color:{MUTED};">/100</span>'
        f'<div style="margin:12px auto 0;width:80%;height:8px;background-color:#EEE;border-radius:4px;overflow:hidden;">'
        f'<div style="width:{score}%;height:100%;background-color:{bar_color};border-radius:4px;"></div></div>'
        f'<p style="margin:8px 0 0;font-size:12px;color:{score_color};font-weight:bold;">{score_label}</p></div>'
        + f'<div style="margin:16px 0;">{findings_html}</div>'
        + button("View My Full Report", d.get("report_url", "#"))
        + paragraph("This report is available for 15 days. After that, the link will expire.", muted=True)
        + paragraph("Every ReeveOS plan includes a free custom website worth £800 — no strings attached.")
        + paragraph("Cheers,<br/>The ReeveOS Team", muted=True, small=True)
    )


# ═══════════════════════════════════════
# BUSINESS — ONBOARDING + OPERATIONS
# ═══════════════════════════════════════

def biz_welcome(d: dict) -> str:
    """d: owner_name, dashboard_url"""
    return (
        heading(f"Welcome aboard, {d['owner_name']}")
        + paragraph("You've just taken the first step to running your business smarter. Here's what to do next:")
        + icon_row("1", "Complete your business profile", "Name, address, opening hours")
        + icon_row("2", "Add your services and pricing", "So clients can see what you offer")
        + icon_row("3", "Invite your team", "Add staff members and their schedules")
        + icon_row("4", "Share your booking link", "Put it on social media and your website")
        + button("Go to My Dashboard", d.get("dashboard_url", "#"))
        + paragraph("Need help? Reply to this email or check our setup guide.", muted=True, small=True)
    )


def daily_brief(d: dict) -> str:
    """d: owner_name, biz_name, bookings_count, first_appointment, expected_revenue, staff_today, alerts (list of str), dashboard_url"""
    alerts_html = ""
    for a in d.get("alerts", []):
        alerts_html += alert(a)
    
    return (
        heading(f"Today at {d.get('biz_name', '')}")
        + paragraph(f"Good morning, {d['owner_name']}. Here's your day:")
        + detail_card([
            {"label": "Appointments today", "value": f"{d.get('bookings_count', 0)} bookings"},
            {"label": "First appointment", "value": d.get("first_appointment", "None")},
            {"label": "Expected revenue", "value": f"£{d.get('expected_revenue', '0')}"},
            {"label": "Staff on today", "value": d.get("staff_today", "")},
        ])
        + alerts_html
        + button("Open Dashboard", d.get("dashboard_url", "#"))
    )


def weekly_summary(d: dict) -> str:
    """d: owner_name, biz_name, period, revenue, revenue_change, bookings, bookings_change, new_clients, new_clients_change, staff_data (list), dashboard_url"""
    staff_html = ""
    for s in d.get("staff_data", []):
        staff_html += f'''<tr>
            <td style="padding:10px 0;border-bottom:1px solid {BORDER};font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;color:{BLACK};">{s["name"]}</td>
            <td style="padding:10px 0;border-bottom:1px solid {BORDER};font-family:Arial,Helvetica,sans-serif;font-size:13px;color:{BLACK};text-align:right;">{s["revenue"]}</td>
            <td style="padding:10px 0;border-bottom:1px solid {BORDER};font-family:Arial,Helvetica,sans-serif;font-size:11px;color:{MUTED};text-align:right;">{s["bookings"]} bookings</td>
        </tr>'''
    
    return (
        heading("Your week in review")
        + paragraph(f"Here's how {d.get('biz_name', '')} performed this week ({d.get('period', '')}):")
        + f'''<table role="presentation" cellspacing="8" cellpadding="0" border="0" width="100%" style="margin:20px 0;"><tr>
            {stat_box("Revenue", d.get("revenue", ""), d.get("revenue_change", ""))}
            {stat_box("Bookings", str(d.get("bookings", 0)), d.get("bookings_change", ""))}
            {stat_box("New Clients", str(d.get("new_clients", 0)), d.get("new_clients_change", ""))}
        </tr></table>'''
        + f'<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:16px 0;">{staff_html}</table>'
        + button("View Full Report", d.get("dashboard_url", "#"))
    )


def monthly_report(d: dict) -> str:
    """d: owner_name, biz_name, month, revenue, revenue_change, bookings, bookings_change, retention, avg_value, new_clients, noshow_rate, top_service, top_staff, noshow_savings, dashboard_url"""
    return (
        heading(f"{d.get('month', '')} Report")
        + paragraph(f"Here's your monthly performance summary for {d.get('biz_name', '')}:")
        + f'''<table role="presentation" cellspacing="8" cellpadding="0" border="0" width="100%" style="margin:20px 0;"><tr>
            {stat_box("Revenue", d.get("revenue", ""), d.get("revenue_change", ""))}
            {stat_box("Bookings", str(d.get("bookings", 0)), d.get("bookings_change", ""))}
        </tr></table>'''
        + detail_card([
            {"label": "Client retention rate", "value": d.get("retention", "")},
            {"label": "Average booking value", "value": f"£{d.get('avg_value', '')}"},
            {"label": "New clients this month", "value": str(d.get("new_clients", 0))},
            {"label": "No-show rate", "value": d.get("noshow_rate", "")},
            {"label": "Top service", "value": d.get("top_service", "")},
            {"label": "Top staff member", "value": d.get("top_staff", "")},
        ])
        + (alert(f"Your no-show rate dropped since enabling booking fees. You saved an estimated £{d.get('noshow_savings', '0')} in lost revenue this month.", "success") if d.get("noshow_savings") else "")
        + button("View Full Analytics", d.get("dashboard_url", "#"))
    )


# ═══════════════════════════════════════
# BILLING — PLAIN ENGLISH
# ═══════════════════════════════════════

def invoice(d: dict) -> str:
    """d: biz_name, period, amount, card_last4, payment_date, items (list of {"label", "amount"}), net, vat, invoice_number, invoice_date, plan, invoice_url"""
    items_html = ""
    for item in d.get("items", []):
        items_html += line_item(item["label"], item["amount"])
    
    details_html = f'''<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:24px 0;padding-top:16px;border-top:1px solid {BORDER};">
        {detail_row("Business", d.get("biz_name", ""))}
        {detail_row("Plan", d.get("plan", ""))}
        {detail_row("Invoice number", d.get("invoice_number", ""))}
        {detail_row("Invoice date", d.get("invoice_date", ""))}
        {detail_row("Payment method", f"Visa ending {d.get('card_last4', '****')}")}
    </table>'''
    
    return (
        heading("Your ReeveOS invoice")
        + paragraph(d.get("period", ""), muted=True)
        + reassurance_box(
            f"£{d['amount']}",
            f"will leave your account ending in <strong>{d.get('card_last4', '****')}</strong> around <strong>{d.get('payment_date', '')}</strong>.",
            "Thanks for paying by card on file."
        )
        + f'<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:24px 0;">{items_html}{line_item("Net amount", f"£{d.get("""net""", """0""")}", muted=True)}{line_item("VAT at 20%", f"£{d.get("""vat""", """0""")}", muted=True)}{total_row("Total due", f"£{d["""amount"""]}")}</table>'
        + details_html
        + button("View Full Invoice", d.get("invoice_url", "#"))
        + divider()
        + paragraph("Something not right? Reply to this email or contact support@reeveos.app and we'll sort it out.", muted=True, small=True)
    )


# ═══════════════════════════════════════
# SHOP
# ═══════════════════════════════════════

def abandoned_cart(d: dict) -> str:
    """d: client_name, items (list of {"name", "price"}), total, cart_url"""
    items_html = ""
    for item in d.get("items", []):
        items_html += f'''<tr>
            <td style="padding:12px 0;border-bottom:1px solid {BORDER};font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:bold;color:{BLACK};">{item["name"]}</td>
            <td style="padding:12px 0;border-bottom:1px solid {BORDER};font-family:Arial,Helvetica,sans-serif;font-size:14px;color:{BLACK};text-align:right;">{item["price"]}</td>
        </tr>'''
    
    return (
        heading("You left something behind")
        + paragraph(f"Hi {d['client_name']}, looks like you didn't finish checking out. Your items are still waiting:")
        + f'<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:20px 0;">{items_html}{total_row("Your basket", f"£{d["""total"""]}")}</table>'
        + button("Complete My Order", d.get("cart_url", "#"))
        + paragraph("We've saved your basket for 48 hours. After that, items may go out of stock.", muted=True, small=True)
    )


# ═══════════════════════════════════════
# STAFF
# ═══════════════════════════════════════

def schedule_published(d: dict) -> str:
    """d: staff_name, publisher_name, shifts (list of {"day", "time", "clients"}), total_hours, total_clients, schedule_url"""
    shifts_html = ""
    for shift in d.get("shifts", []):
        is_off = shift["time"].upper() == "OFF"
        opacity = "0.5" if is_off else "1"
        clients_html = f'<td style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:{MUTED};text-align:right;">{shift.get("clients", "")}</td>' if not is_off else '<td></td>'
        shifts_html += f'''<tr style="opacity:{opacity};">
            <td style="padding:10px 0;border-bottom:1px solid {BORDER};font-family:Arial,Helvetica,sans-serif;">
                <span style="font-size:13px;font-weight:bold;color:{BLACK};">{shift["day"]}</span><br/>
                <span style="font-size:12px;color:{MUTED if is_off else TEXT};">{shift["time"]}</span>
            </td>
            {clients_html}
        </tr>'''
    
    return (
        heading("Your schedule for next week")
        + paragraph(f"Hi {d['staff_name']}, {d.get('publisher_name', 'your manager')} has published next week's rota. Here are your shifts:")
        + f'<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:20px 0;">{shifts_html}</table>'
        + f'''<table role="presentation" cellspacing="8" cellpadding="0" border="0" width="100%" style="margin:20px 0;"><tr>
            {stat_box("Total hours", d.get("total_hours", ""))}
            {stat_box("Booked clients", str(d.get("total_clients", 0)))}
        </tr></table>'''
        + button("View Full Schedule", d.get("schedule_url", "#"))
        + paragraph("Need to swap a shift? Speak to your manager or request a change in the app.", muted=True, small=True)
    )


# ═══════════════════════════════════════
# INVENTORY
# ═══════════════════════════════════════

def low_stock(d: dict) -> str:
    """d: biz_name, items (list of {"name", "stock", "min", "urgent": bool}), reorder_url, inventory_url"""
    items_html = ""
    for item in d.get("items", []):
        bg = RED_BG if item.get("urgent") else WARN_BG
        tx = RED_TX if item.get("urgent") else WARN_TX
        items_html += f'''<tr>
            <td style="padding:12px 0;border-bottom:1px solid {BORDER};font-family:Arial,Helvetica,sans-serif;">
                <span style="font-size:13px;font-weight:bold;color:{BLACK};">{item["name"]}</span><br/>
                <span style="font-size:11px;color:{MUTED};">Min: {item["min"]}</span>
            </td>
            <td style="padding:12px 0;border-bottom:1px solid {BORDER};text-align:right;">
                <span style="padding:4px 10px;border-radius:12px;font-size:11px;font-weight:bold;background-color:{bg};color:{tx};">{item["stock"]}</span>
            </td>
        </tr>'''
    
    return (
        heading("Stock running low")
        + paragraph(f"These items at <strong>{d.get('biz_name', '')}</strong> need reordering:")
        + f'<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:20px 0;">{items_html}</table>'
        + button("Reorder from Supplier", d.get("reorder_url", "#"))
        + button("View Full Inventory", d.get("inventory_url", "#"), secondary=True)
        + paragraph("You're getting this because these items dropped below the minimum stock level you set.", muted=True, small=True)
    )


def purchase_order(d: dict) -> str:
    """d: po_number, date, from_name, from_address, to_name, to_dept, items (list of {"name", "qty", "unit", "total"}), order_total, delivery, payment_terms"""
    items_html = ""
    for item in d.get("items", []):
        items_html += f'''<tr>
            <td style="padding:10px 0;border-bottom:1px solid {BORDER};font-family:Arial,Helvetica,sans-serif;font-size:13px;color:{BLACK};">{item["name"]}</td>
            <td style="padding:10px 0;border-bottom:1px solid {BORDER};font-family:Arial,Helvetica,sans-serif;font-size:13px;color:{BLACK};text-align:center;">{item["qty"]}</td>
            <td style="padding:10px 0;border-bottom:1px solid {BORDER};font-family:Arial,Helvetica,sans-serif;font-size:13px;color:{MUTED};text-align:right;">{item["unit"]}</td>
            <td style="padding:10px 0;border-bottom:1px solid {BORDER};font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;color:{BLACK};text-align:right;">{item["total"]}</td>
        </tr>'''
    
    return (
        heading("Purchase Order")
        + paragraph(d.get("po_number", ""), muted=True, small=True)
        + f'<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:16px 0;padding:16px 0;border-top:1px solid {BORDER};border-bottom:1px solid {BORDER};"><tr><td style="vertical-align:top;font-family:Arial,Helvetica,sans-serif;"><span style="font-size:10px;color:{MUTED};text-transform:uppercase;letter-spacing:1px;">From</span><br/><span style="font-size:13px;font-weight:bold;color:{BLACK};">{d.get("from_name", "")}</span><br/><span style="font-size:12px;color:{MUTED};">{d.get("from_address", "")}</span></td><td style="vertical-align:top;text-align:right;font-family:Arial,Helvetica,sans-serif;"><span style="font-size:10px;color:{MUTED};text-transform:uppercase;letter-spacing:1px;">To</span><br/><span style="font-size:13px;font-weight:bold;color:{BLACK};">{d.get("to_name", "")}</span><br/><span style="font-size:12px;color:{MUTED};">{d.get("to_dept", "")}</span></td></tr></table>'
        + f'<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:20px 0;">{items_html}{total_row("Order total", f"£{d.get("""order_total""", """0""")}")}</table>'
        + paragraph(f"Delivery: {d.get('delivery', 'Standard')}", muted=True, small=True)
        + paragraph(f"Payment: {d.get('payment_terms', 'On account')}", muted=True, small=True)
        + divider()
        + paragraph(f"This purchase order was generated by ReeveOS on behalf of {d.get('from_name', '')}.", muted=True, small=True)
    )


# ═══════════════════════════════════════
# MOTHERSHIP / PARTNER PROGRAMME
# ═══════════════════════════════════════

def partner_invite(d: dict) -> str:
    """d: referrer_name, referrer_biz, signup_url"""
    return (
        heading("You've been invited to join ReeveOS")
        + paragraph(f"Hi there, <strong>{d['referrer_name']}</strong> from {d.get('referrer_biz', '')} thinks ReeveOS would be a great fit for your business.")
        + staff_card(d["referrer_name"], d.get("referrer_biz", ""), d["referrer_name"][0])
        + paragraph("ReeveOS gives you online bookings, a free website, smart scheduling, and card payments with the lowest rates — all in one place.")
        + icon_row("1", "Free to start", "No setup fee, no contract, cancel anytime")
        + icon_row("2", "Free website", "Worth £800, built for you by our team")
        + icon_row("3", "Lowest card rates", "0.3% debit, 0.7% credit via Dojo")
        + button("Get Started Free", d.get("signup_url", "#"))
        + paragraph(f"This invitation was sent by {d['referrer_name']} via the ReeveOS Partner Programme.", muted=True, small=True)
    )


def commission_payout(d: dict) -> str:
    """d: partner_name, amount, card_last4, active_referrals, new_this_month, commission_rate, dashboard_url"""
    return (
        heading(f"You've earned this month, {d['partner_name']}")
        + reassurance_box(
            f"£{d['amount']}",
            f"will be paid to your account ending in <strong>{d.get('card_last4', '****')}</strong> within 5 working days.",
            "Your partner earnings for this month."
        )
        + f'<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:20px 0;">'
        + line_item("Active referrals", f"{d.get('active_referrals', 0)} businesses")
        + line_item("New this month", f"{d.get('new_this_month', 0)} businesses")
        + line_item("Commission rate", d.get("commission_rate", "£12.50/mo each"))
        + total_row("This month's total", f"£{d['amount']}")
        + '</table>'
        + button("View Partner Dashboard", d.get("dashboard_url", "#"))
    )


# ═══════════════════════════════════════
# WEBSITE BUILDER
# ═══════════════════════════════════════

def website_published(d: dict) -> str:
    """d: owner_name, biz_name, site_url, edit_url"""
    return (
        heading("Your website is live!")
        + paragraph(f"Great news, {d['owner_name']} — your website for <strong>{d['biz_name']}</strong> is now live and ready for customers.")
        + f'<div style="margin:20px 0;padding:20px;background-color:{BG};border-radius:8px;text-align:center;">'
        f'<p style="font-size:18px;font-weight:bold;color:{GOLD};margin:0 0 4px;">{d.get("site_url", "")}</p>'
        f'<p style="font-size:12px;color:{MUTED};margin:0;">Your free ReeveOS website</p></div>'
        + paragraph("Customers can now find you, see your services, and book online. Share it everywhere:")
        + icon_row("&#128241;", "Instagram & TikTok", "Add the link to your bio")
        + icon_row("&#128231;", "Email signature", "Paste it below your name")
        + icon_row("&#128204;", "Google Business", "Set it as your website URL")
        + button("View My Website", d.get("site_url", "#"))
        + button("Edit My Website", d.get("edit_url", "#"), secondary=True)
        + divider()
        + paragraph("Want your own custom domain? Upgrade to the Scale plan and we'll set it up for free.", muted=True, small=True)
    )


# ═══════════════════════════════════════
# EPOS
# ═══════════════════════════════════════

def epos_end_of_day(d: dict) -> str:
    """d: biz_name, date, total_sales, transactions, avg_ticket, payment_breakdown (list), cash_drawer (list), voids, refunds, discounts, busiest_hour, report_url"""
    payments_html = ""
    for p in d.get("payment_breakdown", []):
        payments_html += f'''<tr>
            <td style="padding:10px 0;border-bottom:1px solid {BORDER};font-family:Arial,Helvetica,sans-serif;font-size:13px;color:{BLACK};">{p["label"]} <span style="font-size:11px;color:{MUTED};">({p.get("pct", "")})</span></td>
            <td style="padding:10px 0;border-bottom:1px solid {BORDER};font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;color:{BLACK};text-align:right;">{p["amount"]}</td>
        </tr>'''
    
    cash_html = ""
    for c in d.get("cash_drawer", []):
        cash_html += detail_row(c["label"], c["value"])
    
    ops_html = ""
    for key in ["voids", "refunds", "discounts", "busiest_hour"]:
        if d.get(key):
            label = key.replace("_", " ").title()
            ops_html += detail_row(label, d[key])
    
    return (
        heading(f"End of day — {d.get('date', '')}")
        + paragraph(f"Here's tonight's cash-up summary for <strong>{d.get('biz_name', '')}</strong>:")
        + f'''<table role="presentation" cellspacing="8" cellpadding="0" border="0" width="100%" style="margin:20px 0;"><tr>
            {stat_box("Total Sales", d.get("total_sales", ""))}
            {stat_box("Transactions", str(d.get("transactions", 0)))}
            {stat_box("Avg Ticket", d.get("avg_ticket", ""))}
        </tr></table>'''
        + f'<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:16px 0;">{payments_html}</table>'
        + f'<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:16px 0;">{cash_html}</table>'
        + f'<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:16px 0;">{ops_html}</table>'
        + button("View Full Report", d.get("report_url", "#"))
    )
