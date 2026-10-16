import type { FastifyInstance } from 'fastify'
import { LoginSchema } from '../schemas/index.js'
import { config } from '../config.js'
import crypto from 'crypto'

// In-memory admin — no DB required for auth
const ADMIN_USER = {
  id: '00000000-0000-0000-0000-000000000001',
  email: 'diphokoo@outlook.com',
  name: 'System Admin',
  role: 'SUPER_ADMIN',
  createdAt: new Date().toISOString(),
}

function hashPassword(password: string) {
  return crypto.createHash('sha256').update(password + config.jwtSecret).digest('hex')
}

const ADMIN_HASH = hashPassword('Tlalefo@12')

export async function authRoutes(app: FastifyInstance) {
  app.post('/auth/login', async (req, reply) => {
    const body = LoginSchema.parse(req.body)

    if (body.email !== ADMIN_USER.email || hashPassword(body.password) !== ADMIN_HASH) {
      return reply.code(401).send({ error: 'Invalid credentials' })
    }

    const token = app.jwt.sign(
      { id: ADMIN_USER.id, email: ADMIN_USER.email, name: ADMIN_USER.name, role: ADMIN_USER.role },
      { expiresIn: config.jwtExpiry }
    )

    return { token, user: ADMIN_USER }
  })

  app.get('/auth/me', {
    preHandler: [async (req, reply) => {
      try { await req.jwtVerify() } catch { reply.code(401).send({ error: 'Unauthorized' }) }
    }]
  }, async (req) => req.user)
}
