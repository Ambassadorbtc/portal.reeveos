"""
ReeveOS SMS Templates
======================
All messages under 160 characters.
Business name always first.
Sent via Sendly.

Usage:
    from helpers.sms_templates import get_sms
    text = get_sms("booking_confirmed", business, data)
"""


def _truncate(text: str, max_len: int = 160) -> str:
    """Ensure SMS is under 160 chars to avoid double-message charges."""
    if len(text) <= max_len:
        return text
    return text[:max_len - 3] + "..."


def get_sms(template_name: str, business: dict, data: dict) -> str:
    """Return SMS text for the given template name."""
    biz = business.get("name", "ReeveOS")
    fn = SMS_TEMPLATES.get(template_name)
    if not fn:
        return None
    return _truncate(fn(biz, data))


# ═══════════════════════════════════════
# TEMPLATE FUNCTIONS
# ═══════════════════════════════════════

def _booking_confirmed(biz, d):
    return f"{biz}: Booking confirmed. {d['service']} on {d['date']} at {d['time']} with {d.get('staff', '')}. Booking fee: £{d.get('booking_fee', '0')} paid. View: {d.get('link', '')}"

def _reminder_24h(biz, d):
    return f"{biz}: Reminder — {d['service']} tomorrow at {d['time']} with {d.get('staff', '')}. Please arrive 5 mins early. Need to change? {d.get('link', '')}"

def _reminder_2h(biz, d):
    return f"{biz}: See you in 2 hours for your {d['service']} at {d['time']}. {d.get('address', '')}"

def _rescheduled(biz, d):
    return f"{biz}: Your {d['service']} has been moved to {d['new_date']} at {d['new_time']} with {d.get('staff', '')}. View details: {d.get('link', '')}"

def _cancelled_by_client(biz, d):
    return f"{biz}: Your {d['service']} on {d['date']} has been cancelled. Rebook anytime: {d.get('link', '')}"

def _cancelled_by_business(biz, d):
    return f"{biz}: Sorry, your {d['service']} on {d['date']} at {d['time']} has been cancelled. We'll be in touch to rebook. Questions? Call {d.get('phone', '')}"

def _no_show(biz, d):
    return f"{biz}: We missed you today for your {d['service']}. Your booking fee has been retained. Rebook: {d.get('link', '')}"

def _reservation_confirmed(biz, d):
    return f"{biz}: Table confirmed for {d['party_size']} on {d['date']} at {d['time']}. Ref: {d.get('ref', '')}. View: {d.get('link', '')}"

def _reservation_reminder_24h(biz, d):
    return f"{biz}: Reminder — table for {d['party_size']} tomorrow at {d['time']}. Please arrive on time to guarantee your table. Change: {d.get('link', '')}"

def _reservation_reminder_2h(biz, d):
    return f"{biz}: See you in 2 hours! Table for {d['party_size']} at {d['time']}. {d.get('address', '')}"

def _form_request(biz, d):
    return f"{biz}: Please complete your health form before your {d['service']} on {d['date']}. Takes 3 mins: {d.get('link', '')}"

def _form_reminder(biz, d):
    return f"{biz}: Reminder — your health form is still needed for tomorrow's appointment. Without it we can't proceed. Complete now: {d.get('link', '')}"

def _form_expiring(biz, d):
    return f"{biz}: Your health consultation form expires on {d['expiry_date']}. Please review and re-sign before your next appointment: {d.get('link', '')}"

def _form_blocked(biz, d):
    return f"{biz}: Based on your health form, your {d['service']} on {d['date']} cannot go ahead as booked. We'll call you to discuss options."

def _aftercare(biz, d):
    return f"{biz}: Aftercare instructions for today's {d['service']} have been emailed to you. Follow them carefully for best results."

def _order_confirmed(biz, d):
    return f"{biz}: Order #{d.get('ref', '')} confirmed. {d.get('item_count', '')} items, £{d.get('total', '')}. We'll let you know when it's ready. Track: {d.get('link', '')}"

