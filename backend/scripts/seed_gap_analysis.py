"""
Seed: Client Journey Gap Analysis → Project Board + Library
Run on VPS: python3 backend/scripts/seed_gap_analysis.py

Populates:
  - project_features (Command Centre) with 13 gap cards across 3 phases
  - library with gap analysis document + Natalie consultation transcript summary
"""
import asyncio
import os
import sys
from datetime import datetime

from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))


# ═══════════════════════════════════════════════════════════════
# PROJECT BOARD FEATURES (13 gaps)
# ═══════════════════════════════════════════════════════════════

GAPS = [
    # ── Phase 1: Wire It Up (half day) ──
    {
        "name": "G1: Contraindication check at booking time",
        "desc": (
            "The contraindication engine is fully built (20 conditions × 5 treatments, "
            "BLOCK/FLAG/OK matrix) but NEVER called during booking. A pregnant client can "
            "book RF needling right now and the system allows it. ~30 lines in book.py to "
            "load the client's consultation submission, call run_contraindication_check() "
            "against the booked service, and BLOCK or FLAG accordingly.\n\n"
            "From Natalie: 'Grace had a woman come in 4 weeks pregnant. She was crying. "
            "I lost £200. She knew she was pregnant before she came.'"
        ),
        "cat": "Consultation Forms",
        "pri": "P0",
        "stage": "backlog",
        "comp": ["backend"],
        "effort": "Small",
        "rev": "Critical",
        "checks": [
            {"t": "Map service names to treatment keys (microneedling, peel, rf, polynucleotides, lymphatic)", "d": False},
            {"t": "Load latest consultation submission for client email in book.py", "d": False},
            {"t": "Call run_contraindication_check() with form_data and treatment key", "d": False},
            {"t": "If BLOCK: reject booking with clear message + suggest alternatives", "d": False},
            {"t": "If FLAG: allow booking, attach flags to booking doc, notify staff", "d": False},
            {"t": "Test: pregnant client → RF needling → BLOCKED", "d": False},
            {"t": "Test: herpes history → microneedling → FLAGGED (not blocked)", "d": False},
        ],
        "assignee": "Claude",
        "target_date": "2026-03-10",
    },
    {
        "name": "G2: Aftercare emails into scheduler",
        "desc": (
            "Aftercare email processor exists (scripts/send_aftercare.py) with templates for "
            "6 treatment types. Queue gets filled when appointments complete. But the processor "
            "is never called from the scheduler — it only runs if someone manually runs the script. "
            "~10 lines to import and call it from scheduler.py every 5 minutes."
        ),
        "cat": "Notifications",
        "pri": "P0",
        "stage": "backlog",
        "comp": ["backend"],
        "effort": "Tiny",
        "rev": "High",
        "checks": [
            {"t": "Import process_aftercare_queue into scheduler.py", "d": False},
            {"t": "Add 5-minute interval check in _run_scheduler loop", "d": False},
            {"t": "Test: complete an appointment → aftercare email sent within 30 min", "d": False},
        ],
        "assignee": "Claude",
        "target_date": "2026-03-10",
    },
    {
        "name": "G3: SMS reminders alongside email reminders",
        "desc": (
            "Scheduler sends 24hr email reminders but NOT SMS. Sendly integration is fully "
            "wired and working for booking confirmations and cancellations. Just need to add "
            "a parallel send_sms() call in _send_booking_reminders(). ~15 lines."
        ),
        "cat": "Notifications",
        "pri": "P1",
        "stage": "backlog",
        "comp": ["backend"],
        "effort": "Tiny",
        "rev": "High",
        "checks": [
            {"t": "Import send_sms from helpers.sms in scheduler.py", "d": False},
            {"t": "Add SMS send alongside email in _send_booking_reminders()", "d": False},
            {"t": "Use booking_reminder_sms template from helpers/sms.py", "d": False},
            {"t": "Test: booking tomorrow → SMS reminder sent", "d": False},
        ],
        "assignee": "Claude",
        "target_date": "2026-03-10",
    },

    # ── Phase 2: Fix Client Experience (3-5 days) ──
    {
        "name": "G4: Consultation form step in booking wizard",
        "desc": (
            "When a new client without a consultation form tries to book, they hit a dead-end "
            "error: 'Please complete your consultation form.' No link, no form, they bounce.\n\n"
            "Need: instead of error, show an inline streamlined form in the booking flow. "
            "NOT the full 50-field form — just the critical medical/medication questions (~30 fields) "
            "that drive BLOCK/FLAG logic. Personal details already captured in Step 4.\n\n"
            "From Natalie: 'I don't want to lose my impulse purchase. Our purchasers come in "
            "at 2AM doom scrolling. They just want to book Saturday's facial.'"
        ),
        "cat": "Booking Flow",
        "pri": "P0",
        "stage": "backlog",
        "comp": ["frontend", "backend"],
        "effort": "Medium",
        "rev": "Critical",
        "checks": [
            {"t": "Change book.py to return {form_required: true} instead of HTTP 400", "d": False},
            {"t": "Create BookingConsultationForm.jsx (streamlined medical form)", "d": False},
            {"t": "Include: medical history (14 questions), medications (8), lifestyle (5)", "d": False},
            {"t": "Skip: personal details (already in Step 4), skin history (ask in person)", "d": False},
            {"t": "Auto-fill name/email/phone from booking details", "d": False},
            {"t": "On submit: call /consultation/public/{slug}/submit", "d": False},
            {"t": "On CLEAR: continue to booking confirmation", "d": False},
            {"t": "On BLOCKED: show alternative treatments", "d": False},
            {"t": "On FLAGGED: continue with therapist alert", "d": False},
            {"t": "Test: new client → books microneedling → form appears → completes → booking confirmed", "d": False},
        ],
        "assignee": "Claude",
        "target_date": "2026-03-14",
    },
    {
        "name": "G5: Pre-appointment 'Has anything changed?' quick-check",
        "desc": (
            "Returning clients come every 4-6 weeks. They should NOT fill the full 50-field "
            "form every time. 4 days before their appointment, they get an email/SMS with 7 "
            "critical questions. If all 'no' → logged, done. If critical 'yes' (pregnant, cold sore, "
            "Roaccutane) → auto-flag booking + notify clinic.\n\n"
            "From Natalie: 'Most of my clients are in every 4-6 weeks. It's a pain in the ass "
            "to go through a form every time.' And: 'If they've got a cold sore, we can't treat. "
            "Can certain things flag the therapist and contact the clinic?'"
        ),
        "cat": "Consultation Forms",
        "pri": "P0",
        "stage": "backlog",
        "comp": ["backend", "frontend"],
        "effort": "Medium",
        "rev": "Critical",
        "checks": [
            {"t": "Create pre-appointment check endpoint: /consultation/public/{slug}/quick-update", "d": False},
            {"t": "7 questions: pregnant, new meds, skin infection, cold sore, Roaccutane, sun exposure, other", "d": False},
            {"t": "All 'no' → log confirmation, extend form validity", "d": False},
            {"t": "Critical 'yes' → flag booking, notify staff, message client", "d": False},
            {"t": "Non-critical 'yes' → add note to booking for therapist", "d": False},
            {"t": "Add to scheduler: send 4 days before appointment", "d": False},
            {"t": "Mobile-first quick-check page (client-facing)", "d": False},
            {"t": "Test: returning client → 'nothing changed' → one tap done", "d": False},
            {"t": "Test: returning client → 'cold sore' → booking flagged, clinic notified", "d": False},
        ],
        "assignee": "Claude",
        "target_date": "2026-03-14",
    },
    {
        "name": "G6: Client-facing consent form UI (2A-2D)",
        "desc": (
            "Consent form backend is fully built — templates for Microneedling, Chemical Peel, "
            "RF Needling, Polynucleotides with blocking logic. But there's no client-facing UI. "
            "Clients need to sign on their phone before treatment (in-clinic or via link)."
        ),
        "cat": "Consultation Forms",
        "pri": "P1",
        "stage": "backlog",
        "comp": ["frontend"],
        "effort": "Medium",
        "rev": "High",
        "checks": [
            {"t": "Create ConsentForm.jsx in client portal", "d": False},
            {"t": "Load template by treatment type from /consent-templates", "d": False},
            {"t": "Render all fields: checkboxes, yes/no, date pickers, display fields", "d": False},
            {"t": "Digital signature pad component", "d": False},
            {"t": "Submit to /consultation/public/{slug}/consent/submit", "d": False},
            {"t": "Handle BLOCK responses (e.g., no patch test → cannot proceed)", "d": False},
            {"t": "Link consent form to specific booking ID", "d": False},
            {"t": "SMS/email link to consent form before appointment", "d": False},
        ],
        "assignee": "Claude",
        "target_date": "2026-03-17",
    },
    {
        "name": "G7: Therapist override for FLAGS with audit trail",
        "desc": (
            "When a consultation form returns 'flagged', therapists can mark it as 'reviewed' "
            "but cannot override a BLOCK with a reason. Need: override button with mandatory "
            "reason field. Decision logged with therapist name, timestamp, reason for insurance."
        ),
        "cat": "Consultation Forms",
        "pri": "P1",
        "stage": "backlog",
        "comp": ["backend", "frontend"],
        "effort": "Small",
        "rev": "High",
        "checks": [
            {"t": "Add override endpoint: POST /consultation/business/{id}/submissions/{id}/override", "d": False},
            {"t": "Require: override_reason, therapist_name", "d": False},
            {"t": "Log to medical_audit: event_type='flag_overridden'", "d": False},
            {"t": "Update submission status: 'flagged' → 'cleared_with_override'", "d": False},
            {"t": "Dashboard UI: override button + reason textarea on flagged submissions", "d": False},
            {"t": "Show override history on submission detail view", "d": False},
        ],
        "assignee": "Claude",
        "target_date": "2026-03-14",
    },
    {
        "name": "G8: Staff notification on new form submission",
        "desc": (
            "When a client submits a consultation form (especially before a consultation call), "
            "the therapist/owner needs to be notified via email and optionally SMS. Currently "
            "submissions only show on the dashboard — staff have to manually check."
        ),
        "cat": "Notifications",
        "pri": "P2",
        "stage": "backlog",
        "comp": ["backend"],
        "effort": "Small",
        "rev": "Medium",
        "checks": [
            {"t": "After form submission in consultation.py, trigger staff notification", "d": False},
            {"t": "Email to business owner with summary: name, status, key flags", "d": False},
            {"t": "Optional SMS notification (business setting toggle)", "d": False},
            {"t": "Include link to submission detail in admin portal", "d": False},
        ],
        "assignee": "Claude",
        "target_date": "2026-03-17",
    },

    # ── Phase 3: Professional Operations (1-2 weeks) ──
    {
        "name": "G9: Package tracking on calendar/booking pop-out",
        "desc": (
            "Natalie's most-asked daily question: 'How many more appointments have I got left "
            "in my package?' Currently requires counting through the diary manually. Need: "
            "package progress visible on calendar booking pop-out — '4 of 6 sessions' with "
            "progress bar.\n\n"
            "From Natalie: 'To get that information yesterday I had to go through the diary "
            "and count when they'd been in. That's ridiculous.'"
        ),
        "cat": "Calendar",
        "pri": "P1",
        "stage": "backlog",
        "comp": ["backend", "frontend"],
        "effort": "Medium",
        "rev": "High",
        "checks": [
            {"t": "Package data model: package_id, total_sessions, sessions_used, treatment_type", "d": False},
            {"t": "Link bookings to packages", "d": False},
            {"t": "API: GET /packages/client/{id} → package progress", "d": False},
            {"t": "Calendar pop-out: show package name + progress bar + 'X of Y sessions'", "d": False},
            {"t": "Client portal: show package progress", "d": False},
        ],
        "assignee": "Claude",
        "target_date": "2026-03-21",
    },
    {
        "name": "G10: Dashboard booking creation checks contras",
        "desc": (
            "When staff create a booking from the dashboard, it bypasses all contraindication "
            "checks — only the public booking API (book.py) does them. Staff could accidentally "
            "book a blocked treatment for a client."
        ),
        "cat": "Consultation Forms",
        "pri": "P2",
        "stage": "backlog",
        "comp": ["backend", "frontend"],
        "effort": "Small",
        "rev": "Medium",
        "checks": [
            {"t": "Add contra check to dashboard booking creation route", "d": False},
            {"t": "Show warning modal to staff if FLAGS exist", "d": False},
            {"t": "Block booking if BLOCK exists (with override option for admins)", "d": False},
        ],
        "assignee": "Claude",
        "target_date": "2026-03-21",
    },
    {
        "name": "G11: Patch test auto-scheduling",
        "desc": (
            "First-time microneedling/chemical peel clients need a 15-min patch test 48hrs "
            "before their treatment. System should auto-schedule this when the treatment is "
            "booked and block check-in if patch test not completed."
        ),
        "cat": "Booking Flow",
        "pri": "P2",
        "stage": "backlog",
        "comp": ["backend"],
        "effort": "Medium",
        "rev": "Medium",
        "checks": [
            {"t": "Detect first-time microneedling/peel booking", "d": False},
            {"t": "Auto-create 15-min patch test appointment 48hrs before", "d": False},
            {"t": "Patch test = free, no charge", "d": False},
            {"t": "If patch test not completed: treatment status = 'Pending Patch Test'", "d": False},
            {"t": "Block check-in until patch test done", "d": False},
        ],
        "assignee": "Claude",
        "target_date": "2026-03-24",
    },
    {
        "name": "G12: Last-minute cancellation notifications to opted-in clients",
        "desc": (
            "When a client cancels, opted-in members get notified of the availability. "
            "First come, first served.\n\n"
            "From Natalie: 'I hate posting on social media last-minute availabilities. "
            "What would be nice is there's like a members club — they were notified of cancellations.'"
        ),
        "cat": "Notifications",
        "pri": "P2",
        "stage": "backlog",
        "comp": ["backend", "frontend"],
        "effort": "Medium",
        "rev": "Medium",
        "checks": [
            {"t": "Client portal toggle: 'Notify me of last-minute availability'", "d": False},
            {"t": "On cancellation: find opted-in clients", "d": False},
            {"t": "Send SMS/email: 'Appointment available [date] [time] — book now'", "d": False},
            {"t": "First-come-first-served: link to booking page with slot pre-selected", "d": False},
        ],
        "assignee": "Claude",
        "target_date": "2026-03-24",
    },
    {
        "name": "G13: Verify service swap on existing booking",
        "desc": (
            "Built in previous session — one-click swap without cancel/rebook. "
            "Verify it works end-to-end for services businesses.\n\n"
            "From Natalie: 'If somebody messages and says can I swap the microneedling to "
            "the lymphatic, we can't go onto that booked space and swap it. We have to cancel "
            "and rebook.'"
        ),
        "cat": "Calendar",
        "pri": "P2",
        "stage": "backlog",
        "comp": ["frontend"],
        "effort": "Small",
        "rev": "Medium",
        "checks": [
            {"t": "Test service swap from calendar pop-out (services business type)", "d": False},
            {"t": "Verify duration adjusts when swapping services with different durations", "d": False},
            {"t": "Verify client notification sent on swap", "d": False},
        ],
        "assignee": "Claude",
        "target_date": "2026-03-17",
    },
]


