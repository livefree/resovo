/**
 * versionReconcile.ts — 身份候选版本对账 + 周期重扫编排（GOV-3 / SEQ-20260612-03）
 *
 * 背景（2026-06-12 实证事故）：TITLE_PARSER_VERSION bump 后 ① pending 候选按版本精确
 * 匹配全部搁浅（合并工作区静默降级 legacy）；② blocking 召回数据源 title_observations
 * 同按版本过滤 → 直接重扫召回 0 桶。GOV-1 手工修复链（观测重写 → 重扫 → 残留 hygiene）
 * 本模块固化为可自动调度的服务层编排。
 *
 * 编排四步（各步真幂等，失败重入安全——下一 tick 失配检测自动识别停在哪步）：
 *   ① 廉价失配检测（2 条 SQL）：当前版本观测覆盖缺口 + 旧版本 pending 残留
 *   ② 观测重写（仅当有缺口）：videos cursor 分批 → buildTitleObservation →
 *      insertObservationIfAbsent（查询层真源，DO NOTHING 不累加 observed_count）
 *   ③ runIdentityRescore（既有 advisory lock 'worker:identity-rescore' 单实例）
 *   ④ 旧版本 pending 显式 supersede（仅当 ① 检出残留；confirmed/rejected 审计行不动）
 *
 * 版本参数恒取运行时常量（TITLE_PARSER_VERSION / SCORER_VERSION），不得写死
 * （arch-reviewer GOV-3 遗漏风险 2）。observations 旧版本行不删（审计保留），表随
 * bump 单调增长 ≈ +O(videos)/次 —— observationsInserted 计数随结果透出供膨胀监控
 * （arch-reviewer GOV-3 D-G3-3 补充）。
 */

import type { Pool } from 'pg'
import type pino from 'pino'
import { TITLE_PARSER_VERSION } from '../TitleIdentityParser'
import { buildTitleObservation } from '../titleObservation.builder'
import { insertObservationIfAbsent } from '@/api/db/queries/titleObservations'
import { hasStaleVersionPending, supersedeStaleVersionPending } from '@/api/db/queries/identity-candidate'
import { runIdentityRescore, type IdentityRescoreResult } from './offlineRescore'
import { SCORER_VERSION } from './weights'

/** 观测重写批大小（与 backfill 脚本同口径） */
const OBSERVATION_BATCH = 500

export interface VersionMismatch {
  /** 存在缺当前 parser 版本观测的活跃 video（→ 需观测重写，否则重扫召回 0 桶） */
  readonly observationsMissing: boolean
  /** 存在非当前版本的 pending 候选（→ 需 hygiene） */
  readonly stalePending: boolean
}

export interface VersionReconcileResult {
  readonly mismatch: VersionMismatch
  readonly observationsInserted: number
  readonly stalePendingSuperseded: number
  readonly rescore: IdentityRescoreResult
  readonly durationMs: number
}

/** 步骤 ①：廉价失配检测（2 条 SQL；boot 自愈与 tick 共用）。 */
export async function detectVersionMismatch(db: Pool): Promise<VersionMismatch> {
  const [obs, stale] = await Promise.all([
    db.query<{ exists: boolean }>(
      `SELECT EXISTS(
         SELECT 1 FROM videos v
         WHERE v.deleted_at IS NULL
           AND NOT EXISTS(
             SELECT 1 FROM title_observations t
             WHERE t.video_id = v.id AND t.parser_version = $1
           )
       ) AS exists`,
      [TITLE_PARSER_VERSION],
    ),
    hasStaleVersionPending(db, { parserVersion: TITLE_PARSER_VERSION, scorerVersion: SCORER_VERSION }),
  ])
  return { observationsMissing: obs.rows[0]?.exists ?? false, stalePending: stale }
}

/** 步骤 ②：缺口观测重写（cursor 分批 / 查询层 DO NOTHING 真幂等）。返回实际插入数。 */
async function rewriteMissingObservations(db: Pool): Promise<number> {
  let cursor = '00000000-0000-0000-0000-000000000000'
  let inserted = 0
  for (;;) {
    const r = await db.query<{ id: string; title: string }>(
      `SELECT id, title FROM videos
       WHERE deleted_at IS NULL AND title IS NOT NULL AND id > $1
       ORDER BY id ASC LIMIT ${OBSERVATION_BATCH}`,
      [cursor],
    )
    if (r.rows.length === 0) break
    for (const v of r.rows) {
      // site 级观测（source_site_key=null）：同一 video.title 对全源一致（CHG-VIR-6 范式）
      if (await insertObservationIfAbsent(db, buildTitleObservation(v.id, v.title, null))) inserted++
    }
    cursor = r.rows[r.rows.length - 1]!.id
  }
  return inserted
}

/**
 * 版本对账 + 全量重扫主入口（'version-reconcile-rescan' job 消费体）。
 * 重扫恒执行（本 job 同时承担周期兜底语义 / GOV-5 合并裁决）；观测重写与
 * hygiene 仅在失配检出时执行。
 */
export async function reconcileIdentityVersions(
  db: Pool,
  log: pino.Logger,
): Promise<VersionReconcileResult> {
  const startedAt = Date.now()
  const mismatch = await detectVersionMismatch(db)

  let observationsInserted = 0
  if (mismatch.observationsMissing) {
    observationsInserted = await rewriteMissingObservations(db)
    log.info(
      { stage: 'identity-version-reconcile', step: 'observations', observationsInserted },
      'identity-version-reconcile: observations rewritten',
    )
  }

  const rescore = await runIdentityRescore(db, log)

  let stalePendingSuperseded = 0
  if (mismatch.stalePending) {
    stalePendingSuperseded = await supersedeStaleVersionPending(db, {
      parserVersion: TITLE_PARSER_VERSION,
      scorerVersion: SCORER_VERSION,
    })
  }

  const result: VersionReconcileResult = {
    mismatch,
    observationsInserted,
    stalePendingSuperseded,
    rescore,
    durationMs: Date.now() - startedAt,
  }
  log.info(
    { stage: 'identity-version-reconcile', step: 'done', ...result, rescore: undefined, rescoreCounters: rescore },
    'identity-version-reconcile: done',
  )
  return result
}
