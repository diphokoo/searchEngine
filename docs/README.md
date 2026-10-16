# SA Nightlife Event Intelligence Platform

A production-ready data-mining, event-discovery and verification system for South African nightlife events.

## Pipeline

```
DISCOVER → EXTRACT → NORMALIZE → GEOCODE → DEDUPLICATE → VERIFY → SCORE → REVIEW → APPROVE → API → EVENTS APP
```

## Stack

| Layer | Technology |
|---|---|
| Admin Dashboard | React + TypeScript + Vite + Bootstrap 5 + TanStack Query + Recharts |
| API | Node.js + TypeScript + Fastify + JWT + Zod |
| Mining Engine | Python + FastAPI + BeautifulSoup + Tesseract OCR + OpenAI |
| Database | PostgreSQL 16 + PostGIS |
| Job Queue | Redis + BullMQ |
| Storage | S3-compatible (AWS S3 / MinIO) |

## Project Structure

```
event-intelligence/
├── apps/
│   ├── admin-dashboard/     React admin UI
│   └── api/                 Node.js Fastify API
├── services/
│   └── mining-engine/       Python FastAPI mining service
├── packages/
│   └── shared-types/        Shared TypeScript types
├── workers/
│   ├── discovery-worker/    BullMQ source scanner
│   ├── verification-worker/ BullMQ event verifier
│   └── deduplication-worker/BullMQ duplicate detector
├── infrastructure/
│   ├── docker-compose.yml
│   ├── Dockerfile.*
│   ├── nginx.conf
│   └── postgres/seed.sql
└── .env.example
```

## Quick Start

### 1. Prerequisites

- Docker + Docker Compose
- Node.js 22+
- Python 3.12+
- Tesseract OCR (`apt install tesseract-ocr` / `brew install tesseract`)

### 2. Environment

```bash
cp .env.example .env
# Edit .env — set JWT_SECRET and optionally OPENAI_API_KEY
```

### 3. Start infrastructure

```bash
cd infrastructure
docker-compose up -d postgres redis
```

### 4. Run database migrations

```bash
cd apps/api
npm install
npm run db:migrate
```

### 5. Seed initial sources

```bash
psql -U postgres -d event_intelligence -f infrastructure/postgres/seed.sql
```

### 6. Start the API

```bash
cd apps/api
npm run dev
# Runs on http://localhost:3001
```

### 7. Start the mining engine

```bash
cd services/mining-engine
python -m venv .venv
.venv\Scripts\activate        # Windows
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### 8. Start workers

```bash
cd workers/discovery-worker
npm install
npm run dev
```

### 9. Start the dashboard

```bash
cd apps/admin-dashboard
npm install
npm run dev
# Runs on http://localhost:5173
```

### 10. Docker (all services)

```bash
cd infrastructure
docker-compose up --build
```

Dashboard → http://localhost:5173  
API → http://localhost:3001  
Mining Engine → http://localhost:8000

Default login: `diphokoo@outlook.com` — set password via DB after first migration.

---

## Development Phases

| Phase | Status | Description |
|---|---|---|
| 1 | ✅ Built | Dashboard, API, DB schema, Auth, Event/Source CRUD |
| 2 | ✅ Built | Redis, BullMQ, Worker architecture, RSS + Website connectors |
| 3 | ✅ Built | Extraction, Normalization, OCR, AI classification, Geocoding |
| 4 | ✅ Built | Deduplication, Verification, Confidence scoring |
| 5 | ✅ Built | Admin review, Source management, Audit logs |
| 6 | ✅ Built | Public Events API, Nearby/radius search, Genre filtering |
| 7 | 🔜 Next | Additional connectors (social platforms, more venues) |

---

## API Reference

### Admin API (JWT required)

```
GET    /admin/stats
GET    /admin/charts/:type        (timeline|province|genre|city)
GET    /admin/events              ?status=&province=&city=&genre=&search=&page=&pageSize=
GET    /admin/events/:id
PATCH  /admin/events/:id
POST   /admin/events/:id/approve
POST   /admin/events/:id/reject
POST   /admin/events/:id/flag
GET    /admin/events/nearby       ?lat=&lng=&radius=&genre=
GET    /admin/sources             ?page=&pageSize=&status=
POST   /admin/sources
PATCH  /admin/sources/:id
POST   /admin/sources/:id/scan
POST   /admin/sources/:id/test
GET    /admin/audit-logs
GET    /admin/system/health
GET    /admin/system/queues
```

### Public Events API (API key required via `x-api-key` header)

```
GET /api/events                   ?province=&city=&genre=&dateFrom=&dateTo=&search=
GET /api/events/:id
GET /api/events/upcoming
GET /api/events/genre/:genre
GET /api/events/city/:city
GET /api/events/nearby            ?lat=&lng=&radius=&genre=&date=
```

Only `status = APPROVED` events are returned.

### Nearby example

```
GET /api/events/nearby?lat=-25.7479&lng=28.2293&radius=50&genre=Amapiano
```

Returns Amapiano events within 50km of Pretoria, sorted by distance.

---

## Adding a New Connector

1. Create `services/mining-engine/app/connectors/my_connector.py`
2. Extend `BaseConnector` and implement `discover() -> List[ExtractedEvent]`
3. Register in `CONNECTOR_MAP` in `discovery_worker.py` and `main.py`
4. Add a source row in the DB with `connector = 'my_connector'`

---

## Confidence Score

| Score | Meaning | Status |
|---|---|---|
| 95–100 | Highly verified | VERIFIED |
| 80–94 | Strong confidence | VERIFIED |
| 60–79 | Review required | NEEDS_REVIEW |
| 0–59 | Low confidence | DISCOVERED |

Only `APPROVED` events (manually approved by an admin) are exposed via the public API.

---

## Geographic Coverage

All 9 South African provinces supported with PostGIS radius search:

```
Gauteng · Western Cape · KwaZulu-Natal · Eastern Cape
Free State · Limpopo · Mpumalanga · North West · Northern Cape
```

---

## Security Notes

- Change `JWT_SECRET` before deploying
- Change the default admin password immediately after first run
- The public API requires an `x-api-key` header — never expose raw/unverified events
- All social platform connectors must use official APIs and respect rate limits
- The crawler respects `robots.txt` and implements rate limiting
