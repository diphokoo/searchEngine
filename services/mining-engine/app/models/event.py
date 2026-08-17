from pydantic import BaseModel, HttpUrl
from typing import Optional, List
from datetime import datetime, date, time
from enum import Enum


class EventStatus(str, Enum):
    DISCOVERED = "DISCOVERED"
    PROCESSING = "PROCESSING"
    NEEDS_REVIEW = "NEEDS_REVIEW"
    VERIFIED = "VERIFIED"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    CANCELLED = "CANCELLED"
    EXPIRED = "EXPIRED"


class Genre(str, Enum):
    AMAPIANO = "Amapiano"
    HIP_HOP = "Hip-Hop"
    HOUSE = "House"
    DEEP_HOUSE = "Deep House"
    AFRO_HOUSE = "Afro House"
    GQOM = "Gqom"
    AFROBEATS = "Afrobeats"
    AFRO_TECH = "Afro-Tech"
    KWAITO = "Kwaito"
    EDM = "EDM"
    TECHNO = "Techno"
    DRUM_AND_BASS = "Drum & Bass"
    SOUL = "Soul"
    RNB = "R&B"
    JAZZ = "Jazz"
    GOSPEL = "Gospel"
    REGGAE = "Reggae"
    DANCEHALL = "Dancehall"
    POP = "Pop"
    ROCK = "Rock"
    ALTERNATIVE = "Alternative"
    MIXED = "Mixed"
    UNKNOWN = "Unknown"


class Province(str, Enum):
    GAUTENG = "Gauteng"
    WESTERN_CAPE = "Western Cape"
    KWAZULU_NATAL = "KwaZulu-Natal"
    EASTERN_CAPE = "Eastern Cape"
    FREE_STATE = "Free State"
    LIMPOPO = "Limpopo"
    MPUMALANGA = "Mpumalanga"
    NORTH_WEST = "North West"
    NORTHERN_CAPE = "Northern Cape"


class EventLocation(BaseModel):
    latitude: Optional[float] = None
    longitude: Optional[float] = None


class RawEventSource(BaseModel):
    source_id: str
    source_name: str
    source_url: str
    platform: str
    discovered_at: datetime


class ExtractedEvent(BaseModel):
    """Raw event data extracted from a source before normalization."""
    title: Optional[str] = None
    description: Optional[str] = None
    raw_date: Optional[str] = None
    raw_time: Optional[str] = None
    venue: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    province: Optional[str] = None
    price_raw: Optional[str] = None
    ticket_url: Optional[str] = None
    event_url: Optional[str] = None
    image_url: Optional[str] = None
    organiser: Optional[str] = None
    artists: List[str] = []
    genres_raw: List[str] = []
    hashtags: List[str] = []
    source: Optional[RawEventSource] = None
    raw_text: Optional[str] = None
    confidence: float = 0.0


class NormalizedEvent(BaseModel):
    """Fully normalized event ready for DB insertion."""
    title: str
    description: Optional[str] = None
    category: Optional[str] = None
    genres: List[Genre] = []
    event_type: Optional[str] = None
    date: Optional[date] = None
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    venue: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    province: Optional[Province] = None
    country: str = "South Africa"
    location: EventLocation = EventLocation()
    price: Optional[float] = None
    currency: str = "ZAR"
    ticket_url: Optional[str] = None
    event_url: Optional[str] = None
    image_url: Optional[str] = None
    organiser: Optional[str] = None
    artists: List[str] = []
    age_restriction: Optional[str] = None
    sources: List[RawEventSource] = []
    confidence_score: int = 0
    verification_reasons: List[str] = []
    status: EventStatus = EventStatus.DISCOVERED
