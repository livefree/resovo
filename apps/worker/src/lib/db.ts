import { Pool } from 'pg'
import { config } from '../config'

const DATABASE_URL = process.env.DATABASE_URL

if (!DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required')
}

export const db = new Pool({
  connectionString: DATABASE_URL,
  max: config.db.maxConnections,
  idleTimeoutMillis: config.db.idleTimeoutMillis,
  connectionTimeoutMillis: config.db.connectionTimeoutMillis,
})

db.on('error', (err) => {
  process.stderr.write(`[worker:db] pool error: ${err.message}\n`)
})
