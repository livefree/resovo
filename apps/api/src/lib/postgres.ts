import { Pool } from 'pg'

// NOTE: DATABASE_URL は直接 process.env から読む
// INFRA-05 完了後に src/api/lib/config.ts 経由に切り替える
const DATABASE_URL = process.env.DATABASE_URL

if (!DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required')
}

export const db = new Pool({
  connectionString: DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
})

db.on('error', (err) => {
  process.stderr.write(`[postgres] pool error: ${err.message}\n`)
})

export default db
