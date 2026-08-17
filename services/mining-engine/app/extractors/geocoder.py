from typing import Optional, Tuple
import httpx
import structlog
from ..config import settings

logger = structlog.get_logger()

_cache: dict[str, Optional[Tuple[float, float]]] = {}


async def geocode(venue: Optional[str], city: Optional[str], province: Optional[str]) -> Optional[Tuple[float, float]]:
    """Returns (latitude, longitude) or None."""
    parts = [p for p in [venue, city, province, "South Africa"] if p]
    query = ", ".join(parts)

    if query in _cache:
        return _cache[query]

    result = await _nominatim_geocode(query)
    _cache[query] = result
    return result


async def _nominatim_geocode(query: str) -> Optional[Tuple[float, float]]:
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                "https://nominatim.openstreetmap.org/search",
                params={"q": query, "format": "json", "limit": 1, "countrycodes": "za"},
                headers={"User-Agent": "SANightlifeIntelBot/1.0"},
            )
            data = resp.json()
            if data:
                return float(data[0]["lat"]), float(data[0]["lon"])
    except Exception as e:
        logger.error("geocoding_error", error=str(e), query=query)
    return None
