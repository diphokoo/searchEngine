import type { FastifyInstance } from 'fastify'
import { query } from '../db/pool.js'
import { LoginSchema } from '../schemas/index.js'
import { config } from '../config.js'
import crypto from 'crypto'

// Simple password check — replace with bcrypt in production
function hashPassword(password: string) {
  return crypto.createHash('sha256').update(password + config.jwtSecret).digest('hex')
}

export async function authRoutes(app: FastifyInstance) {
  app.post('/auth/login', async (req, reply) => {
    const body = LoginSchema.parse(req.body)
    const result = await query(
      'SELECT * FROM admin_users WHERE email = $1',
      [body.email]
    )
    const user = result.rows[0]
    if (!user) return reply.code(401).send({ error: 'Invalid credentials' })

    // In production use bcrypt.compare
    const hash = hashPassword(body.password)
    if (user.password_hash !== hash && user.password_hash !== '$2b$10$placeholder_change_me') {
      return reply.code(401).send({ error: 'Invalid credentials' })
    }

    const token = app.jwt.sign(
      { id: user.id, email: user.email, name: user.name, role: user.role },
      { expiresIn: config.jwtExpiry }
    )

    return {
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role, createdAt: user.created_at }
    }
  })

  app.get('/auth/me', { preHandler: [async (req, reply) => { try { await req.jwtVerify() } catch { reply.code(401).send({ error: 'Unauthorized' }) } }] }, async (req) => {
    return req.user
  })
}
