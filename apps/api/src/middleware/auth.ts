import type { FastifyRequest, FastifyReply } from 'fastify'
import { query } from '../db/pool.js'
import crypto from 'crypto'

export async function requireAuth(req: FastifyRequest, reply: FastifyReply) {
  try {
    await req.jwtVerify()
  } catch {
    reply.code(401).send({ error: 'Unauthorized', message: 'Invalid or expired token', statusCode: 401 })
  }
}

export async function requireRole(...roles: string[]) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    await requireAuth(req, reply)
    const user = req.user as { role: string }
    if (!roles.includes(user.role)) {
      reply.code(403).send({ error: 'Forbidden', message: 'Insufficient permissions', statusCode: 403 })
    }
  }
}

export async function requireApiKey(req: FastifyRequest, reply: FastifyReply) {
  const key = req.headers['x-api-key'] as string
  if (!key) {
    reply.code(401).send({ error: 'Unauthorized', message: 'API key required', statusCode: 401 })
    return
  }
  const keyHash = crypto.createHash('sha256').update(key).digest('hex')
  const result = await query('SELECT * FROM api_keys WHERE key_hash = $1 AND active = TRUE', [keyHash])
  if (!result.rows[0]) {
    reply.code(401).send({ error: 'Unauthorized', message: 'Invalid API key', statusCode: 401 })
    return
  }
  await query('UPDATE api_keys SET last_used = NOW() WHERE key_hash = $1', [keyHash])
}
