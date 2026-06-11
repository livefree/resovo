/**
 * feedback-driven-recheck.ts — 反馈/运营信号驱动的定向重测（每分钟 cron）
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
 *
 * SRCHEALTH-P2-4-B：拉取条件扩展消费 origin='manual_route_reprobe'（admin reprobeRoute
 *   线路级重探信号，API 侧 P2-4-A 按 active 口径批量入队）——两种信号的定向语义完全同构
 *   （source_id 集合 → probe+render 重测 → 标 processed），共用本编排不拆独立 job。
 *   批量上限 BATCH_LIMIT 共享：大线路信号分多个 cron 周期消费完（信号持久化不丢）。
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
  origin: string
}

const BATCH_LIMIT = 100

export async function runFeedbackDrivenRecheck(pool: Pool, log: pino.Logger): Promise<void> {
  const events = await fetchUnprocessed(pool, log)
  if (events === null || events.length === 0) return

  // origin 分布计数：运营 reprobe 后可据此确认信号被消费（P2-4-B 可观测性）
  const byOrigin: Record<string, number> = {}
  for (const e of events) byOrigin[e.origin] = (byOrigin[e.origin] ?? 0) + 1
  log.info({ count: events.length, byOrigin }, 'feedback-driven recheck: processing events')

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
    // 重置谓词与 level2 定向 candidates（level2-render.ts loadLevel2Candidates 定向分支）
    // **完全对齐**（is_active + deleted_at + probe_status='ok'）：任何被 level2 跳过的源
    //（probe dead / 已停用 / 已软删）都不得被重置，否则其 render 真相被洗成 stale
    // 'pending'——抬高 effective_score（pending 0.3 > dead 0.0）且阻碍 auto-retire
    // 双 dead 判定（Codex stop-time review 两轮拦截项：probe 守卫 + active/删除守卫）
    await pool.query(
      `UPDATE video_sources SET render_status = 'pending'
        WHERE id = ANY($1::uuid[])
          AND is_active = true
          AND deleted_at IS NULL
          AND probe_status = 'ok'`,
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
    // 两种 origin 各有独立 partial index（058a feedback_driven / 106 manual_route_reprobe），
    // IN 谓词由 planner 展开 OR → BitmapOr 组合两索引；公平按 created_at 全局排序混批消费
    const result = await pool.query<FeedbackEvent>(
      `SELECT id, source_id, video_id, origin
       FROM source_health_events
       WHERE origin IN ('feedback_driven', 'manual_route_reprobe') AND processed_at IS NULL
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
