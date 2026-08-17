from typing import Tuple, List
from ..models.event import NormalizedEvent, EventStatus


def score_event(event: NormalizedEvent, source_reliability: int = 50) -> Tuple[int, List[str], EventStatus]:
    """
    Returns (confidence_score 0-100, verification_reasons, suggested_status).
    Does NOT use AI — purely deterministic rule-based scoring.
    """
    score = 0
    reasons = []

    # Title
    if event.title and len(event.title) > 3:
        score += 10
        reasons.append("Title present")

    # Date
    if event.date:
        score += 15
        reasons.append("Date confirmed")

    # Time
    if event.start_time:
        score += 5
        reasons.append("Time confirmed")

    # Venue
    if event.venue:
        score += 10
        reasons.append("Venue present")

    # City
    if event.city:
        score += 10
        reasons.append("City confirmed")

    # Province
    if event.province:
        score += 5
        reasons.append("Province confirmed")

    # Geocoded
    if event.location.latitude and event.location.longitude:
        score += 10
        reasons.append("Location geocoded")

    # Ticket URL
    if event.ticket_url:
        score += 15
        reasons.append("Ticket URL present")

    # Event URL
    if event.event_url:
        score += 5
        reasons.append("Event URL present")

    # Multiple sources
    if len(event.sources) >= 2:
        score += 10
        reasons.append("Multiple independent sources")
    elif len(event.sources) == 1:
        score += 5

    # Source reliability bonus
    reliability_bonus = int((source_reliability - 50) / 10)
    score = max(0, min(100, score + reliability_bonus))

    # Determine status
    if score >= 80:
        status = EventStatus.VERIFIED
    elif score >= 60:
        status = EventStatus.NEEDS_REVIEW
    else:
        status = EventStatus.DISCOVERED

    return score, reasons, status
