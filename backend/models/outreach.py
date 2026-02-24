"""
Rezvo Outreach Engine — MongoDB Models
=======================================
Collection schemas for cold email outreach system.
Six collections: domains, accounts, campaigns, sends, replies, warmup_log
"""
from pydantic import BaseModel, Field, EmailStr
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum


# ═══ Enums ═══

class DomainStatus(str, Enum):
    warming = "warming"
    active = "active"
    paused = "paused"
    blacklisted = "blacklisted"

class AccountStatus(str, Enum):
    warming = "warming"
    active = "active"
    paused = "paused"
    disabled = "disabled"

class CampaignStatus(str, Enum):
    draft = "draft"
    warming = "warming"
    active = "active"
    paused = "paused"
    complete = "complete"
    archived = "archived"

class SendStatus(str, Enum):
    queued = "queued"
    sent = "sent"
    delivered = "delivered"
    opened = "opened"
    clicked = "clicked"
    replied = "replied"
    bounced = "bounced"
    complained = "complained"
    failed = "failed"

class ReplyClassification(str, Enum):
    interested = "interested"
    question = "question"
    not_interested = "not_interested"
    out_of_office = "out_of_office"
    unsubscribe = "unsubscribe"
    bounce = "bounce"
    unknown = "unknown"

class OutreachAngle(str, Enum):
    commission_pain = "commission_pain"
    booking_friction = "booking_friction"
    epos_upgrade = "epos_upgrade"
    visibility_gap = "visibility_gap"


# ═══ Domain ═══

class OutreachDomain(BaseModel):
    """
    Collection: outreach_domains
    One doc per purchased outreach domain.
    """
    domain: str                                     # e.g. "getrezvo.co.uk"
    status: DomainStatus = DomainStatus.warming
    provider: str = "resend"                        # email provider
    resend_domain_id: Optional[str] = None          # Resend domain ID after verification

    # DNS verification
    spf_verified: bool = False
    dkim_verified: bool = False
    dmarc_verified: bool = False
    dmarc_policy: str = "none"                      # none, quarantine, reject

    # Warmup state
    warmup_started_at: Optional[datetime] = None
    warmup_day: int = 0
    warmup_complete: bool = False

    # Health metrics (rolling 7-day)
    health_score: int = 50                          # 0-100
    delivery_rate: float = 0.0
    bounce_rate: float = 0.0
    spam_rate: float = 0.0
    open_rate: float = 0.0

    # Capacity
    daily_limit: int = 0                            # Current daily limit (grows during warmup)
    max_daily_limit: int = 150                      # Target daily limit (30/account * 5 accounts)
    sent_today: int = 0
    last_sent_reset: Optional[datetime] = None

    registered_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


# ═══ Sending Account ═══

class OutreachAccount(BaseModel):
    """
    Collection: outreach_accounts
    Individual email identity under a domain. 5 per domain.
    """
    email: str                                      # e.g. "alex@getrezvo.co.uk"
    domain: str                                     # parent domain
    display_name: str = ""                          # e.g. "Alex from Rezvo"
    resend_api_key: Optional[str] = None            # Per-domain Resend key

    status: AccountStatus = AccountStatus.warming
    persona: str = "founder"                        # founder, team, hello, support, growth

    # Health
    health_score: int = 50
    delivery_rate: float = 0.0
    bounce_rate: float = 0.0
    spam_rate: float = 0.0

    # Daily limits
    daily_limit: int = 2                            # Starts at 2, grows to 30
    sent_today: int = 0
    last_sent_reset: Optional[datetime] = None

    # Warmup
    warmup_day: int = 0
    warmup_complete: bool = False

    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


# ═══ Campaign ═══

class CampaignStep(BaseModel):
    step_number: int = 1
    template_id: Optional[str] = None
    subject: str = ""
    body: str = ""
    delay_days: int = 0                             # 0 for first step, 3-7 for follow-ups
    variant: str = "A"                              # A/B testing

class CampaignSchedule(BaseModel):
    send_days: List[int] = [1, 2, 3]               # 0=Mon, 4=Fri
    window_start_hour: int = 10                     # 10:00
    window_end_hour: int = 15                       # 15:00
    timezone: str = "Europe/London"
    max_sends_per_day: int = 50

class OutreachCampaign(BaseModel):
    """
    Collection: outreach_campaigns
    A campaign targeting a segment with a multi-step sequence.
    """
    name: str
    status: CampaignStatus = CampaignStatus.draft

    # Targeting
    city: str = "Nottingham"
    cuisine: Optional[str] = None                   # None = all cuisines
    angle: OutreachAngle = OutreachAngle.commission_pain
    lead_source: str = "google_places"              # google_places, manual, import

    # Sequence
    steps: List[CampaignStep] = []
    schedule: CampaignSchedule = Field(default_factory=CampaignSchedule)

    # AI Personalisation
    ai_personalisation: bool = True
    personalisation_model: str = "claude-haiku-4-5-20251001"

    # Sender assignment
    assigned_domains: List[str] = []                # Which domains to use
    sender_rotation: str = "round_robin"            # round_robin, random, weighted

    # Leads
    total_leads: int = 0
    leads_contacted: int = 0
    leads_remaining: int = 0

    # Stats (updated in real-time)
    total_sent: int = 0
    total_delivered: int = 0
    total_opened: int = 0
    total_clicked: int = 0
    total_replied: int = 0
    total_bounced: int = 0
    total_interested: int = 0

    # Derived
    open_rate: float = 0.0
    reply_rate: float = 0.0
    bounce_rate: float = 0.0

    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


