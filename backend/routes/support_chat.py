"""
Support Chat API — proxies to Anthropic Claude for the marketing support page.
Keeps API key server-side. CORS enabled for reeveos.app.
"""
from fastapi import APIRouter, Body
from fastapi.responses import JSONResponse
import httpx
import os

router = APIRouter(prefix="/api/public-support", tags=["public-support"])

SYSTEM_PROMPT = """You are ReeveOS AI Support — a helpful, friendly UK-based assistant for the ReeveOS booking platform.

ReeveOS is a zero-commission booking and business management platform for UK independent businesses. Two types:
- **Hospitality**: Restaurants, bars, pubs — table bookings, floor plans, reservations
- **Local Services**: Salons, barbers, spas, clinics, cafés, takeaways — appointment bookings, client management

Key facts:
- Pricing: Free (£0, 1 staff, 100 bookings), Starter (£8.99, 3 staff), Growth (£29, 5 staff, deposits, CRM), Scale (£59, unlimited, floor plan, white-label), Enterprise (£149 custom)
- Zero commission on all plans — no hidden fees
- Card processing via Dojo: 0.3% debit, 0.7% credit, 2.5p auth fee
- Deposits flow through Stripe Connect directly to the business owner
- Delivery via Uber Direct integration (restaurants only)
- Features: Calendar, CRM, Analytics, Staff management, Online booking page, SMS reminders, Consultation forms, Shop/products
- Founded by Ibby Jalloh (Founder & CEO) and Grant Woods (Co-Founder)
- UK-based, built for high street businesses
- Sign up at portal.rezvo.app/signup
- Login at portal.rezvo.app/login

Keep answers concise, friendly, and helpful. Use British English. If you don't know something specific, direct them to hello@reeveos.app."""


@router.post("/chat")
async def support_chat(body: dict = Body(...)):
    """Proxy chat to Anthropic Claude API."""
    api_key = os.environ.get("ANTHROPIC_API_KEY", "")
    if not api_key:
        return JSONResponse({"reply": "Our AI support is currently being set up. Please email hello@reeveos.app for help, or use the FAQ answers below!"}, status_code=200)

    user_message = body.get("message", "").strip()
    if not user_message:
        return JSONResponse({"reply": "Please type a question and I'll help you out!"}, status_code=200)

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key": api_key,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json",
                },
                json={
                    "model": "claude-sonnet-4-20250514",
                    "max_tokens": 500,
                    "system": SYSTEM_PROMPT,
                    "messages": [{"role": "user", "content": user_message}],
                },
            )
            data = resp.json()
            reply = ""
            for block in data.get("content", []):
                if block.get("type") == "text":
                    reply += block.get("text", "")
            if not reply:
                reply = "I'm having trouble thinking right now. Please try again or email hello@reeveos.app."
            return {"reply": reply}
    except Exception as e:
        print(f"Support chat error: {e}")
        return {"reply": "I'm having a moment — please try again in a few seconds, or email hello@reeveos.app for help!"}
