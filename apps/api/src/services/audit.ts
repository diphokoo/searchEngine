import { query } from '../db/pool.js'

export async function auditLog(
  userId: string,
  userName: string,
  action: string,
  entityType: 'event' | 'source' | 'user',
  entityId: string,
  details: Record<string, unknown> = {}
) {
  await query(
    `INSERT INTO audit_logs (user_id, user_name, action, entity_type, entity_id, details)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [userId, userName, action, entityType, entityId, JSON.stringify(details)]
  )
}
