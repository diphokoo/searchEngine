from typing import List, Optional
from datetime import datetime
import httpx
from bs4 import BeautifulSoup
import json
import re
from .base import BaseConnector
from ..models.event import ExtractedEvent, RawEventSource


class WebsiteConnector(BaseConnector):
    connector_id = "website"
    platform = "website"

    async def discover(self) -> List[ExtractedEvent]:
        events = []
        try:
            if not await self._robots_allowed():
                self.log.warning("robots_txt_disallowed")
                return []

            async with httpx.AsyncClient(timeout=20, follow_redirects=True) as client:
                resp = await client.get(self.source_url, headers=self._make_headers())
                if resp.status_code >= 400:
                    return []

            soup = BeautifulSoup(resp.text, "lxml")

            # Try JSON-LD structured data first
            json_ld_events = self._extract_json_ld(soup)
            if json_ld_events:
                events.extend(json_ld_events)

            # Try microdata / Open Graph as fallback
            if not events:
                og_event = self._extract_og(soup)
                if og_event:
                    events.append(og_event)

        except Exception as e:
            self.log.error("website_connector_error", error=str(e))
        return events

    def _extract_json_ld(self, soup: BeautifulSoup) -> List[ExtractedEvent]:
        events = []
        for script in soup.find_all("script", type="application/ld+json"):
            try:
                data = json.loads(script.string or "")
                items = data if isinstance(data, list) else [data]
                for item in items:
                    if item.get("@type") in ("Event", "MusicEvent", "Festival"):
                        source = RawEventSource(
                            source_id=self.source_id,
                            source_name=item.get("organizer", {}).get("name", self.source_url) if isinstance(item.get("organizer"), dict) else self.source_url,
                            source_url=item.get("url", self.source_url),
                            platform=self.platform,
                            discovered_at=datetime.utcnow(),
                        )
                        location = item.get("location", {})
                        venue = location.get("name") if isinstance(location, dict) else None
                        address_obj = location.get("address", {}) if isinstance(location, dict) else {}
                        address = address_obj.get("streetAddress") if isinstance(address_obj, dict) else None
                        city = address_obj.get("addressLocality") if isinstance(address_obj, dict) else None

                        performer = item.get("performer", [])
                        artists = []
                        if isinstance(performer, list):
                            artists = [p.get("name", "") for p in performer if isinstance(p, dict)]
                        elif isinstance(performer, dict):
                            artists = [performer.get("name", "")]

                        events.append(ExtractedEvent(
                            title=item.get("name"),
                            description=item.get("description"),
                            raw_date=item.get("startDate"),
                            raw_time=item.get("startDate"),
                            venue=venue,
                            address=address,
                            city=city,
                            ticket_url=item.get("offers", {}).get("url") if isinstance(item.get("offers"), dict) else None,
                            event_url=item.get("url"),
                            image_url=item.get("image") if isinstance(item.get("image"), str) else None,
                            organiser=item.get("organizer", {}).get("name") if isinstance(item.get("organizer"), dict) else None,
                            artists=artists,
                            source=source,
                            confidence=0.75,
                        ))
            except (json.JSONDecodeError, AttributeError):
                continue
        return events

    def _extract_og(self, soup: BeautifulSoup) -> Optional[ExtractedEvent]:
        def og(prop: str) -> Optional[str]:
            tag = soup.find("meta", property=f"og:{prop}")
            return tag["content"] if tag and tag.get("content") else None  # type: ignore

        title = og("title") or soup.title.string if soup.title else None
        if not title:
            return None

        source = RawEventSource(
            source_id=self.source_id,
            source_name=title,
            source_url=self.source_url,
            platform=self.platform,
            discovered_at=datetime.utcnow(),
        )
        return ExtractedEvent(
            title=title,
            description=og("description"),
            image_url=og("image"),
            event_url=og("url") or self.source_url,
            source=source,
            confidence=0.3,
        )

    async def _robots_allowed(self) -> bool:
        """Basic robots.txt check for the crawler path."""
        try:
            from urllib.parse import urlparse
            parsed = urlparse(self.source_url)
            robots_url = f"{parsed.scheme}://{parsed.netloc}/robots.txt"
            async with httpx.AsyncClient(timeout=5) as client:
                resp = await client.get(robots_url)
                if resp.status_code == 200:
                    # Very basic check — disallow for our user agent
                    for line in resp.text.splitlines():
                        if line.lower().startswith("disallow") and "*" in line:
                            return False
        except Exception:
            pass
        return True
