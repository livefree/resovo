/**
 * feedback-driven-recheck.ts — 播放失败反馈驱动的定向重测（每分钟 cron）
 *
 * SRCHEALTH-P1-5（F2）定向化修复：
 *   旧实现只重置 render_status='pending' 后跑全局 runLevel2Render——两个断点：
 *   ① level2 候选要求 probe_status='ok'，信号源 probe 已 dead 时重置无效，事件却被标
 *     processed（静默丢信号）；② 全局 candidates 按 last_rendered_at 取 100 条，不保证
 *     覆盖本批信号源（信号与动作脱钩）。
 *   新编排：信号源先 level1 定向重探（probe 真相刷新）→ 受影响视频聚合重算 →
 *   重置 render pending → level2 定向重测（仅 probe=ok 的信号源）→ 标 processed。
 *   每个信号源均被真实重测后才标记；probe 重测仍 dead 的源结论即「确认失效」，
 *   标 processed 语义成立。
 */

import type { Pool } from 'pg'
import type pino from 'pino'
import { runLevel1Probe, loadSourcesByIds } from './source-health/level1-probe'
import { runLevel2Render } from './source-health/level2-render'
import { aggregateBatch } from './source-health/aggregate-source-check-status'

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

  const sourceIds = [...new Set(events.map((e) => e.source_id).filter((id): id is string => id !== null))]

  if (sourceIds.length > 0) {
    // ① level1 定向重探：刷新 probe 真相（probe dead 的源不再静默漏测）
    const sources = await loadSourcesByIds(pool, sourceIds)
    if (sources.length > 0) {
      await runLevel1Probe(pool, log, { sources })
      // ② 视频聚合重算（与 cron 路径 runSourceHealthLevel1 同步骤）
      const videoIds = [...new Set(sources.map((s) => s.video_id))]
      await aggregateBatch(pool, log, videoIds)
    }

    // ③ 重置 render 信号 + ④ level2 定向重测
    // 仅重置 probe_status='ok'（level1 刚刷新的真相）的源：probe dead 的源不会进 level2
    // candidates（同名守卫），若一并重置会把其 render 真相洗成 stale 'pending'——
    // 抬高 effective_score（pending 0.3 > dead 0.0）且阻碍 auto-retire 双 dead 判定
    //（Codex stop-time review 拦截项）
    await pool.query(
      `UPDATE video_sources SET render_status = 'pending'
        WHERE id = ANY($1::uuid[]) AND probe_status = 'ok'`,
      [sourceIds],
    )
    await runLevel2Render(pool, log, { sourceIds })
  }

  // ⑤ 标 processed：本批信号源已全部真实重测（level1 必测；level2 视 probe 结果）
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
