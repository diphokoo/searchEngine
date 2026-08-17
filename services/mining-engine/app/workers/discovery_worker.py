"""
Discovery worker — processes a 'scan-source' job from the BullMQ discovery queue.
Run with: python -m app.workers.discovery_worker
"""
import asyncio
import json
import structlog
from redis.asyncio import Redis
from ..config import settings
from ..connectors.rss_connector import RSSConnector
from ..connectors.website_connector import WebsiteConnector
from ..extractors.normalizer import normalize_event
from ..extractors.geocoder import geocode
from ..extractors.scorer import score_event
import asyncpg

logger = structlog.get_logger()

CONNECTOR_MAP = {
    "rss": RSSConnector,
    "website": WebsiteConnector,
}


async def get_db():
    return await asyncpg.connect(
        host=settings.db_host, port=settings.db_port,
        database=settings.db_name, user=settings.db_user, password=settings.db_password,
    )


async def process_job(job_data: dict):
    source_id = job_data["sourceId"]
    db = await get_db()
    log = logger.bind(source_id=source_id)

    try:
        source = await db.fetchrow("SELECT * FROM sources WHERE id = $1", source_id)
        if not source:
            log.error("source_not_found")
            return

        connector_cls = CONNECTOR_MAP.get(source["connector"], WebsiteConnector)
        connector = connector_cls(source_id=source_id, source_url=source["url"])

        log.info("starting_discovery", connector=source["connector"])
        raw_events = await connector.discover()
        log.info("events_discovered", count=len(raw_events))

        imported = 0
        for raw in raw_events:
            try:
                normalized = normalize_event(raw)

                # Geocode
                coords = await geocode(normalized.venue, normalized.city, normalized.province.value if normalized.province else None)
                if coords:
                    normalized.location.latitude = coords[0]
                    normalized.location.longitude = coords[1]

                # Score
                confidence, reasons, status = score_event(normalized, source["reliability_score"])
                normalized.confidence_score = confidence
                normalized.verification_reasons = reasons
                normalized.status = status

                # Insert into DB
                location_wkt = f"SRID=4326;POINT({normalized.location.longitude} {normalized.location.latitude})" if normalized.location.latitude else None

                await db.execute("""
                    INSERT INTO events (
                        title, description, genres, event_type, date, start_time, end_time,
                        venue, address, city, province, location, price, ticket_url, event_url,
                        image_url, organiser, artists, sources, confidence_score,
                        verification_reasons, status
                    ) VALUES (
                        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,
                        ST_GeomFromEWKT($12),$13,$14,$15,$16,$17,$18,$19,$20,$21,$22
                    )
                    ON CONFLICT DO NOTHING
                """,
                    normalized.title, normalized.description,
                    [g.value for g in normalized.genres], normalized.event_type,
                    normalized.date, normalized.start_time, normalized.end_time,
                    normalized.venue, normalized.address, normalized.city,
                    normalized.province.value if normalized.province else None,
                    location_wkt, normalized.price, normalized.ticket_url,
                    normalized.event_url, normalized.image_url, normalized.organiser,
                    normalized.artists,
                    json.dumps([s.model_dump(mode="json") for s in normalized.sources]),
                    normalized.confidence_score, normalized.verification_reasons,
                    normalized.status.value,
                )
                imported += 1
            except Exception as e:
                log.error("event_processing_error", error=str(e))

        # Update source stats
        await db.execute("""
            UPDATE sources SET
                last_scan = NOW(), last_successful_scan = NOW(),
                events_found = events_found + $1,
                events_imported = events_imported + $2,
                status = 'ACTIVE', updated_at = NOW()
            WHERE id = $3
        """, len(raw_events), imported, source_id)

        log.info("discovery_complete", found=len(raw_events), imported=imported)

    except Exception as e:
        log.error("worker_error", error=str(e))
        await db.execute("""
            UPDATE sources SET last_failure = NOW(), error_count = error_count + 1,
            status = CASE WHEN error_count >= 5 THEN 'FAILED' ELSE 'WARNING' END,
            updated_at = NOW() WHERE id = $1
        """, source_id)
    finally:
        await db.close()


async def run_worker():
    """Poll the BullMQ discovery queue via Redis."""
    redis = Redis(host=settings.redis_host, port=settings.redis_port, password=settings.redis_password)
    log = logger.bind(worker="discovery")
    log.info("worker_started")

    while True:
        try:
            # BullMQ stores jobs in Redis lists — simplified polling
            job_raw = await redis.blpop("bull:discovery:wait", timeout=5)
            if job_raw:
                _, job_id = job_raw
                job_data_raw = await redis.hget(f"bull:discovery:{job_id.decode()}", "data")
                if job_data_raw:
                    job_data = json.loads(job_data_raw)
                    await process_job(job_data)
        except Exception as e:
            log.error("worker_poll_error", error=str(e))
            await asyncio.sleep(5)


if __name__ == "__main__":
    asyncio.run(run_worker())