def _order_ready(biz, d):
    return f"{biz}: Your order #{d.get('ref', '')} is ready to collect! {d.get('address', '')}. Please collect within 30 mins."

def _order_delivery(biz, d):
    return f"{biz}: Your order #{d.get('ref', '')} is on its way! Estimated delivery: {d.get('eta', '')}. Track: {d.get('link', '')}"

def _payment_receipt(biz, d):
    return f"{biz}: Payment of £{d['amount']} received for {d['service']}. Ref: {d.get('ref', '')}. Receipt emailed to you."

def _payment_failed(biz, d):
    return f"{biz}: Your payment of £{d['amount']} didn't go through. Please update your card to keep your booking: {d.get('link', '')}"

def _refund(biz, d):
    return f"{biz}: A refund of £{d['amount']} has been issued to your card ending {d.get('card_last4', '****')}. Allow 5-10 days to appear."

def _package_session(biz, d):
    return f"{biz}: Session {d['current']} of {d['total']} complete on your {d['package']}. {d['remaining']} left. Book next: {d.get('link', '')}"

def _package_expiring(biz, d):
    return f"{biz}: Your {d['package']} expires on {d['expiry_date']}. You have {d['remaining']} sessions left. Book now: {d.get('link', '')}"

def _voucher_received(biz, d):
    return f"{biz}: You've received a £{d['amount']} gift voucher from {d['sender']}! Code: {d['code']}. Book & redeem: {d.get('link', '')}"

def _voucher_expiring(biz, d):
    return f"{biz}: Your £{d['amount']} gift voucher expires on {d['expiry_date']}. Don't lose it — book now: {d.get('link', '')}"

def _review_request(biz, d):
    return f"{biz}: Thanks for visiting today! Got 30 seconds to leave a quick review? It means a lot: {d.get('link', '')}"

def _password_reset(biz, d):
    return f"ReeveOS: Your password reset link (expires in 1 hour): {d.get('link', '')}. If you didn't request this, ignore this message."

def _email_verification(biz, d):
    return f"ReeveOS: Verify your email to complete your account setup: {d.get('link', '')}. This link expires in 24 hours."

def _walkin_form(biz, d):
    return f"{biz}: Hi {d.get('client_name', '')}, please fill in this quick health form on your phone: {d.get('link', '')}. Takes 3 mins."


# ═══════════════════════════════════════
# TEMPLATE MAP
# ═══════════════════════════════════════

SMS_TEMPLATES = {
    # Bookings — salon
    "booking_confirmed": _booking_confirmed,
    "reminder_24h": _reminder_24h,
    "reminder_2h": _reminder_2h,
    "rescheduled": _rescheduled,
    "cancelled_by_client": _cancelled_by_client,
    "cancelled_by_business": _cancelled_by_business,
    "no_show": _no_show,
    
    # Reservations — restaurant
    "reservation_confirmed": _reservation_confirmed,
    "reservation_reminder_24h": _reservation_reminder_24h,
    "reservation_reminder_2h": _reservation_reminder_2h,
    
    # Forms
    "form_request": _form_request,
    "form_reminder": _form_reminder,
    "form_expiring": _form_expiring,
    "form_blocked": _form_blocked,
    
    # Aftercare
    "aftercare": _aftercare,
    
    # Orders
    "order_confirmed": _order_confirmed,
    "order_ready": _order_ready,
    "order_delivery": _order_delivery,
    
    # Payments
    "payment_receipt": _payment_receipt,
    "payment_failed": _payment_failed,
    "refund": _refund,
    
    # Packages
    "package_session": _package_session,
    "package_expiring": _package_expiring,
    
    # Vouchers
    "voucher_received": _voucher_received,
    "voucher_expiring": _voucher_expiring,
    
    # Reviews
    "review_request": _review_request,
    
    # Account
    "password_reset": _password_reset,
    "email_verification": _email_verification,
    
    # Walk-in
    "walkin_form": _walkin_form,
}
