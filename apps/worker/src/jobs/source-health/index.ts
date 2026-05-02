import type { Pool } from 'pg'
import type pino from 'pino'
import { loadActiveSources, runLevel1Probe } from './level1-probe'
import { runLevel2Render } from './level2-render'
import { aggregateBatch } from './aggregate-source-check-status'

export async function runSourceHealthLevel1(pool: Pool, log: pino.Logger): Promise<void> {
  const sources = await loadActiveSources(pool)
  await runLevel1Probe(pool, log, { sources })
  const videoIds = [...new Set(sources.map((s) => s.video_id))]
  await aggregateBatch(pool, log, videoIds)
}

export async function runSourceHealthLevel2(pool: Pool, log: pino.Logger): Promise<void> {
  await runLevel2Render(pool, log)
}
