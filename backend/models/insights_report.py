"""
Business Insights Report — SEO, Google, Facebook, Online Presence audit
Used for lead generation: send restaurant owners a free audit with expiring link.
"""
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, timedelta
import secrets
import re


def slugify(text: str) -> str:
    """Convert business name to URL slug"""
    text = text.lower().strip()
    text = re.sub(r'[^\w\s-]', '', text)
    text = re.sub(r'[-\s]+', '-', text)
    return text.strip('-')


class WebsiteSEO(BaseModel):
    has_website: bool = False
    url: Optional[str] = None
    is_mobile_friendly: Optional[bool] = None
    has_ssl: Optional[bool] = None
    load_speed_score: Optional[int] = None  # 0-100
    has_meta_description: Optional[bool] = None
    has_schema_markup: Optional[bool] = None
    has_online_booking: Optional[bool] = None
    has_online_ordering: Optional[bool] = None
    issues: List[str] = []
    score: int = 0  # 0-100


class GooglePresence(BaseModel):
    has_google_profile: bool = False
    google_rating: Optional[float] = None
    google_review_count: Optional[int] = None
    google_photos_count: Optional[int] = None
    responds_to_reviews: Optional[bool] = None
    has_menu_on_google: Optional[bool] = None
    has_booking_link: Optional[bool] = None
    has_correct_hours: Optional[bool] = None
    issues: List[str] = []
    score: int = 0  # 0-100


class FacebookPresence(BaseModel):
    has_facebook_page: bool = False
    facebook_rating: Optional[float] = None
    facebook_review_count: Optional[int] = None
    last_post_days_ago: Optional[int] = None
    has_menu: Optional[bool] = None
    has_booking_button: Optional[bool] = None
    issues: List[str] = []
    score: int = 0  # 0-100


class OnlineOrdering(BaseModel):
    on_deliveroo: bool = False
    on_ubereats: bool = False
    on_justeat: bool = False
    has_own_ordering: bool = False
    estimated_monthly_orders: Optional[int] = None
    estimated_commission_lost: Optional[float] = None  # £ per month
    issues: List[str] = []
    score: int = 0  # 0-100


class CompetitorSnapshot(BaseModel):
    name: str
    google_rating: Optional[float] = None
    google_reviews: Optional[int] = None
    has_online_booking: bool = False
    has_own_ordering: bool = False


