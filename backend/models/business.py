from pydantic import BaseModel, Field, HttpUrl
from typing import Optional, List, Dict, Any
from datetime import datetime, time
from enum import Enum


class BusinessCategory(str, Enum):
    RESTAURANT = "restaurant"
    BARBER = "barber"
    SALON = "salon"
    SPA = "spa"


class PlatformTier(str, Enum):
    FREE = "free"
    PRO = "pro"
    PREMIUM = "premium"


class BusinessTier(str, Enum):
    SOLO = "solo"
    TEAM = "team"
    VENUE = "venue"


class OpeningHours(BaseModel):
    monday: Optional[Dict[str, str]] = None
    tuesday: Optional[Dict[str, str]] = None
    wednesday: Optional[Dict[str, str]] = None
    thursday: Optional[Dict[str, str]] = None
    friday: Optional[Dict[str, str]] = None
    saturday: Optional[Dict[str, str]] = None
    sunday: Optional[Dict[str, str]] = None


class BookingSettings(BaseModel):
    min_party_size: int = 1
    max_party_size: int = 10
    slot_duration_minutes: int = 15
    advance_booking_days: int = 60
    min_advance_hours: int = 2
    auto_confirm: bool = True
    require_deposit: bool = False
    deposit_amount: Optional[float] = None
    cancellation_hours: int = 24


class BusinessBase(BaseModel):
    name: str
    category: BusinessCategory
    address: str
    phone: Optional[str] = None
    website: Optional[HttpUrl] = None
    lat: float = 0.0
    lng: float = 0.0


class BusinessCreate(BusinessBase):
    location_id: Optional[str] = ""
    tier: BusinessTier = BusinessTier.SOLO
    city: Optional[str] = None
    postcode: Optional[str] = None
    email: Optional[str] = None
    opening_hours: Optional[dict] = None


class BusinessUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    website: Optional[HttpUrl] = None
    opening_hours: Optional[OpeningHours] = None
    booking_settings: Optional[BookingSettings] = None


class Business(BusinessBase):
    id: str = Field(alias="_id")
    google_place_id: Optional[str] = None
    location_id: str
    slug: str
    google_maps_url: Optional[str] = None
    rating: Optional[float] = None
    review_count: int = 0
    price_level: Optional[int] = None
    primary_type: Optional[str] = None
    all_types: List[str] = []
    editorial_summary: Optional[str] = None
    opening_hours: Optional[OpeningHours] = None
    photo_refs: List[str] = []
    
    serves_breakfast: Optional[bool] = None
    serves_brunch: Optional[bool] = None
    serves_lunch: Optional[bool] = None
    serves_dinner: Optional[bool] = None
    serves_vegetarian: Optional[bool] = None
    serves_beer: Optional[bool] = None
    serves_wine: Optional[bool] = None
    dine_in: Optional[bool] = None
    takeout: Optional[bool] = None
    delivery: Optional[bool] = None
    reservable: Optional[bool] = None
    
    claimed: bool = False
    owner_id: Optional[str] = None
    rezvo_tier: PlatformTier = PlatformTier.FREE
    tier: Optional[BusinessTier] = None
    promoted: bool = False
    notify_count: int = 0
    
    stripe_account_id: Optional[str] = None
    booking_settings: Optional[BookingSettings] = None
    floor_plan: Optional[Dict[str, Any]] = None
    staff: List[Dict[str, Any]] = []
    menu: List[Dict[str, Any]] = []
    custom_photos: List[str] = []
    
    created_at: datetime
    updated_at: datetime

    class Config:
        populate_by_name = True


class BusinessResponse(BaseModel):
    id: str
    name: str
    slug: str
    category: BusinessCategory
    address: str
    phone: Optional[str] = None
    website: Optional[HttpUrl] = None
    lat: float = 0.0
    lng: float = 0.0
    rating: Optional[float] = None
    review_count: int = 0
    price_level: Optional[int] = None
    photo_refs: List[str] = []
    claimed: bool = False
    rezvo_tier: PlatformTier = PlatformTier.FREE
    tier: Optional[str] = None
    promoted: bool = False
    opening_hours: Optional[OpeningHours] = None
    city: Optional[str] = None
    postcode: Optional[str] = None

    class Config:
        from_attributes = True
