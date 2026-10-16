# Adding New Source Connectors

## Connector Types

| Type | Use case | Base class |
|---|---|---|
| `website` | Generic HTML scraping with JSON-LD / OG fallback | `WebsiteConnector` |
| `rss` | RSS / Atom feeds | `RSSConnector` |
| `ical` | iCal / .ics public calendars | Extend `BaseConnector` |
| `instagram` | Instagram Graph API (official) | Extend `BaseConnector` |
| `facebook` | Facebook Graph API (official) | Extend `BaseConnector` |
| `twitter` | Twitter/X API v2 (official) | Extend `BaseConnector` |
| `youtube` | YouTube Data API v3 | Extend `BaseConnector` |
| `ticketing` | Ticketing platform APIs | Extend `BaseConnector` |

## Implementing a Connector

```python
# services/mining-engine/app/connectors/my_connector.py

from typing import List
from datetime import datetime
from .base import BaseConnector
from ..models.event import ExtractedEvent, RawEventSource

class MyConnector(BaseConnector):
    connector_id = "my_connector"
    platform = "website"
    rate_limit_delay = 3.0  # seconds between requests

    async def discover(self) -> List[ExtractedEvent]:
        events = []
        # ... fetch and parse ...
        source = RawEventSource(
            source_id=self.source_id,
            source_name="My Source",
            source_url=self.source_url,
            platform=self.platform,
            discovered_at=datetime.utcnow(),
        )
        events.append(ExtractedEvent(
            title="Event Title",
            raw_date="2026-08-22",
            raw_time="20:00",
            venue="Venue Name",
            city="Pretoria",
            source=source,
            confidence=0.8,
        ))
        return events
```

## Registering the Connector

In `app/workers/discovery_worker.py`:
```python
from ..connectors.my_connector import MyConnector

CONNECTOR_MAP = {
    "rss": RSSConnector,
    "website": WebsiteConnector,
    "my_connector": MyConnector,   # add here
}
```

In `app/main.py`:
```python
connector_cls = {
    "rss": RSSConnector,
    "website": WebsiteConnector,
    "my_connector": MyConnector,   # add here
}.get(connector_type, WebsiteConnector)
```

## Adding the Source to the DB

```sql
INSERT INTO sources (name, url, platform, source_type, province, city, connector, status, reliability_score)
VALUES ('My Source', 'https://example.co.za', 'website', 'venue', 'Gauteng', 'Pretoria', 'my_connector', 'ACTIVE', 80);
```

## Social Platform Rules

For every social platform connector:
- Use the **official API only** — no scraping
- Store and rotate API tokens securely via environment variables
- Respect all rate limits — implement exponential backoff
- Never access private accounts or bypass authentication
- Only process publicly accessible content
