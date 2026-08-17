export const config = {
  port: Number(process.env.PORT ?? 3001),
  jwtSecret: process.env.JWT_SECRET ?? 'change-me-in-production',
  jwtExpiry: process.env.JWT_EXPIRY ?? '24h',

  db: {
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 5432),
    database: process.env.DB_NAME ?? 'event_intelligence',
    user: process.env.DB_USER ?? 'postgres',
    password: process.env.DB_PASSWORD ?? 'postgres',
  },

  redis: {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: Number(process.env.REDIS_PORT ?? 6379),
    password: process.env.REDIS_PASSWORD,
  },

  miningEngineUrl: process.env.MINING_ENGINE_URL ?? 'http://localhost:8000',
  miningEngineApiKey: process.env.MINING_ENGINE_API_KEY ?? 'internal-key',

  s3: {
    bucket: process.env.S3_BUCKET ?? 'event-intelligence-assets',
    region: process.env.AWS_REGION ?? 'af-south-1',
    endpoint: process.env.S3_ENDPOINT,
  },
}