# ═══════════════════════════════════════════════════════════════
# LIBRARY DOCUMENTS
# ═══════════════════════════════════════════════════════════════

LIBRARY_DOCS = [
    {
        "title": "Client Journey Gap Analysis — Rejuvenate (March 2026)",
        "category": "specification",
        "tags": [
            "booking-flow", "crm", "notifications", "reeve",
            "consultation-forms", "contraindication", "gap-analysis",
            "rejuvenate", "natalie",
        ],
        "content": (
            "# Client Journey Gap Analysis & Build Plan\n\n"
            "Based on Natalie (Rejuvenate Skin Experts) consultation call, 7 March 2026.\n\n"
            "## Three Client Flows Mapped\n\n"
            "### Flow 1: Social Media → Impulse Buyer\n"
            "Client sees Instagram reel at 2AM, wants Saturday's facial. Current system: dead-end "
            "error if no consultation form. Required: streamlined inline form in booking wizard.\n\n"
            "### Flow 2: Website → Researcher\n"
            "Client researches, wants virtual consultation first. Natalie needs medical data BEFORE "
            "the sales call so she doesn't pitch blocked treatments.\n\n"
            "### Flow 3: In-Shop → Walk-In / Returning\n"
            "Walk-in: staff SMS form link, client fills on phone. Returning (every 4-6 weeks): "
            "'Has anything changed?' quick-check, NOT the full 50-field form.\n\n"
            "## 13 Gaps Identified\n\n"
            "Phase 1 (half day): G1 contra check at booking, G2 aftercare into scheduler, G3 SMS reminders\n"
            "Phase 2 (3-5 days): G4 form in booking wizard, G5 pre-appointment quick-check, "
            "G6 consent form UI, G7 therapist override, G8 staff notifications\n"
            "Phase 3 (1-2 weeks): G9 package tracking, G10 dashboard contra checks, "
            "G11 patch test scheduling, G12 cancellation notifications, G13 service swap verify\n\n"
            "## Key Insight\n"
            "The contraindication engine is FULLY BUILT (20 conditions × 5 treatments, BLOCK/FLAG/OK). "
            "It just isn't called at booking time. This is the competitive moat — no other platform has it. "
            "~30 lines to wire it up.\n\n"
            "Full document: /docs/ReeveOS-Client-Journey-Gap-Analysis.docx"
        ),
        "status": "current",
        "source": "claude-session",
        "metadata": {
            "session_date": "2026-03-07",
            "flows_mapped": 3,
            "gaps_identified": 13,
            "phases": 3,
            "docx_path": "docs/ReeveOS-Client-Journey-Gap-Analysis.docx",
            "related_spec": "ReeveOS-Consultation-Form-Spec.docx",
        },
    },
    {
        "title": "Natalie Call Transcript — Rejuvenate Consultation (7 Mar 2026)",
        "category": "meeting-note",
        "tags": [
            "rejuvenate", "natalie", "booking-flow", "crm",
            "consultation-forms", "packages", "marketing",
            "client-journey", "sales-process",
        ],
        "content": (
            "# Natalie Call — Key Decisions & Requirements\n\n"
            "Meeting: Ambassador + Grant Woods + Natalie (Rejuvenate Skin Experts, Barry, Wales)\n"
            "Date: 7 March 2026, 10AM\n\n"
            "## Critical Business Rules\n\n"
            "1. ANNUAL form, not every visit. Clients come every 4-6 weeks. Full 50-field form done once. "
            "Before each appointment: 'Has anything changed?' quick-check.\n\n"
            "2. DON'T block impulse buyers. 2AM doom scrollers see a reel, want to book Saturday's facial. "
            "Form wall = lost sale. Consultation should be ENCOURAGED but not REQUIRED for first booking.\n\n"
            "3. First appointment = +15 min automatically for quick in-person consultation.\n\n"
            "4. Consultation informs the sales pitch. Natalie needs medical data BEFORE video call "
            "so she pitches the right treatment (not microneedling to someone with autoimmune).\n\n"
            "5. 'Treat clients like they're stupid. Tell them as many times as you can.'\n\n"
            "## Pricing & Packages\n\n"
            "- Skin Commitment Package: 6 sessions (microneedling, lymphatic, peels all same price/time). "
            "Bespoke as you go — 'you might have 3 microneedling then we change.'\n"
            "- RF package: separate, more expensive, elite anti-aging.\n"
            "- AI Skin Scanner: £80 consultation, £40 redeemable against treatment.\n"
            "- Package clients get 10% off products.\n"
            "- Most common question: 'How many more sessions in my package?' (currently requires counting diary).\n\n"
            "## Client Types (Color-Coded Marketing)\n\n"
            "- BLUE: impulse/fun buyers — see story, click, book\n"
            "- RED: facts/figures buyers — need data, improvement percentages\n"
            "- YELLOW: emotional/relatable buyers — feel seen, deserve this for themselves\n"
            "- Each week's marketing targets all three types.\n\n"
            "## Operational Pain Points (Current System: Sesame)\n\n"
            "- Can't swap service on booking without cancel/rebook\n"
            "- Can't access booking system on phones anymore\n"
            "- Only 1 iPad in clinic between staff\n"
            "- Gaps in diary look 'fully booked' but could fit appointments with 15-min shuffle\n"
            "- Losing 10-20K/year in lost bookable time\n"
            "- Virtual call follow-up is manual: WhatsApp, diary, text. Needs to be automated and look professional.\n\n"
            "## Features Requested\n\n"
            "- Client portal with packages, progress, personalized messages\n"
            "- Video consultation integration (Google Meet embed)\n"
            "- AI chatbot on website directing to virtual calls\n"
            "- Cancellation alerts to opted-in members (not social media)\n"
            "- Therapist notes visible on booking pop-out (preferences, family details, product samples)\n"
            "- Auto-generated landing pages for seasonal promotions (Valentine's, Mother's Day, etc.)\n"
            "- Members/gold tier: free event tickets, 10% products, community education\n"
            "- Academy training angle: Natalie training others, recommending the booking system\n\n"
            "## Next Steps\n\n"
            "- End of next week: give Natalie login to walk through\n"
            "- Add fake bookings/customers for demo\n"
            "- 5-10 full customer journey test runs\n"
            "- Natalie NOT focused on reselling — wants system working first, academy later\n"
            "- Her friend Jen (Japanese head spa across the road) also interested"
        ),
        "status": "current",
        "source": "meeting-transcript",
        "metadata": {
            "meeting_date": "2026-03-07",
            "attendees": ["Ambassador", "Grant Woods", "Natalie (Rejuvenate)"],
            "duration_approx": "60-90 min",
            "business": "Rejuvenate Skin Experts",
            "location": "Barry, Wales",
            "recording": True,
        },
    },
]


