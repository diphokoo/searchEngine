from typing import List
from datetime import datetime
import feedparser
import httpx
from .base import BaseConnector
from ..models.event import ExtractedEvent, RawEventSource


class RSSConnector(BaseConnector):
    connector_id = "rss"
    platform = "rss"

    async def discover(self) -> List[ExtractedEvent]:
        events = []
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                resp = await client.get(self.source_url, headers=self._make_headers())
                feed = feedparser.parse(resp.text)

            for entry in feed.entries:
                source = RawEventSource(
                    source_id=self.source_id,
                    source_name=feed.feed.get("title", self.source_url),
                    source_url=entry.get("link", self.source_url),
                    platform=self.platform,
                    discovered_at=datetime.utcnow(),
                )
                event = ExtractedEvent(
                    title=entry.get("title"),
                    description=entry.get("summary"),
                    event_url=entry.get("link"),
                    raw_date=str(entry.get("published", "")),
                    source=source,
                    raw_text=f"{entry.get('title', '')} {entry.get('summary', '')}",
                    confidence=0.4,
                )
                events.append(event)
                self.log.info("rss_event_extracted", title=event.title)
        except Exception as e:
            self.log.error("rss_connector_error", error=str(e))
        return events
