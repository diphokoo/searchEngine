import re
from typing import Optional, List
from datetime import date, time, datetime
from dateutil import parser as dateparser
from ..models.event import ExtractedEvent, NormalizedEvent, Genre, Province


# ─── Province mapping ─────────────────────────────────────────────────────────
PROVINCE_MAP = {
    "gauteng": Province.GAUTENG, "gp": Province.GAUTENG, "jhb": Province.GAUTENG,
    "western cape": Province.WESTERN_CAPE, "wc": Province.WESTERN_CAPE, "cape town": Province.WESTERN_CAPE,
    "kwazulu-natal": Province.KWAZULU_NATAL, "kzn": Province.KWAZULU_NATAL, "durban": Province.KWAZULU_NATAL,
    "eastern cape": Province.EASTERN_CAPE, "ec": Province.EASTERN_CAPE,
    "free state": Province.FREE_STATE, "fs": Province.FREE_STATE, "bloemfontein": Province.FREE_STATE,
    "limpopo": Province.LIMPOPO, "lp": Province.LIMPOPO, "polokwane": Province.LIMPOPO,
    "mpumalanga": Province.MPUMALANGA, "mp": Province.MPUMALANGA, "mbombela": Province.MPUMALANGA,
    "north west": Province.NORTH_WEST, "nw": Province.NORTH_WEST, "rustenburg": Province.NORTH_WEST,
    "northern cape": Province.NORTHERN_CAPE, "nc": Province.NORTHERN_CAPE, "kimberley": Province.NORTHERN_CAPE,
}

CITY_PROVINCE_MAP = {
    "johannesburg": Province.GAUTENG, "pretoria": Province.GAUTENG, "soweto": Province.GAUTENG,
    "midrand": Province.GAUTENG, "centurion": Province.GAUTENG, "sandton": Province.GAUTENG,
    "cape town": Province.WESTERN_CAPE, "stellenbosch": Province.WESTERN_CAPE,
    "durban": Province.KWAZULU_NATAL, "umhlanga": Province.KWAZULU_NATAL, "ballito": Province.KWAZULU_NATAL,
    "gqeberha": Province.EASTERN_CAPE, "east london": Province.EASTERN_CAPE,
    "bloemfontein": Province.FREE_STATE,
    "polokwane": Province.LIMPOPO,
    "mbombela": Province.MPUMALANGA, "nelspruit": Province.MPUMALANGA,
    "rustenburg": Province.NORTH_WEST,
    "kimberley": Province.NORTHERN_CAPE,
}

# ─── Genre keywords ───────────────────────────────────────────────────────────
GENRE_KEYWORDS = {
    Genre.AMAPIANO: ["amapiano", "piano", "log drum"],
    Genre.GQOM: ["gqom"],
    Genre.AFROBEATS: ["afrobeats", "afrobeat"],
    Genre.AFRO_TECH: ["afro tech", "afrotech"],
    Genre.AFRO_HOUSE: ["afro house"],
    Genre.DEEP_HOUSE: ["deep house"],
    Genre.HOUSE: ["house music", "house"],
    Genre.KWAITO: ["kwaito"],
    Genre.HIP_HOP: ["hip hop", "hip-hop", "hiphop", "rap"],
    Genre.EDM: ["edm", "electronic dance"],
    Genre.TECHNO: ["techno"],
    Genre.DRUM_AND_BASS: ["drum and bass", "dnb", "drum & bass"],
    Genre.JAZZ: ["jazz"],
    Genre.GOSPEL: ["gospel"],
    Genre.REGGAE: ["reggae"],
    Genre.DANCEHALL: ["dancehall"],
    Genre.RNB: ["r&b", "rnb", "rhythm and blues"],
    Genre.SOUL: ["soul"],
    Genre.POP: ["pop"],
    Genre.ROCK: ["rock"],
}


def normalize_price(raw: Optional[str]) -> Optional[float]:
    if not raw:
        return None
    cleaned = re.sub(r"[^\d.]", "", raw.replace(",", ""))
    try:
        return float(cleaned) if cleaned else None
    except ValueError:
        return None


def normalize_date(raw: Optional[str]) -> Optional[date]:
    if not raw:
        return None
    try:
        return dateparser.parse(raw, dayfirst=True).date()
    except Exception:
        return None


def normalize_time(raw: Optional[str]) -> Optional[time]:
    if not raw:
        return None
    try:
        return dateparser.parse(raw).time()
    except Exception:
        return None


def normalize_province(city: Optional[str], province_raw: Optional[str]) -> Optional[Province]:
    if province_raw:
        key = province_raw.lower().strip()
        if key in PROVINCE_MAP:
            return PROVINCE_MAP[key]
    if city:
        key = city.lower().strip()
        if key in CITY_PROVINCE_MAP:
            return CITY_PROVINCE_MAP[key]
    return None


def extract_genres(text: str) -> List[Genre]:
    text_lower = text.lower()
    found = []
    for genre, keywords in GENRE_KEYWORDS.items():
        if any(kw in text_lower for kw in keywords):
            found.append(genre)
    return found if found else [Genre.UNKNOWN]


def normalize_event(raw: ExtractedEvent) -> NormalizedEvent:
    text = " ".join(filter(None, [raw.title, raw.description, raw.raw_text, " ".join(raw.hashtags)]))

    genres = extract_genres(text)
    if raw.genres_raw:
        for g_raw in raw.genres_raw:
            extra = extract_genres(g_raw)
            for g in extra:
                if g not in genres and g != Genre.UNKNOWN:
                    genres.append(g)
        genres = [g for g in genres if g != Genre.UNKNOWN] or [Genre.UNKNOWN]

    province = normalize_province(raw.city, raw.province)

    return NormalizedEvent(
        title=raw.title or "Untitled Event",
        description=raw.description,
        genres=genres,
        date=normalize_date(raw.raw_date),
        start_time=normalize_time(raw.raw_time),
        venue=raw.venue,
        address=raw.address,
        city=raw.city,
        province=province,
        price=normalize_price(raw.price_raw),
        ticket_url=raw.ticket_url,
        event_url=raw.event_url,
        image_url=raw.image_url,
        organiser=raw.organiser,
        artists=raw.artists,
        sources=[raw.source] if raw.source else [],
        confidence_score=int(raw.confidence * 100),
    )
