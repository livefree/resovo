/**
 * auto-retire-line.ts — apps/worker auto-retire-line cron job
 *
 * CHG-PRE-DEAD-LINE-AUTO-RETIRE-WORKER-B / Wave 4 #5-B / SEQ-20260528-MOD-WAVE4
 *
 * 设计真源：
 *   - ADR-164 D-164-8（worker 自动退役 / 不写 admin audit / 不触发 R-MID-1 / 写 worker 日志）
 *   - arch-reviewer (claude-opus-4-7) Opus 评审 §6 -B 子卡 worker 集成范式
 *   - SQL 真源：apps/api/src/db/queries/auto-retire-line.ts (-A 子卡 ship + 10/10 单测 + FIX-1/FIX-2 闭环)
 *
 * 职责：
 *   - 启动时由 cron.autoRetireLine 触发（每日 03:30 UTC / config.ts ENV 覆盖）
 *   - 调用 autoRetireLineByDeadCheck() 执行 4 段 SQL 流程
 *   - 对 RETURNING 行每条 log.info structured（auto_retire_line.retired metric / R-DEAD-4）
 *   - 批次 batch_total log.info（auto_retire_line.batch_total metric）
 *   - 抛错由调用方 runWithLogger 包 try/catch（既有范式 / log.error + 不挂 worker）
 *
 * 跨 app import 决策：
 *   - 复用 apps/api/src/db/queries/auto-retire-line.ts 单点真源（防双维护漂移）
 *   - 既有 worker job（level1-probe / level2-render / feedback-driven）内联 SQL 范式
 *     但本卡 -A 已 ship 测试覆盖的 query 函数 / 复用胜过重复
 */

import type { Pool } from 'pg'
import type pino from 'pino'
import {
  autoRetireLineByDeadCheck,
  type RetiredAliasRow,
} from '../../../api/src/db/queries/auto-retire-line'

/**
 * runAutoRetireLine — cron job 入口
 *
 * 工作流：
 *   1. 调 autoRetireLineByDeadCheck() 拿到本次 run 退役清单
 *   2. 对每条 RetiredAliasRow log.info（含 metric / source_site_key / source_name / dead_since / retired_at）
 *      → R-DEAD-4：D-164-8 "不写 admin audit" ≠ "不留痕迹" / 结构化日志支持审计回溯
 *   3. 批次 batch_total log.info（监控运维观察 / arch-reviewer Opus §7）
 *
 * 错误处理：
 *   - autoRetireLineByDeadCheck 抛错 → 直接向上抛 / 由调用方 runWithLogger 既有 try/catch 包
 *     log.error + job 标 failed / 不挂 worker（worker 进程持续运行）
 */
export async function runAutoRetireLine(pool: Pool, log: pino.Logger): Promise<void> {
  const retired = await autoRetireLineByDeadCheck(pool, log)
  const retiredAt = new Date().toISOString()

  // R-DEAD-4：每条 retire 单独 log.info / 结构化 metric 支持审计回溯
  for (const row of retired as readonly RetiredAliasRow[]) {
    log.info(
      {
        metric: 'auto_retire_line.retired',
        value: 1,
        source_site_key: row.source_site_key,
        source_name: row.source_name,
        dead_since: row.dead_since,
        retired_at: retiredAt,
      },
      'auto-retire-line: alias auto-retired',
    )
  }

  // 批次 batch_total log / 运维监控指标（arch-reviewer §7）
  log.info(
    {
      metric: 'auto_retire_line.batch_total',
      value: retired.length,
    },
    'auto-retire-line: job completed',
  )
}
