from typing import List, Optional, Tuple
from rapidfuzz import fuzz
from ..models.event import NormalizedEvent


def compute_similarity(a: NormalizedEvent, b: NormalizedEvent) -> float:
    """Returns 0.0–1.0 similarity score between two events."""
    scores = []

    # Title similarity (weighted heavily)
    if a.title and b.title:
        title_score = fuzz.token_sort_ratio(a.title.lower(), b.title.lower()) / 100
        scores.append(("title", title_score, 0.4))

    # Date match
    if a.date and b.date:
        date_score = 1.0 if a.date == b.date else 0.0
        scores.append(("date", date_score, 0.25))

    # Venue similarity
    if a.venue and b.venue:
        venue_score = fuzz.token_sort_ratio(a.venue.lower(), b.venue.lower()) / 100
        scores.append(("venue", venue_score, 0.2))

    # City match
    if a.city and b.city:
        city_score = 1.0 if a.city.lower() == b.city.lower() else 0.0
        scores.append(("city", city_score, 0.1))

    # Ticket URL exact match (strong signal)
    if a.ticket_url and b.ticket_url and a.ticket_url == b.ticket_url:
        return 1.0

    if not scores:
        return 0.0

    total_weight = sum(w for _, _, w in scores)
    weighted_sum = sum(score * weight for _, score, weight in scores)
    return weighted_sum / total_weight if total_weight > 0 else 0.0


def find_duplicates(
    candidate: NormalizedEvent,
    existing: List[NormalizedEvent],
    threshold: float = 0.85,
) -> List[Tuple[NormalizedEvent, float]]:
    """Find events in `existing` that are likely duplicates of `candidate`."""
    duplicates = []
    for event in existing:
        score = compute_similarity(candidate, event)
        if score >= threshold:
            duplicates.append((event, score))
    return sorted(duplicates, key=lambda x: x[1], reverse=True)
