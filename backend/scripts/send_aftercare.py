"""
Aftercare Email Processor
Sends queued aftercare emails 15-30 min after appointment completion.
Run: python3 backend/scripts/send_aftercare.py
Can be called by cron every 5 minutes.
"""
import asyncio
import os
import sys
from datetime import datetime
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

AFTERCARE_CONTENT = {
    "microneedling": {
        "subject": "Your Microneedling Aftercare Instructions",
        "body": """Following your microneedling treatment today, here's what to expect and how to care for your skin:

**First 24-48 hours:** Redness and mild swelling is completely normal — think of it as a light sunburn. Your skin may feel warm and tight.

**Days 3-5:** You may experience light peeling or flaking. This is your skin renewing itself.

**Do:**
• Apply SPF 50 and reapply throughout the day
• Use a gentle, fragrance-free cleanser
• Keep skin hydrated with a simple moisturiser
• Sleep on a clean pillowcase

**Don't:**
• No makeup for 48 hours
• No active products (retinol, AHAs, BHAs, vitamin C) for 7 days
• No picking or peeling skin
• No gym, saunas, or swimming for 48 hours
• No direct sun exposure for 2 weeks

If you experience anything unusual, please contact us immediately.""",
    },
    "peel": {
        "subject": "Your Chemical Peel Aftercare Instructions",
        "body": """Thank you for your chemical peel treatment today. Here's your aftercare guide:

**First 24 hours:** Mild tingling or warmth is normal. Redness may last 1-3 days.

**Days 3-7:** Peeling and flaking is expected. The degree of peeling varies by person and peel type.

**Do:**
• Apply SPF 50 daily — this is critical
• Use gentle, hydrating products only
• Drink plenty of water

**Don't:**
• No makeup on the day of treatment
• No exfoliating for 2 weeks
• No picking peeling skin — let it shed naturally
• Avoid heat (saunas, hot baths) for 24-48 hours
• No waxing or threading for 2 weeks

Your skin will look and feel amazing once the peeling process completes.""",
    },
    "rf": {
        "subject": "Your RF Needling Aftercare Instructions",
        "body": """Following your RF needling treatment, here's what to expect:

**First 24-48 hours:** Redness, warmth, and mild swelling are normal. You may notice temporary grid marks from the treatment.

**Do:**
• Keep skin hydrated
• Apply SPF 50 daily
• Drink plenty of water

**Don't:**
• No makeup for 24 hours
• No hot baths, saunas, or steam rooms for 48 hours
• Avoid intense exercise for 24 hours

Results will continue to improve over the coming weeks as collagen production increases.""",
    },
    "polynucleotides": {
        "subject": "Your Polynucleotide Treatment Aftercare",
        "body": """After your polynucleotide skin booster treatment today:

**First 24-72 hours:** Injection site redness, swelling, and mild bruising are all normal and will subside.

**Do:**
• Apply a cold compress if needed for comfort
• Keep skin clean and hydrated

**Don't:**
• No makeup for 12 hours
• No intense exercise for 24 hours
• No alcohol for 24 hours
• No saunas or steam rooms for 48 hours

The full benefits of your treatment will develop over 2-4 weeks as the polynucleotides stimulate tissue regeneration.""",
    },
    "lymphatic": {
        "subject": "Your Lymphatic Lift Aftercare",
        "body": """Thank you for your Luxury Lymphatic Lift Facial today.

Your skin may appear slightly flushed — this is a sign that circulation and lymphatic drainage have been activated.

**Do:**
• Drink plenty of water to support the detox process
• Use gentle products for the next 24 hours
• Enjoy the glow!

**Don't:**
• Avoid heavy makeup for a few hours if possible
• Avoid touching your face unnecessarily

You should notice improved skin clarity, reduced puffiness, and a healthy glow. Results are cumulative — regular treatments will deliver the best outcomes.""",
    },
    "dermaplaning": {
        "subject": "Your Dermaplaning Aftercare Instructions",
        "body": """After your dermaplaning treatment today:

Your skin will feel incredibly smooth. The removal of dead skin cells and vellus hair means your products will now absorb much better.

**Do:**
• Apply SPF 50 — your fresh skin is more sensitive to UV
• Use hydrating, gentle products
• Enjoy how smooth your makeup applies!

**Don't:**
• No exfoliating for 1 week
• No retinol or strong actives for 48 hours
• Avoid direct sun exposure

Book your next session in 3-4 weeks for best results.""",
    },
}


async def process_aftercare_queue():
    from motor.motor_asyncio import AsyncIOMotorClient
    mongo_url = os.environ.get("MONGODB_URL", "mongodb://localhost:27017")
    client = AsyncIOMotorClient(mongo_url)
    db = client.rezvo

    now = datetime.utcnow()
    # Find emails due to be sent
    queue = await db.aftercare_queue.find({
        "sent": False,
        "send_after": {"$lte": now},
    }).to_list(50)

    if not queue:
        print(f"[{now.strftime('%H:%M')}] No aftercare emails to send.")
        return

    sent_count = 0
    for item in queue:
        treatment_type = item.get("treatment_type", "")
        content = AFTERCARE_CONTENT.get(treatment_type)
        if not content:
            print(f"  No template for treatment type: {treatment_type}")
            await db.aftercare_queue.update_one({"_id": item["_id"]}, {"$set": {"sent": True, "skipped": True}})
            continue

        client_email = item.get("client_email")
        client_name = item.get("client_name", "")
        treatment_name = item.get("treatment_name", treatment_type)
        business_id = item.get("business_id")

        # Get business name for email
        biz = await db.businesses.find_one({"_id": business_id}) if business_id else None
        biz_name = (biz or {}).get("name", "Your Clinic")

        try:
            # Try Resend email
            from helpers.email import send_email
            await send_email(
                to=client_email,
                subject=content["subject"],
                body=f"Hi {client_name},\n\n{content['body']}\n\nWarm regards,\n{biz_name}",
                from_name=biz_name,
            )
            sent_count += 1
        except Exception as e:
            print(f"  Email send failed for {client_email}: {e}")

        # Mark as sent regardless (don't retry endlessly)
        await db.aftercare_queue.update_one(
            {"_id": item["_id"]},
            {"$set": {"sent": True, "sent_at": now}}
        )

        # Log for insurance documentation
        await db.aftercare_log.insert_one({
            "business_id": business_id,
            "booking_id": item.get("booking_id"),
            "client_email": client_email,
            "client_name": client_name,
            "treatment_type": treatment_type,
            "treatment_name": treatment_name,
            "sent_at": now,
            "template_subject": content["subject"],
        })

    print(f"[{now.strftime('%H:%M')}] Sent {sent_count}/{len(queue)} aftercare emails.")


if __name__ == "__main__":
    asyncio.run(process_aftercare_queue())
