/**
 * **跨包同步约束（SRCHEALTH-P1-2 / ADR-107 §4 worker 禁止 import apps/api）**：
 * `apps/api/src/lib/source-check-status.ts` 的 `computeCheckStatus` 是本文件
 * 同名函数的并行真源（手动探测后即时重算路径）——维护时双侧同步改，
 * 一致性由 `tests/unit/api/source-check-status.test.ts` 全组合对拍守卫。
 */
import type { Pool } from 'pg'
import type pino from 'pino'
import { withVideoLock } from '../../lib/advisory-lock'
import { emitMetric } from '../../observability/metrics'

type ProbeStatus = 'pending' | 'ok' | 'partial' | 'dead'

type SourceRow = { probe_status: ProbeStatus }

export async function aggregateVideoSourceCheckStatus(
  pool: Pool,
  log: pino.Logger,
  videoId: string,
): Promise<void> {
  const client = await pool.connect()
  try {
    await withVideoLock(client, videoId, async () => {
      const result = await client.query<SourceRow>(
        `SELECT probe_status FROM video_sources
         WHERE video_id = $1 AND is_active = true AND deleted_at IS NULL`,
        [videoId],
      )
      const rows = result.rows
      if (rows.length === 0) return

      const computed = computeCheckStatus(rows.map((r) => r.probe_status))
      await client.query(
        `UPDATE videos SET source_check_status = $1 WHERE id = $2`,
        [computed, videoId],
      )

      emitMetric(log, 'aggregate.updated', 1, { video_id: videoId, status: computed })
      log.debug({ video_id: videoId, status: computed }, 'aggregate updated')
    })
  } finally {
    client.release()
  }
}

export function computeCheckStatus(statuses: ProbeStatus[]): string {
  if (statuses.length === 0) return 'pending'
  const all = (s: ProbeStatus) => statuses.every((x) => x === s)
  const any = (s: ProbeStatus) => statuses.some((x) => x === s)
  if (all('pending')) return 'pending'
  if (all('dead')) return 'all_dead'
  if (any('ok')) return statuses.every((x) => x === 'ok') ? 'ok' : 'partial'
  return 'partial'
}

export async function aggregateBatch(
  pool: Pool,
  log: pino.Logger,
  videoIds: string[],
): Promise<void> {
  for (const videoId of videoIds) {
    try {
      await aggregateVideoSourceCheckStatus(pool, log, videoId)
    } catch (err) {
      log.error({ video_id: videoId, err }, 'aggregate failed for video')
    }
  }
}