class InsightsReport(BaseModel):
    # Identity
    business_name: str
    slug: str = ""
    token: str = ""
    business_address: Optional[str] = None
    business_type: str = "restaurant"  # restaurant, salon, barber, etc.
    business_phone: Optional[str] = None
    business_email: Optional[str] = None
    google_place_id: Optional[str] = None

    # Audit sections
    website: WebsiteSEO = WebsiteSEO()
    google: GooglePresence = GooglePresence()
    facebook: FacebookPresence = FacebookPresence()
    ordering: OnlineOrdering = OnlineOrdering()

    # Competitors
    competitors: List[CompetitorSnapshot] = []

    # Overall
    overall_score: int = 0  # 0-100
    overall_grade: str = "D"  # A, B, C, D, F
    top_recommendations: List[str] = []

    # Commission savings estimate
    estimated_annual_commission_savings: Optional[float] = None

    # Meta
    created_at: datetime = Field(default_factory=datetime.utcnow)
    expires_at: datetime = Field(default_factory=lambda: datetime.utcnow() + timedelta(days=15))
    is_expired: bool = False

    # Email tracking
    emails_sent: List[str] = []  # ["initial", "10_day", "5_day", "expired"]
    last_viewed_at: Optional[datetime] = None
    view_count: int = 0

    # Lead status
    owner_email: Optional[str] = None
    owner_name: Optional[str] = None
    lead_status: str = "new"  # new, viewed, engaged, contacted, converted

    def __init__(self, **data):
        super().__init__(**data)
        if not self.slug:
            self.slug = slugify(self.business_name)
        if not self.token:
            self.token = secrets.token_urlsafe(16)

    def calculate_scores(self):
        """Calculate all section scores and overall score"""
        self._score_website()
        self._score_google()
        self._score_facebook()
        self._score_ordering()
        self._calculate_overall()
        self._generate_recommendations()

    def _score_website(self):
        w = self.website
        w.issues = []
        score = 0

        if not w.has_website:
            w.issues.append("No website found — you're invisible to customers searching online")
            w.score = 0
            return

        score += 20  # Has a website
        if w.has_ssl:
            score += 15
        else:
            w.issues.append("Website not secure (no SSL) — browsers show warnings to visitors")
        if w.is_mobile_friendly:
            score += 20
        else:
            w.issues.append("Website not mobile-friendly — 70% of restaurant searches are on mobile")
        if w.load_speed_score and w.load_speed_score > 50:
            score += 15
        else:
            w.issues.append("Website loads slowly — visitors leave after 3 seconds")
        if w.has_meta_description:
            score += 10
        else:
            w.issues.append("Missing meta description — Google can't properly display your business in search")
        if w.has_online_booking:
            score += 10
        else:
            w.issues.append("No online booking — you're losing customers who want to book instantly")
        if w.has_online_ordering:
            score += 10
        else:
            w.issues.append("No online ordering on your own website — customers default to Deliveroo/JustEat")

        w.score = min(score, 100)

    def _score_google(self):
        g = self.google
        g.issues = []
        score = 0

        if not g.has_google_profile:
            g.issues.append("No Google Business Profile — you don't appear in local search or Google Maps")
            g.score = 0
            return

        score += 20
        if g.google_rating and g.google_rating >= 4.0:
            score += 20
        elif g.google_rating and g.google_rating >= 3.5:
            score += 10
            g.issues.append(f"Google rating is {g.google_rating} — aim for 4.0+ to stand out")
        else:
            g.issues.append(f"Google rating is low ({g.google_rating}) — this puts off potential customers")

        if g.google_review_count and g.google_review_count >= 50:
            score += 15
        elif g.google_review_count and g.google_review_count >= 20:
            score += 10
            g.issues.append(f"Only {g.google_review_count} Google reviews — competitors with 50+ get more clicks")
        else:
            g.issues.append(f"Very few Google reviews ({g.google_review_count or 0}) — you need social proof")

        if g.responds_to_reviews:
            score += 10
        else:
            g.issues.append("Not responding to Google reviews — customers notice this")

        if g.has_booking_link:
            score += 15
        else:
            g.issues.append("No booking link on Google — customers have to call instead of booking instantly")

        if g.google_photos_count and g.google_photos_count >= 10:
            score += 10
        else:
            g.issues.append("Few photos on Google — listings with 10+ photos get 35% more clicks")

        if g.has_correct_hours:
            score += 10
        else:
            g.issues.append("Business hours may be incorrect on Google — customers turn up and you're closed")

        g.score = min(score, 100)

    def _score_facebook(self):
        f = self.facebook
        f.issues = []
        score = 0

        if not f.has_facebook_page:
            f.issues.append("No Facebook page — missing out on a major discovery channel")
            f.score = 0
            return

        score += 20
        if f.facebook_rating and f.facebook_rating >= 4.0:
            score += 20
        elif f.facebook_rating:
            score += 10
            f.issues.append(f"Facebook rating is {f.facebook_rating} — could be stronger")

        if f.last_post_days_ago is not None and f.last_post_days_ago <= 7:
            score += 20
        elif f.last_post_days_ago is not None and f.last_post_days_ago <= 30:
            score += 10
            f.issues.append("Haven't posted in over a week — regular content keeps you visible")
        else:
            f.issues.append("Facebook page looks inactive — last post was over a month ago")

        if f.has_booking_button:
            score += 20
        else:
            f.issues.append("No booking button on Facebook — easy customers to lose")

        if f.has_menu:
            score += 20
        else:
            f.issues.append("No menu on Facebook — customers want to see what you offer before visiting")

        f.score = min(score, 100)

    def _score_ordering(self):
        o = self.ordering
        o.issues = []
        score = 0

        platforms = sum([o.on_deliveroo, o.on_ubereats, o.on_justeat])

        if platforms > 0 and not o.has_own_ordering:
            o.issues.append(f"On {platforms} delivery platform(s) paying 25-48% commission — with no direct ordering alternative")
            if o.estimated_commission_lost:
                o.issues.append(f"Estimated £{o.estimated_commission_lost:,.0f}/month lost to commission fees")
            score += 20  # At least they're doing delivery

        if o.has_own_ordering:
            score += 40
            o.issues.append("You have your own ordering — great! But is it costing you commission?")

        if platforms == 0 and not o.has_own_ordering:
            o.issues.append("No delivery or online ordering at all — missing a growing revenue stream")
            score += 0

        # Bonus for being on platforms (visibility) but penalise for no own channel
        if platforms > 0:
            score += platforms * 10

        if o.has_own_ordering:
            score += 30

        o.score = min(score, 100)

    def _calculate_overall(self):
        scores = [
            self.website.score,
            self.google.score,
            self.facebook.score,
            self.ordering.score
        ]
        self.overall_score = round(sum(scores) / len(scores))

        if self.overall_score >= 80:
            self.overall_grade = "A"
        elif self.overall_score >= 65:
            self.overall_grade = "B"
        elif self.overall_score >= 50:
            self.overall_grade = "C"
        elif self.overall_score >= 35:
            self.overall_grade = "D"
        else:
            self.overall_grade = "F"

    def _generate_recommendations(self):
        recs = []

        if not self.website.has_online_booking:
            recs.append("Add online booking to your website — Rezvo's free plan gets you started in 5 minutes")

        if self.ordering.on_deliveroo or self.ordering.on_ubereats or self.ordering.on_justeat:
            if not self.ordering.has_own_ordering:
                savings = self.ordering.estimated_commission_lost or 500
                recs.append(f"Launch your own branded ordering page and save up to £{savings:,.0f}/month in commission")

        if not self.google.has_booking_link:
            recs.append("Add a direct booking link to your Google Business Profile")

        if self.google.google_review_count and self.google.google_review_count < 50:
            recs.append("Actively request Google reviews — businesses with 50+ reviews get significantly more traffic")

        if not self.google.responds_to_reviews:
            recs.append("Start responding to every Google review — it shows you care and boosts your ranking")

        if not self.facebook.has_booking_button:
            recs.append("Add a booking button to your Facebook page")

        if not self.website.has_website:
            recs.append("Get a website — even a simple booking page on Rezvo gives you an online presence")

        if self.website.has_website and not self.website.has_ssl:
            recs.append("Secure your website with SSL — it's often free and stops browser warnings")

        self.top_recommendations = recs[:5]  # Top 5
