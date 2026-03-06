"""
Seed Rejuvenate Journey Map tasks into the Command Centre project board.
Run on VPS: python3 backend/scripts/seed_rejuvenate_board.py

Safe to run multiple times — skips features that already exist (by name).
"""

import asyncio
import os
import sys
from datetime import datetime
from motor.motor_asyncio import AsyncIOMotorClient

MONGO_URL = os.environ.get("MONGODB_URL", os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
DB_NAME = os.environ.get("MONGODB_DB", os.environ.get("DB_NAME", "rezvo_production"))

FEATURES = [
    # ═══════════════════════════════════════════════════════════════
    # P0 — MONDAY LOGIN BLOCKERS (must work for Natalie demo)
    # ═══════════════════════════════════════════════════════════════
    {
        "name": "Seed Rejuvenate business, staff, services, bookings",
        "desc": "Create Rejuvenate Skin Experts in DB with all 5 treatment types, 4 staff (Natalie, Grace, Emily, Jen), and 3 months of realistic booking history. Without this, every dashboard page shows empty.",
        "cat": "Local Services",
        "pri": "P0",
        "stage": "backlog",
        "comp": [],
        "effort": "Medium",
        "rev": "Very High",
        "assignee": "Claude",
        "target_date": "2026-03-07",
        "checks": [
            {"t": "Create Rejuvenate business record with correct slug", "d": False},
            {"t": "Seed 5 treatment categories: Microneedling, Chemical Peels, RF Needling, Polynucleotides, Lymphatic Lift", "d": False},
            {"t": "Seed individual services with prices (e.g. Luxury Lymphatic £80, Skin Commitment 6-pack)", "d": False},
            {"t": "Seed 4 staff members with schedules and roles", "d": False},
            {"t": "Seed 3 months of realistic booking data across all services", "d": False},
            {"t": "Seed 10+ client records with consultation form submissions", "d": False},
            {"t": "Verify data shows correctly on Dashboard, Calendar, Bookings, Staff, Services pages", "d": False},
        ],
    },
    {
        "name": "Wire consultation form to submission API + contraindication engine",
        "desc": "The consultation form UI exists in ClientPortal.jsx but doesn't POST to /api/consultation/business/:id/submit. Backend contraindication engine is fully built (20 conditions × 5 treatments). Need to connect frontend form → backend API → store submission → run contra check → return results.",
        "cat": "Local Services",
        "pri": "P0",
        "stage": "backlog",
        "comp": ["Fresha", "Phorest", "Vagaro"],
        "effort": "High",
        "rev": "Very High",
        "assignee": "Claude",
        "target_date": "2026-03-07",
        "checks": [
            {"t": "Map all 50+ form fields from spec to API payload", "d": False},
            {"t": "Wire form submit handler to POST /api/consultation/business/:id/submit", "d": False},
            {"t": "Contraindication engine runs on submit, returns BLOCK/FLAG/OK per treatment", "d": False},
            {"t": "Display BLOCK results to client: 'You cannot book X due to Y'", "d": False},
            {"t": "Display FLAG results: 'Your therapist will review X before treatment'", "d": False},
            {"t": "Store submission with encrypted medical data (GDPR)", "d": False},
            {"t": "Digital signature capture (touch/draw pad) with timestamp + IP", "d": False},
            {"t": "6-month expiry auto-set on submission", "d": False},
            {"t": "Test full flow: fill form → submit → check results → view in staff dashboard", "d": False},
        ],
    },
    {
        "name": "Fix Calendar: FAB overlap + local services add-booking modal",
        "desc": "Calendar.jsx FAB at bottom:24/right:24/z-60 is completely hidden by SupportBot at bottom:20/right:20/z-9999. The add-booking modal still shows restaurant fields (party size, walk-in, table). Local services needs: client name/phone, service picker, staff assignment, time slot.",
        "cat": "Local Services",
        "pri": "P0",
        "stage": "backlog",
        "comp": ["Fresha", "Sesame", "Vagaro"],
        "effort": "Medium",
        "rev": "High",
        "assignee": "Claude",
        "target_date": "2026-03-07",
        "checks": [
            {"t": "Remove Calendar FAB — move Add Booking to header toolbar", "d": False},
            {"t": "SupportBot remains sole bottom-right FAB", "d": False},
            {"t": "Create local services add-booking modal: client search/create, service picker, staff dropdown, time slot", "d": False},
            {"t": "Remove restaurant-specific fields (party size, walk-in toggle, table assignment) from local services mode", "d": False},
            {"t": "Test: add booking from calendar → appears immediately → detail popover works", "d": False},
        ],
    },
    {
        "name": "Fix Bookings page: local services labels + service swap",
        "desc": "Bookings.jsx uses restaurant labels ('Seated' for checked_in). No way to swap service on existing booking — Natalie's #1 frustration with Sesame: 'We can't go onto that booked space and swap it. We have to cancel and rebook.'",
        "cat": "Local Services",
        "pri": "P0",
        "stage": "backlog",
        "comp": ["Fresha", "Sesame"],
        "effort": "Medium",
        "rev": "Very High",
        "assignee": "Claude",
        "target_date": "2026-03-07",
        "checks": [
            {"t": "Make status labels business-type-aware: 'In Treatment' not 'Seated' for local services", "d": False},
            {"t": "Add service-swap button on booking detail panel", "d": False},
            {"t": "Backend endpoint to update service on existing booking without cancel/rebook", "d": False},
            {"t": "Auto-adjust duration when service changes", "d": False},
            {"t": "Notify client of service change (optional, therapist-controlled)", "d": False},
        ],
    },
    {
        "name": "Fix booking link: verify book.reeveos.app + test public flow",
        "desc": "BookingRedirect in App.jsx sends /book/* to book.reeveos.app. DNS/nginx may not be configured. BookingLink.jsx generates URLs to book.reeveos.app/:slug. Need to verify entire public booking flow works end-to-end with seeded Rejuvenate data.",
        "cat": "Local Services",
        "pri": "P0",
        "stage": "backlog",
        "comp": [],
        "effort": "Medium",
        "rev": "Very High",
        "assignee": "Claude",
        "target_date": "2026-03-07",
        "checks": [
            {"t": "Verify book.reeveos.app DNS resolves correctly", "d": False},
            {"t": "Verify nginx serves booking app on book.reeveos.app", "d": False},
            {"t": "Test: book.reeveos.app/rejuvenate-skin-experts loads services list", "d": False},
            {"t": "Test: pick service → pick date/time → enter details → confirm booking", "d": False},
            {"t": "Test: booking appears in staff calendar and bookings page", "d": False},
            {"t": "Test: confirmation page shows with manage link", "d": False},
        ],
    },

    # ═══════════════════════════════════════════════════════════════
    # P0 — FRIDAY 7 MAR DEMO FEATURES
    # ═══════════════════════════════════════════════════════════════
    {
        "name": "Medical changes quick-update prompt (returning client)",
        "desc": "Natalie: 'Rather than completing the whole form, just ask if anything changed.' On login/pre-booking, show quick prompt: 'Any medical changes since last visit?' If yes → detail field → updates added to record → therapist alerted on booking day.",
        "cat": "Local Services",
        "pri": "P0",
        "stage": "backlog",
        "comp": ["Phorest"],
        "effort": "Medium",
        "rev": "High",
        "assignee": "Claude",
        "target_date": "2026-03-07",
        "checks": [
            {"t": "Check consultation form expiry on client portal login", "d": False},
            {"t": "If valid: show 'Any medical changes?' yes/no prompt", "d": False},
            {"t": "If yes: show key condition checkboxes + free text", "d": False},
            {"t": "Store update as amendment to existing submission", "d": False},
            {"t": "Re-run contraindication check with updated data", "d": False},
            {"t": "Flag changes on booking day calendar popover for therapist", "d": False},
            {"t": "If expired: redirect to full re-review form", "d": False},
        ],
    },
    {
        "name": "Package tracking: purchase, progress bar, booking popover count",
        "desc": "Most commonly asked question in clinic: 'How many more sessions do I have left in my package?' Natalie had to manually count diary entries. Need: Skin Commitment (6 sessions) and RF package purchase, progress bar (4/6), visible from booking popover AND client profile.",
        "cat": "Local Services",
        "pri": "P0",
        "stage": "backlog",
        "comp": ["Fresha", "Phorest", "Vagaro"],
        "effort": "High",
        "rev": "Very High",
        "assignee": "Claude",
        "target_date": "2026-03-10",
        "checks": [
            {"t": "Package data model: name, total sessions, sessions used, treatment types, purchase date, expiry", "d": False},
            {"t": "Backend: create/update/query package endpoints", "d": False},
            {"t": "Staff dashboard: create package for client (Skin Commitment 6-pack, RF 6-pack)", "d": False},
            {"t": "Auto-decrement on booking completion", "d": False},
            {"t": "Progress bar on client profile: '4 of 6 sessions used, 2 remaining'", "d": False},
            {"t": "Package info on calendar booking popover (visible without navigating away)", "d": False},
            {"t": "Client portal: show package progress to client", "d": False},
            {"t": "Bespoke session flexibility: Natalie changes treatment type within same package", "d": False},
        ],
    },
    {
        "name": "Therapist notes: private per-client notes on booking popover",
        "desc": "Natalie: 'Makes them feel so personalized.' Examples from transcript: client likes bed angled a certain way, only wants 3 products, part of wedding party Aug 12, Indian family of 8. Notes visible from booking popover and client profile.",
        "cat": "Local Services",
        "pri": "P0",
        "stage": "backlog",
        "comp": ["Fresha", "Phorest", "OpenTable"],
        "effort": "Low",
        "rev": "High",
        "assignee": "Claude",
        "target_date": "2026-03-07",
        "checks": [
            {"t": "Private notes field on client record (any therapist in business can see)", "d": False},
            {"t": "Add/edit notes from client profile page", "d": False},
            {"t": "Show latest note on calendar booking popover (preview, click to expand)", "d": False},
            {"t": "Note history with timestamps and author", "d": False},
            {"t": "Sample tracking note: 'Gave sample of X on Y date'", "d": False},
        ],
    },
    {
        "name": "SMS reminders via Sendly (confirmation + 24hr reminder)",
        "desc": "Sendly.live integration for UK SMS. Booking confirmation SMS immediately on booking. 24hr reminder SMS before appointment. Required for any modern booking system.",
        "cat": "Local Services",
        "pri": "P0",
        "stage": "backlog",
        "comp": ["Fresha", "Sesame", "Vagaro", "Phorest"],
        "effort": "Medium",
        "rev": "High",
        "assignee": "Claude",
        "target_date": "2026-03-10",
        "checks": [
            {"t": "Sendly API integration (API key, send endpoint)", "d": False},
            {"t": "Booking confirmation SMS on create", "d": False},
            {"t": "24hr reminder SMS (cron job or scheduled task)", "d": False},
            {"t": "SMS template management in settings", "d": False},
            {"t": "Opt-out handling (client can disable SMS)", "d": False},
            {"t": "Delivery status tracking/logging", "d": False},
        ],
    },
    {
        "name": "72hr cancellation enforcement (tiered)",
        "desc": "Tiered cancellation policy: 24hr basic, 48hr mid, 72hr advanced treatments. Use 'booking fee' not 'deposit'. If late cancel → forfeiture of booking fee. Client must acknowledge policy during booking.",
        "cat": "Local Services",
        "pri": "P0",
        "stage": "backlog",
        "comp": ["Fresha", "Phorest"],
        "effort": "Medium",
        "rev": "High",
        "assignee": "Claude",
        "target_date": "2026-03-10",
        "checks": [
            {"t": "Cancellation tier config per service category (24hr/48hr/72hr)", "d": False},
            {"t": "Client acknowledgement checkbox during booking flow", "d": False},
            {"t": "Block self-cancel inside cancellation window in client portal", "d": False},
            {"t": "Show warning: 'Cancelling within X hours will forfeit your booking fee'", "d": False},
            {"t": "Staff override: can still cancel/refund from dashboard", "d": False},
            {"t": "Booking fee collection via Stripe at booking time", "d": False},
        ],
    },

    # ═══════════════════════════════════════════════════════════════
    # P1 — POST-DEMO QUICK WINS (Week of 10 Mar)
    # ═══════════════════════════════════════════════════════════════
    {
        "name": "Pre-appointment medical update email (4 days before)",
        "desc": "Natalie wants system to email clients 4 days before appointment: 'Any medical changes since last visit?' Links to quick-update form. Key contraindications (cold sore, pregnancy) trigger auto-flag to reschedule.",
        "cat": "Local Services",
        "pri": "P1",
        "stage": "backlog",
        "comp": ["Phorest"],
        "effort": "Medium",
        "rev": "High",
        "checks": [
            {"t": "Scheduled job: find bookings 4 days out, send medical check email", "d": False},
            {"t": "Email template with quick-update link (no login required)", "d": False},
            {"t": "If cold sore / pregnancy ticked: auto-message 'contact clinic to reschedule'", "d": False},
            {"t": "If no response: therapist sees 'No pre-check completed' on booking", "d": False},
            {"t": "If all clear: green badge on booking day", "d": False},
        ],
    },
    {
        "name": "Treatment consent forms (per treatment type)",
        "desc": "4 consent forms from spec: Microneedling (2A), Chemical Peel (2B), RF Needling (2C), Polynucleotides (2D). Signed before each new treatment/course. Auto-populated fields from consultation form. Digital signature.",
        "cat": "Local Services",
        "pri": "P1",
        "stage": "backlog",
        "comp": ["Phorest", "Fresha"],
        "effort": "High",
        "rev": "High",
        "checks": [
            {"t": "Microneedling consent form (treatment areas, needle depth, patch test, pre/post care)", "d": False},
            {"t": "Chemical Peel consent form (peel type, Fitzpatrick auto-populated, patch test)", "d": False},
            {"t": "RF Needling consent form (pacemaker/metal auto-check from consultation, fillers <6mo)", "d": False},
            {"t": "Polynucleotides consent form (fish allergy auto-block, injection reactions)", "d": False},
            {"t": "Auto-populate fields from existing consultation data", "d": False},
            {"t": "Digital signature per consent form", "d": False},
            {"t": "Store consent per treatment session for insurance", "d": False},
        ],
    },
    {
        "name": "Treatment record per session (clinical documentation)",
        "desc": "Per-session clinical documentation: Microneedling (needle depth, serum, cartridge), Chemical Peel (type, concentration, layers, neutralisation), RF (temp, passes, energy), Polynucleotides (volume, sites, batch no). Before/after photos.",
        "cat": "Local Services",
        "pri": "P1",
        "stage": "backlog",
        "comp": ["Phorest"],
        "effort": "High",
        "rev": "High",
        "checks": [
            {"t": "Treatment record form per treatment type with fields from spec", "d": False},
            {"t": "Photo capture (before/after) with storage", "d": False},
            {"t": "Link to booking + client record", "d": False},
            {"t": "Therapist can view full treatment history per client", "d": False},
            {"t": "Exportable for insurance purposes", "d": False},
        ],
    },
    {
        "name": "Aftercare email automation (per treatment type)",
        "desc": "On appointment completion, auto-send treatment-specific aftercare instructions 15-30 min later. Content from Natalie's website. Logged for insurance. Natalie also wants post-treatment video in portal: 'Don't worry about redness, bugger off.'",
        "cat": "Local Services",
        "pri": "P1",
        "stage": "backlog",
        "comp": ["Phorest", "Fresha"],
        "effort": "Medium",
        "rev": "High",
        "checks": [
            {"t": "Aftercare email template per treatment type", "d": False},
            {"t": "Auto-trigger 15-30 min after appointment marked complete", "d": False},
            {"t": "Delivery logged for insurance documentation", "d": False},
            {"t": "Post-treatment video embed in client portal (per treatment)", "d": False},
            {"t": "Natalie provides aftercare content from existing website", "d": False},
        ],
    },
    {
        "name": "First-timer 15min buffer on first appointment",
        "desc": "Natalie: 'A first appointment does need a little bit more time.' Auto-allocate 15min extra on first booking with a new client for quick in-clinic consultation. Don't charge for it.",
        "cat": "Local Services",
        "pri": "P1",
        "stage": "backlog",
        "comp": [],
        "effort": "Low",
        "rev": "Medium",
        "checks": [
            {"t": "Detect first booking for client (no prior bookings in system)", "d": False},
            {"t": "Auto-add 15min buffer to appointment duration", "d": False},
            {"t": "Show 'First Visit' badge on calendar booking", "d": False},
            {"t": "Don't charge for extra time", "d": False},
        ],
    },
    {
        "name": "Cancellation-notify waitlist (last-minute slot filler)",
        "desc": "Natalie: 'I hate posting on social media last-minute availabilities.' Clients opt-in to waitlist toggle. When cancellation opens a slot, opted-in clients get SMS/email. First-come-first-served.",
        "cat": "Local Services",
        "pri": "P1",
        "stage": "backlog",
        "comp": ["Fresha", "Phorest"],
        "effort": "Medium",
        "rev": "High",
        "checks": [
            {"t": "Client opt-in toggle in portal settings: 'Notify me of cancellations'", "d": False},
            {"t": "On cancellation: find opted-in clients, send SMS + email", "d": False},
            {"t": "First-come-first-served: booking link in notification", "d": False},
            {"t": "Auto-close notification once slot filled", "d": False},
        ],
    },
    {
        "name": "Patch test tracking and auto-scheduling",
        "desc": "First-time microneedling and chemical peel clients require patch test. Auto-schedule 15min patch test 48hrs before treatment. If not completed, treatment status → 'Pending Patch Test' and can't check in.",
        "cat": "Local Services",
        "pri": "P1",
        "stage": "backlog",
        "comp": ["Phorest"],
        "effort": "Medium",
        "rev": "Medium",
        "checks": [
            {"t": "Detect first microneedling/peel booking → auto-create patch test appointment", "d": False},
            {"t": "Patch test: 15min, no charge, 48hrs before treatment", "d": False},
            {"t": "If patch test not completed: treatment status 'Pending Patch Test'", "d": False},
            {"t": "Block check-in until patch test done", "d": False},
        ],
    },

    # ═══════════════════════════════════════════════════════════════
    # P2 — GROWTH FEATURES (Post-launch)
    # ═══════════════════════════════════════════════════════════════
    {
        "name": "Skin Commitment + RF package purchase flow",
        "desc": "Two packages: Skin Commitment (6 sessions, mix of microneedling/lymphatic/peels, same price) and RF Package (6 sessions, more expensive, doesn't mix). One-click purchase. Klarna integration for £1000+ packages.",
        "cat": "Local Services",
        "pri": "P2",
        "stage": "backlog",
        "comp": ["Fresha", "Phorest"],
        "effort": "High",
        "rev": "Very High",
        "checks": [
            {"t": "Package product definitions (Skin Commitment, RF)", "d": False},
            {"t": "Stripe checkout for package purchase", "d": False},
            {"t": "Klarna integration for installments", "d": False},
            {"t": "Package appears in client portal with progress", "d": False},
            {"t": "Natalie: 'One-click purchase. We make it bespoke as we go.'", "d": False},
        ],
    },
    {
        "name": "Video consultation in portal (Google Meet integration)",
        "desc": "Natalie: 'A video call in the portal would be great.' Client books virtual consultation time. Google Meet embedded in portal. Post-call: automated follow-up with package recommendation + buy link.",
        "cat": "Local Services",
        "pri": "P2",
        "stage": "backlog",
        "comp": [],
        "effort": "Medium",
        "rev": "High",
        "checks": [
            {"t": "Virtual consultation booking type (no in-clinic time needed)", "d": False},
            {"t": "Google Meet link auto-generated and embedded in portal", "d": False},
            {"t": "Post-call: auto-send follow-up message with package + buy link", "d": False},
            {"t": "Replace Natalie's manual WhatsApp follow-up", "d": False},
        ],
    },
    {
        "name": "Gold member benefits + community events",
        "desc": "Natalie: '12-month package = 10% off products. Ticketed education events.' Gold members get: 10% off products, free tickets to education events (rosacea workshop, teenage acne), priority cancellation notifications.",
        "cat": "Local Services",
        "pri": "P2",
        "stage": "backlog",
        "comp": [],
        "effort": "High",
        "rev": "High",
        "checks": [
            {"t": "Gold member tier auto-assigned on 12-month package purchase", "d": False},
            {"t": "10% product discount auto-applied at checkout", "d": False},
            {"t": "Event creation in portal: date, description, ticket value, capacity", "d": False},
            {"t": "Gold members see events as free, non-members see ticket price", "d": False},
            {"t": "Push notification / email for new events", "d": False},
        ],
    },
    {
        "name": "Auto-generate landing pages for promotions",
        "desc": "Natalie: 'I need different landing pages for different buyers — impulse vs researcher.' Auto-generate Valentine's/Mother's Day/Father's Day pages from portal. Set active period, auto-take-down after.",
        "cat": "Local Services",
        "pri": "P2",
        "stage": "backlog",
        "comp": ["Shopify", "Wix"],
        "effort": "High",
        "rev": "High",
        "checks": [
            {"t": "Landing page builder in portal (AI-assisted)", "d": False},
            {"t": "Template library: seasonal, impulse-buy, researcher", "d": False},
            {"t": "Active date range: auto-publish and auto-take-down", "d": False},
            {"t": "Per-buyer-type landing pages (blue/red/yellow clients)", "d": False},
            {"t": "Analytics: click-through to booking", "d": False},
        ],
    },
    {
        "name": "AI chatbot on website directing to consultation",
        "desc": "Natalie: 'If we had a chatbot that says Great to know, why don't you chat with one of our therapists? Here's the link.' Simple AI chatbot that answers FAQs and directs to virtual consultation booking.",
        "cat": "Local Services",
        "pri": "P2",
        "stage": "backlog",
        "comp": [],
        "effort": "Medium",
        "rev": "Medium",
        "checks": [
            {"t": "Website chat widget (embeddable)", "d": False},
            {"t": "AI trained on Rejuvenate's FAQs and treatment info", "d": False},
            {"t": "Auto-direct to virtual consultation booking for complex queries", "d": False},
            {"t": "Capture lead info (name, email) if client not yet in system", "d": False},
        ],
    },
    {
        "name": "Smart diary optimisation (AI slot shuffling)",
        "desc": "Natalie losing £10-20K/year from rigid slot management. 45min gap shows fully booked when a 15min shuffle would open a full slot. AI looks at calendar, suggests moves: 'Move Sarah 15min later to open a full slot. Notify her?'",
        "cat": "Local Services",
        "pri": "P2",
        "stage": "backlog",
        "comp": [],
        "effort": "High",
        "rev": "Very High",
        "checks": [
            {"t": "Gap detection algorithm: find sub-appointment gaps", "d": False},
            {"t": "Suggest moves: 'Move X 15min to open Y slot'", "d": False},
            {"t": "One-click approve + auto-notify affected client", "d": False},
            {"t": "Track recovered revenue from optimisation", "d": False},
        ],
    },

    # ═══════════════════════════════════════════════════════════════
    # P3 — FUTURE / MOAT (Roadmap)
    # ═══════════════════════════════════════════════════════════════
    {
        "name": "AI scanner integration (before/after scans)",
        "desc": "Natalie has an AI skin scanner. Needs: email scan results to client's portal, show before/after comparison, auto-link recommended treatments and products to scan results. 'They just email a list of recommendations + click here to buy.'",
        "cat": "Local Services",
        "pri": "P3",
        "stage": "backlog",
        "comp": [],
        "effort": "High",
        "rev": "High",
        "checks": [
            {"t": "Configure scanner email relay through Google workspace", "d": False},
            {"t": "Display scan results in client portal", "d": False},
            {"t": "Before/after comparison view", "d": False},
            {"t": "Auto-link recommended treatments from scan results", "d": False},
            {"t": "Product recommendations with buy links", "d": False},
        ],
    },
    {
        "name": "Training academy subscriber portal (reseller model)",
        "desc": "Natalie launching training academy. Every student is a potential platform subscriber at £12.50/mo. 30 contacts already want the same platform. Reseller commission structure.",
        "cat": "Local Services",
        "pri": "P3",
        "stage": "backlog",
        "comp": [],
        "effort": "High",
        "rev": "Very High",
        "checks": [
            {"t": "Academy starter pack onboarding flow", "d": False},
            {"t": "Reseller referral tracking (Natalie → subscriber)", "d": False},
            {"t": "£12.50/mo pricing tier for academy subscribers", "d": False},
            {"t": "White-label options for academy students", "d": False},
        ],
    },
    {
        "name": "Client self-service booking management",
        "desc": "Natalie: 'Ideally the client would manage this through the portal themselves.' Client can reschedule, swap treatment, cancel (within policy) from their portal without calling the clinic.",
        "cat": "Local Services",
        "pri": "P3",
        "stage": "backlog",
        "comp": ["Fresha", "Sesame", "Vagaro"],
        "effort": "Medium",
        "rev": "High",
        "checks": [
            {"t": "Client portal: view upcoming bookings", "d": False},
            {"t": "Reschedule: pick new date/time from available slots", "d": False},
            {"t": "Swap treatment: change service within same slot", "d": False},
            {"t": "Cancel: enforce cancellation policy window", "d": False},
            {"t": "All changes auto-notify therapist", "d": False},
        ],
    },
    {
        "name": "Product retail: favourites, purchases, sample follow-up",
        "desc": "Natalie: 'Quick reminder of what products they bought, samples given. Then you're selling that product.' Track client product purchases, sample giveaways, favourite products. Auto-follow-up on samples at next visit.",
        "cat": "Local Services",
        "pri": "P3",
        "stage": "backlog",
        "comp": ["Phorest", "Fresha"],
        "effort": "Medium",
        "rev": "Medium",
        "checks": [
            {"t": "Product catalog for retail items", "d": False},
            {"t": "Track purchases per client", "d": False},
            {"t": "Log sample given (product, date)", "d": False},
            {"t": "Auto-reminder at next visit: 'Ask about sample of X given on Y'", "d": False},
            {"t": "Favourite products on client profile", "d": False},
        ],
    },
]


async def main():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]

    now = datetime.utcnow()
    added = 0
    skipped = 0
    existing_names = set()

    # Get existing feature names to avoid duplicates
    async for doc in db.project_features.find({}, {"name": 1}):
        existing_names.add(doc["name"])

    for f in FEATURES:
        if f["name"] in existing_names:
            print(f"  SKIP (exists): {f['name']}")
            skipped += 1
            continue

        doc = {
            "name": f["name"],
            "desc": f["desc"],
            "cat": f["cat"],
            "pri": f["pri"],
            "stage": f["stage"],
            "comp": f.get("comp", []),
            "effort": f.get("effort", "Medium"),
            "rev": f.get("rev", "Medium"),
            "checks": [{"t": c["t"], "d": c["d"]} for c in f.get("checks", [])],
            "notes": [],
            "history": [{"action": "created", "stage": f["stage"], "at": now, "by": "System (journey-map)"}],
            "assignee": f.get("assignee", ""),
            "target_date": f.get("target_date", ""),
            "sort_order": 0,
            "created_at": now,
            "updated_at": now,
        }
        result = await db.project_features.insert_one(doc)
        print(f"  ADDED: {f['name']} ({f['pri']}) → {f['stage']}")
        added += 1

    # Ensure indexes exist
    await db.project_features.create_index("stage")
    await db.project_features.create_index("pri")
    await db.project_features.create_index("cat")
    await db.project_features.create_index("updated_at")
    await db.project_features.create_index([("name", "text"), ("desc", "text")])

    total = await db.project_features.count_documents({})
    p0 = await db.project_features.count_documents({"pri": "P0"})
    local_svc = await db.project_features.count_documents({"cat": "Local Services"})

    print(f"\n{'='*60}")
    print(f"  Added: {added} | Skipped: {skipped}")
    print(f"  Total features on board: {total}")
    print(f"  P0 blockers: {p0}")
    print(f"  Local Services features: {local_svc}")
    print(f"{'='*60}")


if __name__ == "__main__":
    print("\n=== Seeding Rejuvenate Journey Map → Command Centre ===\n")
    asyncio.run(main())
    print("\nDone. View at: portal.rezvo.app → Admin → Command Centre\n")
