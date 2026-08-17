from abc import ABC, abstractmethod
from typing import List, Optional
import httpx
import structlog
from ..models.event import ExtractedEvent

logger = structlog.get_logger()


class BaseConnector(ABC):
    """All source connectors must extend this class."""

    connector_id: str = "base"
    platform: str = "website"
    rate_limit_delay: float = 2.0  # seconds between requests

    def __init__(self, source_id: str, source_url: str, config: dict = {}):
        self.source_id = source_id
        self.source_url = source_url
        self.config = config
        self.log = logger.bind(connector=self.connector_id, source_id=source_id)

    @abstractmethod
    async def discover(self) -> List[ExtractedEvent]:
        """Discover and extract events from this source."""
        ...

    async def test(self) -> dict:
        """Test connectivity to the source. Returns status dict."""
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.get(self.source_url)
                return {"ok": resp.status_code < 400, "status_code": resp.status_code}
        except Exception as e:
            return {"ok": False, "error": str(e)}

    def _make_headers(self) -> dict:
        return {
            "User-Agent": "SANightlifeIntelBot/1.0 (+https://example.com/bot)",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        }