# ═══ Individual Send ═══

class OutreachSend(BaseModel):
    """
    Collection: outreach_sends
    Every individual email sent. Links campaign → lead → account.
    """
    campaign_id: str
    lead_id: str                                    # From sales_leads collection
    account_email: str                              # Sending account
    domain: str

    # Email content (after personalisation)
    to_email: str
    to_name: str = ""
    restaurant_name: str = ""
    subject: str
    body_html: str = ""
    body_text: str = ""

    step_number: int = 1
    variant: str = "A"

    # Status tracking
    status: SendStatus = SendStatus.queued
    resend_message_id: Optional[str] = None         # Resend API message ID

    # Event timestamps
    queued_at: datetime = Field(default_factory=datetime.utcnow)
    sent_at: Optional[datetime] = None
    delivered_at: Optional[datetime] = None
    opened_at: Optional[datetime] = None
    clicked_at: Optional[datetime] = None
    replied_at: Optional[datetime] = None
    bounced_at: Optional[datetime] = None

    # Personalisation metadata
    personalisation_tokens_used: int = 0
    personalisation_data: Dict[str, Any] = {}       # What data was used

    created_at: datetime = Field(default_factory=datetime.utcnow)


# ═══ Reply ═══

class OutreachReply(BaseModel):
    """
    Collection: outreach_replies
    Inbound replies to outreach emails.
    """
    send_id: str                                    # Links to outreach_sends
    campaign_id: str
    lead_id: str

    from_email: str
    from_name: str = ""
    restaurant_name: str = ""
    subject: str = ""
    body_text: str = ""
    body_html: str = ""

    # AI classification
    classification: ReplyClassification = ReplyClassification.unknown
    classification_confidence: float = 0.0
    classification_reasoning: str = ""

    # Reply handling
    is_read: bool = False
    is_actioned: bool = False
    our_reply: Optional[str] = None                 # Our response if sent
    our_reply_sent_at: Optional[datetime] = None
    moved_to_pipeline: bool = False                 # Promoted to sales_leads pipeline

    received_at: datetime = Field(default_factory=datetime.utcnow)
    created_at: datetime = Field(default_factory=datetime.utcnow)


# ═══ Warmup Log ═══

class WarmupLogEntry(BaseModel):
    """
    Collection: outreach_warmup_log
    Daily log of warmup activity per account.
    """
    account_email: str
    domain: str
    day_number: int
    date: datetime

    emails_sent: int = 0
    emails_received: int = 0                        # Warmup replies received
    opens: int = 0
    replies: int = 0

    target_sends: int = 0                           # What we aimed for
    actual_sends: int = 0                           # What we achieved

    # Health on this day
    delivery_rate: float = 1.0
    open_rate: float = 1.0
    reply_rate: float = 0.85

    created_at: datetime = Field(default_factory=datetime.utcnow)


# ═══ Email Template ═══

class OutreachTemplate(BaseModel):
    """
    Collection: outreach_templates
    Reusable email templates with variable placeholders.
    """
    name: str
    category: str = "cold_outreach"                 # cold_outreach, follow_up, newsletter, re_engagement
    angle: Optional[OutreachAngle] = None
    step_number: int = 1                            # Which step this template is for

    subject: str
    body_html: str = ""
    body_text: str = ""

    # Variables used
    variables: List[str] = []                       # e.g. ["restaurant_name", "first_name", "city"]

    # Performance stats
    times_used: int = 0
    total_opens: int = 0
    total_replies: int = 0
    open_rate: float = 0.0
    reply_rate: float = 0.0

    # A/B testing
    is_variant: bool = False
    variant_of: Optional[str] = None                # Template ID of the original

    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


# ═══ Index Definitions ═══

OUTREACH_INDEXES = {
    "outreach_domains": [
        {"keys": [("domain", 1)], "unique": True},
        {"keys": [("status", 1)]},
    ],
    "outreach_accounts": [
        {"keys": [("email", 1)], "unique": True},
        {"keys": [("domain", 1)]},
        {"keys": [("status", 1)]},
    ],
    "outreach_campaigns": [
        {"keys": [("status", 1)]},
        {"keys": [("city", 1), ("cuisine", 1)]},
        {"keys": [("created_at", -1)]},
    ],
    "outreach_sends": [
        {"keys": [("campaign_id", 1), ("step_number", 1)]},
        {"keys": [("lead_id", 1)]},
        {"keys": [("status", 1)]},
        {"keys": [("resend_message_id", 1)]},
        {"keys": [("account_email", 1), ("created_at", -1)]},
        {"keys": [("queued_at", 1)]},
    ],
    "outreach_replies": [
        {"keys": [("campaign_id", 1)]},
        {"keys": [("classification", 1)]},
        {"keys": [("is_read", 1)]},
        {"keys": [("received_at", -1)]},
    ],
    "outreach_warmup_log": [
        {"keys": [("account_email", 1), ("date", -1)]},
        {"keys": [("domain", 1), ("day_number", 1)]},
    ],
    "outreach_templates": [
        {"keys": [("angle", 1), ("step_number", 1)]},
        {"keys": [("category", 1)]},
    ],
}
