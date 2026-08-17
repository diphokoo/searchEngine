import { Redis } from 'ioredis'
import { Queue } from 'bullmq'
import { config } from '../config.js'

const connection = new Redis({
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
  maxRetriesPerRequest: null,
})

export const queues = {
  discovery: new Queue('discovery', { connection }),
  extraction: new Queue('extraction', { connection }),
  verification: new Queue('verification', { connection }),
  deduplication: new Queue('deduplication', { connection }),
  geocoding: new Queue('geocoding', { connection }),
}

export type QueueName = keyof typeof queues

export async function getQueueStats() {
  const stats = await Promise.all(
    Object.entries(queues).map(async ([name, queue]) => ({
      name,
      waiting: await queue.getWaitingCount(),
      active: await queue.getActiveCount(),
      completed: await queue.getCompletedCount(),
      failed: await queue.getFailedCount(),
      delayed: await queue.getDelayedCount(),
    }))
  )
  return stats
}

export { connection as redisConnection }
