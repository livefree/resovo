import Redis from 'ioredis'

const REDIS_URL = process.env.REDIS_URL

if (!REDIS_URL) {
  throw new Error('REDIS_URL environment variable is required')
}

export const redis = new Redis(REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  lazyConnect: true,
})

redis.on('error', (err) => {
  process.stderr.write(`[redis] connection error: ${err.message}\n`)
})

redis.on('reconnecting', () => {
  process.stderr.write('[redis] reconnecting...\n')
})

export default redis
