from fastapi import FastAPI, HTTPException, Header, Depends
from fastapi.middleware.cors import CORSMiddleware
from .config import settings
from .connectors.rss_connector import RSSConnector
from .connectors.website_connector import WebsiteConnector
from .extractors.normalizer import normalize_event
from .extractors.geocoder import geocode
from .extractors.scorer import score_event
from .extractors.ocr import extract_from_image_url
from .models.event import ExtractedEvent

app = FastAPI(title=settings.app_name, version="1.0.0")

app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


def verify_api_key(x_api_key: str = Header(...)):
    if x_api_key != settings.api_key:
        raise HTTPException(status_code=401, detail="Invalid API key")
    return x_api_key


@app.get("/health")
async def health():
    return {"status": "ok", "service": settings.app_name}


@app.post("/extract/url", dependencies=[Depends(verify_api_key)])
async def extract_from_url(payload: dict):
    url = payload.get("url")
    source_id = payload.get("sourceId", "manual")
    connector_type = payload.get("connectorType", "website")
    if not url:
        raise HTTPException(status_code=400, detail="url required")

    connector_cls = {"rss": RSSConnector, "website": WebsiteConnector}.get(connector_type, WebsiteConnector)
    connector = connector_cls(source_id=source_id, source_url=url)
    raw_events = await connector.discover()

    normalized = []
    for raw in raw_events:
        n = normalize_event(raw)
        coords = await geocode(n.venue, n.city, n.province.value if n.province else None)
        if coords:
            n.location.latitude, n.location.longitude = coords
        score, reasons, status = score_event(n)
        n.confidence_score = score
        n.verification_reasons = reasons
        n.status = status
        normalized.append(n)

    return {"extracted": len(normalized), "events": [e.model_dump(mode="json") for e in normalized]}


@app.post("/extract/image", dependencies=[Depends(verify_api_key)])
async def extract_from_image(payload: dict):
    image_url = payload.get("imageUrl")
    source_id = payload.get("sourceId", "manual")
    if not image_url:
        raise HTTPException(status_code=400, detail="imageUrl required")

    event = await extract_from_image_url(image_url, source_id)
    if not event:
        raise HTTPException(status_code=422, detail="Could not extract event from image")

    normalized = normalize_event(event)
    return normalized.model_dump(mode="json")


@app.post("/normalize", dependencies=[Depends(verify_api_key)])
async def normalize(raw: ExtractedEvent):
    normalized = normalize_event(raw)
    coords = await geocode(normalized.venue, normalized.city, normalized.province.value if normalized.province else None)
    if coords:
        normalized.location.latitude, normalized.location.longitude = coords
    score, reasons, status = score_event(normalized)
    normalized.confidence_score = score
    normalized.verification_reasons = reasons
    normalized.status = status
    return normalized.model_dump(mode="json")
