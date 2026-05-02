import type { Pool } from 'pg'
import type pino from 'pino'
import { runLevel2Render } from './source-health/level2-render'

type FeedbackEvent = {
  id: string
  source_id: string | null
  video_id: string
}

const BATCH_LIMIT = 100

export async function runFeedbackDrivenRecheck(pool: Pool, log: pino.Logger): Promise<void> {
  const events = await fetchUnprocessed(pool, log)
  if (events === null || events.length === 0) return

  log.info({ count: events.length }, 'feedback-driven recheck: processing events')

  const sourceIds = events.map((e) => e.source_id).filter((id): id is string => id !== null)

  if (sourceIds.length > 0) {
    await pool.query(
      `UPDATE video_sources SET render_status = 'pending' WHERE id = ANY($1::uuid[])`,
      [sourceIds],
    )
  }

  await runLevel2Render(pool, log)

  const eventIds = events.map((e) => e.id)
  await pool.query(
    `UPDATE source_health_events SET processed_at = NOW() WHERE id = ANY($1::uuid[])`,
    [eventIds],
  )

  log.info({ count: events.length }, 'feedback-driven recheck: events marked processed')
}

async function fetchUnprocessed(pool: Pool, log: pino.Logger): Promise<FeedbackEvent[] | null> {
  try {
    const result = await pool.query<FeedbackEvent>(
      `SELECT id, source_id, video_id
       FROM source_health_events
       WHERE origin = 'feedback_driven' AND processed_at IS NULL
       ORDER BY created_at ASC
       LIMIT $1`,
      [BATCH_LIMIT],
    )
    return result.rows
  } catch (err) {
    if (err instanceof Error && err.message.includes('column "processed_at" does not exist')) {
      log.warn(
        { metric: 'probe.skipped_circuit', value: 1, reason: '058a_not_applied' },
        'feedback-driven-recheck skipped: processed_at column missing (058a migration not yet applied — wait for CHG-SN-4-05 to integrate first)',
      )
      return null
    }
    throw err
  }
}