async def seed():
    from motor.motor_asyncio import AsyncIOMotorClient

    mongo_url = os.environ.get("MONGODB_URL", "mongodb://localhost:27017")
    client = AsyncIOMotorClient(mongo_url)
    db = client.rezvo

    now = datetime.utcnow()
    print("=" * 60)
    print("SEEDING: Client Journey Gap Analysis")
    print("=" * 60)

    # ── Project Board Features ──
    print("\n── Project Board (Command Centre) ──")

    # Check for existing gap features to avoid duplicates
    existing = await db.project_features.count_documents({"name": {"$regex": "^G\\d+:"}})
    if existing > 0:
        print(f"  Found {existing} existing gap features. Removing duplicates first...")
        await db.project_features.delete_many({"name": {"$regex": "^G\\d+:"}})

    inserted_features = 0
    for gap in GAPS:
        doc = {
            "name": gap["name"],
            "desc": gap["desc"],
            "cat": gap["cat"],
            "pri": gap["pri"],
            "stage": gap["stage"],
            "comp": gap["comp"],
            "effort": gap["effort"],
            "rev": gap["rev"],
            "checks": gap["checks"],
            "notes": [],
            "history": [{"action": "created", "stage": gap["stage"], "at": now, "by": "Claude"}],
            "assignee": gap["assignee"],
            "target_date": gap["target_date"],
            "created_at": now,
            "updated_at": now,
        }
        result = await db.project_features.insert_one(doc)
        phase = "Phase 1" if gap["pri"] == "P0" and gap["effort"] in ("Small", "Tiny") else "Phase 2" if gap["pri"] in ("P0", "P1") else "Phase 3"
        print(f"  + {gap['name']} [{gap['pri']}] [{phase}]")
        inserted_features += 1

    print(f"\n  Inserted {inserted_features} feature cards.")

    # ── Library Documents ──
    print("\n── Library (Knowledge Base) ──")

    for lib_doc in LIBRARY_DOCS:
        # Check for existing by title
        existing_doc = await db.library.find_one({"title": lib_doc["title"]})
        if existing_doc:
            await db.library.delete_one({"_id": existing_doc["_id"]})
            print(f"  ~ Replaced: {lib_doc['title']}")
        else:
            print(f"  + Created: {lib_doc['title']}")

        doc = {
            **lib_doc,
            "related_ids": [],
            "created_at": now,
            "updated_at": now,
        }
        await db.library.insert_one(doc)

    print(f"\n  Inserted {len(LIBRARY_DOCS)} library documents.")

    # ── Summary ──
    total_features = await db.project_features.count_documents({})
    total_library = await db.library.count_documents({})

    print("\n" + "=" * 60)
    print(f"DONE. Project board: {total_features} features. Library: {total_library} documents.")
    print("=" * 60)
    print("\nView at:")
    print("  Project Board → https://portal.rezvo.app/admin/command-centre")
    print("  Library       → https://portal.rezvo.app/admin/library")

    client.close()


if __name__ == "__main__":
    asyncio.run(seed())
