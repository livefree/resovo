import type { PoolClient } from 'pg'

export async function withVideoLock<T>(
  client: PoolClient,
  videoId: string,
  fn: () => Promise<T>,
): Promise<T> {
  await client.query('BEGIN')
  try {
    await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`video:${videoId}`])
    const result = await fn()
    await client.query('COMMIT')
    return result
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  }
}
