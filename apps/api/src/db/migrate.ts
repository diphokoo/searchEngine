import { pool } from './pool.js'

const migrations = [
  // Enable PostGIS
  `CREATE EXTENSION IF NOT EXISTS postgis`,
  `CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`,
  `CREATE EXTENSION IF NOT EXISTS pg_trgm`,

  // Admin users
  `CREATE TABLE IF NOT EXISTS admin_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'REVIEWER',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`,

  // Sources
  `CREATE TABLE IF NOT EXISTS sources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    platform TEXT NOT NULL,
    source_type TEXT NOT NULL,
    province TEXT,
    city TEXT,
    connector TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING',
    reliability_score INTEGER NOT NULL DEFAULT 50,
    last_scan TIMESTAMPTZ,
    last_successful_scan TIMESTAMPTZ,
    last_failure TIMESTAMPTZ,
    events_found INTEGER DEFAULT 0,
    events_imported INTEGER DEFAULT 0,
    events_rejected INTEGER DEFAULT 0,
    error_count INTEGER DEFAULT 0,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`,

  // Events
  `CREATE TABLE IF NOT EXISTS events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    description TEXT,
    category TEXT,
    genres TEXT[] DEFAULT '{}',
    event_type TEXT,

    date DATE,
    start_time TIME,
    end_time TIME,

    venue TEXT,
    address TEXT,
    city TEXT,
    province TEXT,
    country TEXT DEFAULT 'South Africa',

    location GEOMETRY(Point, 4326),

    price NUMERIC(10,2),
    currency TEXT DEFAULT 'ZAR',

    ticket_url TEXT,
    event_url TEXT,
    image_url TEXT,

    organiser TEXT,
    artists TEXT[] DEFAULT '{}',
    age_restriction TEXT,

    sources JSONB DEFAULT '[]',

    confidence_score INTEGER DEFAULT 0,
    verification_reasons TEXT[] DEFAULT '{}',

    status TEXT NOT NULL DEFAULT 'DISCOVERED',

    raw_data JSONB DEFAULT '{}',

    discovered_at TIMESTAMPTZ DEFAULT NOW(),
    last_verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`,

  // Indexes
  `CREATE INDEX IF NOT EXISTS idx_events_status ON events(status)`,
  `CREATE INDEX IF NOT EXISTS idx_events_date ON events(date)`,
  `CREATE INDEX IF NOT EXISTS idx_events_city ON events(city)`,
  `CREATE INDEX IF NOT EXISTS idx_events_province ON events(province)`,
  `CREATE INDEX IF NOT EXISTS idx_events_location ON events USING GIST(location)`,
  `CREATE INDEX IF NOT EXISTS idx_events_title_trgm ON events USING GIN(title gin_trgm_ops)`,
  `CREATE INDEX IF NOT EXISTS idx_events_genres ON events USING GIN(genres)`,

  // Event change history
  `CREATE TABLE IF NOT EXISTS event_changes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    field TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT,
    source TEXT,
    detected_at TIMESTAMPTZ DEFAULT NOW()
  )`,

  // Duplicate groups
  `CREATE TABLE IF NOT EXISTS duplicate_groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    master_event_id UUID REFERENCES events(id),
    duplicate_event_ids UUID[] DEFAULT '{}',
    similarity_score NUMERIC(5,2),
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`,

  // Audit logs
  `CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES admin_users(id),
    user_name TEXT NOT NULL,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    details JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`,

  // API keys
  `CREATE TABLE IF NOT EXISTS api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    key_hash TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL DEFAULT 'PUBLIC_API',
    active BOOLEAN DEFAULT TRUE,
    last_used TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`,

  // Default admin user (password: admin123 — change immediately)
  `INSERT INTO admin_users (email, name, password_hash, role)
   VALUES ('diphokoo@outlook.com', 'System Admin', 'b4cb49ef4a35338f63994a1e4a2c9b73f5785a36abc30e9cf2a203d8fbb8709f', 'SUPER_ADMIN')
   ON CONFLICT (email) DO NOTHING`,
]

async function migrate() {
  const client = await pool.connect()
  try {
    for (const sql of migrations) {
      await client.query(sql)
      console.log('✓', sql.slice(0, 60).replace(/\n/g, ' '))
    }
    console.log('\n✅ Migrations complete')
  } finally {
    client.release()
    await pool.end()
  }
}

migrate().catch(err => { console.error(err); process.exit(1) })
