from typing import Optional
import httpx
import pytesseract
from PIL import Image
from io import BytesIO
import structlog
from ..models.event import ExtractedEvent
from ..config import settings

logger = structlog.get_logger()


async def extract_from_image_url(image_url: str, source_id: str) -> Optional[ExtractedEvent]:
    """Download image, run OCR, then use AI to interpret the text."""
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.get(image_url)
            if resp.status_code >= 400:
                return None

        img = Image.open(BytesIO(resp.content))
        ocr_text = pytesseract.image_to_string(img, lang="eng")

        if len(ocr_text.strip()) < 10:
            logger.warning("ocr_insufficient_text", image_url=image_url)
            return None

        return await interpret_ocr_text(ocr_text, image_url, source_id)

    except Exception as e:
        logger.error("ocr_extraction_error", error=str(e), image_url=image_url)
        return None


async def interpret_ocr_text(text: str, source_url: str, source_id: str) -> Optional[ExtractedEvent]:
    """Use AI to extract structured event data from OCR text."""
    if not settings.openai_api_key:
        # Fallback: return raw text for manual review
        return ExtractedEvent(
            raw_text=text,
            event_url=source_url,
            confidence=0.2,
        )

    try:
        from openai import AsyncOpenAI
        client = AsyncOpenAI(api_key=settings.openai_api_key)

        prompt = f"""Extract event information from this text (from a South African nightlife event poster).
Return ONLY a JSON object with these fields (use null if unknown):
title, date (YYYY-MM-DD), time (HH:MM), venue, city, province, artists (array), genres (array), price (number only), ticket_url, organiser

Text:
{text[:2000]}"""

        response = await client.chat.completions.create(
            model=settings.openai_model,
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
            max_tokens=500,
            temperature=0,
        )

        import json
        data = json.loads(response.choices[0].message.content or "{}")

        return ExtractedEvent(
            title=data.get("title"),
            raw_date=data.get("date"),
            raw_time=data.get("time"),
            venue=data.get("venue"),
            city=data.get("city"),
            province=data.get("province"),
            artists=data.get("artists") or [],
            genres_raw=data.get("genres") or [],
            price_raw=str(data["price"]) if data.get("price") else None,
            ticket_url=data.get("ticket_url"),
            organiser=data.get("organiser"),
            event_url=source_url,
            raw_text=text,
            confidence=0.65,
        )

    except Exception as e:
        logger.error("ai_ocr_interpretation_error", error=str(e))
        return ExtractedEvent(raw_text=text, event_url=source_url, confidence=0.2)
