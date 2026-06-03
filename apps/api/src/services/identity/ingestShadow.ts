/**
 * ingestShadow.ts — 采集入库 findOrCreate 旁路 shadow scoring（CHG-VIR-10 / ADR-105a D-105a-16）
 *
 * 旁路计算「新评分会绑哪个 catalog」并与现有 5 步对比，持久化形态（前置门禁 Opus 裁定，混合 B+C）：
 *   B — pair 类决策（模糊命中/强负拦截）复用 identity_candidate（trigger_source='ingest'，
 *       086 CHECK 已预留），经 pairScoringPersist 与离线 job 完全同口径；
 *   C — 每次旁路决策全集（含一致绑定/无对侧）打 pino 结构化日志（stage='ingest-shadow'），
 *       agreement rate 由日志聚合，不新建 shadow 表、不塞 identity_decisions（087 CHECK 仅
 *       confirmed/rejected）、不加 admin 端点。
 *
 * 红线：R9 + D-105a-12 —— 本模块只写 shadow（identity_candidate + 日志），任何分支不回写
 * videos.catalog_id / 不触发 merge；调用方（CrawlerService）必须 fire-and-forget（写失败
 * 不阻断采集入库主流程，沿 Phase 1b title_observations 容错范式）。
 * R7 —— evidence_hash 输入域全部经 pairScoringPersist 组装，本模块不注入 ingest 上下文。
 */

import type { Pool } from 'pg'
import type pino from 'pino'
import { parseTitle, TITLE_PARSER_VERSION } from '../TitleIdentityParser'
import type { CatalogMatchStep } from '../MediaCatalogService'
import { recallCoreKeyCounterparts, recallExternalIdCounterparts } from './blockingRecall'
import { scoreAndPersistPairs, buildSides, emptyPairPersistCounters } from './pairScoringPersist'
import { loadExternalIdSummaries } from './externalIdLoader'
import { SCORER_VERSION } from './weights'

/** 单次旁路对侧召回上限（与离线 MAX_BUCKET 默认对齐，防热路径放大）。 */
const MAX_COUNTERPARTS = 50

export interface IngestShadowInput {
  readonly videoId: string
  /** 现有 5 步实际绑定的 catalog（legacy 决策，生产真源 / 零变更） */
  readonly catalogId: string
  readonly matchedStep: CatalogMatchStep
  readonly title: string
}

/**
 * shadow 决策口径（卡面：仅强 exact ID + 无强负才视为「新评分会绑定」）：
 * - agree-bind / disagree-bind：存在 exact 命中且无强负的对侧 → 新评分会绑该对侧 catalog，
 *   与 legacy catalog 相同 / 不同。
 * - candidate-only：无 exact 干净对侧，但有 pair 进候选（≥0.75 或强负拦截）→ 人工裁定区间。
 * - none：有对侧但全部低分 → 新评分不绑定也不出候选。
 * - no-counterpart：blocking 双键均无对侧 → 与 legacy「新建/独占」一致。
 */
export type IngestShadowOutcome =
  | 'agree-bind'
  | 'disagree-bind'
  | 'candidate-only'
  | 'none'
  | 'no-counterpart'

export interface IngestShadowResult {
  readonly outcome: IngestShadowOutcome
  readonly counterparts: number
  /** 本次 upsert 触达的候选数（created+superseded+revived+noop，幂等口径） */
  readonly candidatesUpserted: number
  readonly shadowCatalogId: string | null
  readonly durationMs: number
}

/** 对侧 videoId → catalog_id（bind 对比用；轻量点查，不进评分输入）。 */
async function loadCatalogIds(db: Pool, videoIds: readonly string[]): Promise<Map<string, string>> {
  if (videoIds.length === 0) return new Map()
  const r = await db.query<{ id: string; catalog_id: string }>(
    `SELECT id, catalog_id FROM videos WHERE id = ANY($1::uuid[]) AND deleted_at IS NULL`,
    [[...videoIds]],
  )
  return new Map(r.rows.map((row) => [row.id, row.catalog_id]))
}

/**
 * 旁路编排：blocking 双键召回对侧 → scorePair → 候选 upsert（trigger_source='ingest'）
 * → shadow bind 判定 → 结构化日志。每分支均落一条 'ingest-shadow: done' 日志（形态 C）。
 */
export async function runIngestShadowScoring(
  db: Pool,
  log: pino.Logger,
  input: IngestShadowInput,
): Promise<IngestShadowResult> {
  const startAt = Date.now()
  const parserVersion = TITLE_PARSER_VERSION
  const scorerVersion = SCORER_VERSION

  // 1. 自身外部 ID（双源 Y-105a-4）→ ext 桶 key（provider:id，与 blockingRecall 段 ② 同形）
  const selfExt = await loadExternalIdSummaries(db, [input.videoId])
  const selfIds = selfExt.get(input.videoId)?.exactIds ?? {}
  const extBucketKeys = Object.entries(selfIds).map(([p, id]) => `${p}:${id}`)

  // 2. blocking 双键并集召回对侧（与离线 job 同口径 / D-105a-17）
  const parsed = parseTitle(input.title)
  const counterpartIds = new Set<string>()
  if (parsed.coreTitleKey !== '') {
    for (const vid of await recallCoreKeyCounterparts(db, parserVersion, parsed.coreTitleKey, input.videoId, MAX_COUNTERPARTS)) {
      counterpartIds.add(vid)
    }
  }
  for (const vid of await recallExternalIdCounterparts(db, extBucketKeys, input.videoId, MAX_COUNTERPARTS)) {
    counterpartIds.add(vid)
  }

  const finish = (
    outcome: IngestShadowOutcome,
    counterparts: number,
    candidatesUpserted: number,
    shadowCatalogId: string | null,
    extra?: Record<string, unknown>,
  ): IngestShadowResult => {
    const result: IngestShadowResult = {
      outcome, counterparts, candidatesUpserted, shadowCatalogId, durationMs: Date.now() - startAt,
    }
    log.info(
      {
        stage: 'ingest-shadow',
        video_id: input.videoId,
        matched_step: input.matchedStep,
        legacy_catalog_id: input.catalogId,
        shadow_catalog_id: shadowCatalogId,
        outcome,
        counterparts,
        candidates_upserted: candidatesUpserted,
        duration_ms: result.durationMs,
        ...extra,
      },
      'ingest-shadow: done',
    )
    return result
  }

  if (counterpartIds.size === 0) {
    return finish('no-counterpart', 0, 0, null)
  }

  // 截断护栏（确定性：排序后截断，防超大同名桶放大热路径）
  const counterparts = [...counterpartIds].sort().slice(0, MAX_COUNTERPARTS)

  // 3. 组装评分输入 + canonical pair（buildSides 共享层，与离线同口径）
  const sideMap = await buildSides(db, [input.videoId, ...counterparts])
  const pairs: [string, string][] = []
  for (const c of counterparts) {
    if (!sideMap.has(c) || !sideMap.has(input.videoId)) continue
    const [left, right] = [input.videoId, c].sort()
    pairs.push([left!, right!])
  }

  // 4. 评分 + 候选 upsert（与离线完全同口径；低分 pair 返回但不持久化）
  const counters = emptyPairPersistCounters()
  const scores = await scoreAndPersistPairs(
    db, sideMap, pairs,
    { parserVersion, scorerVersion, triggerSource: 'ingest' },
    counters,
  )
  const candidatesUpserted = counters.created + counters.superseded + counters.revived + counters.noop

  // 5. shadow bind 判定：exact 命中 + 无强负（卡面口径）→ 取最高分对侧的 catalog
  const exactClean = scores
    .filter((s) => s.strongNegativeReasons.length === 0
      && s.evidence.some((e) => e.type === 'external_exact_id_match' && e.hit))
    .sort((a, b) => b.identityScore - a.identityScore || a.leftVideoId.localeCompare(b.leftVideoId))

  const extraLog = { blocked: counters.blocked, skipped_low_score: counters.skippedLowScore }

  if (exactClean.length > 0) {
    const best = exactClean[0]!
    const counterpartId = best.leftVideoId === input.videoId ? best.rightVideoId : best.leftVideoId
    const catalogMap = await loadCatalogIds(db, [counterpartId])
    const shadowCatalogId = catalogMap.get(counterpartId) ?? null
    const outcome: IngestShadowOutcome =
      shadowCatalogId !== null && shadowCatalogId === input.catalogId ? 'agree-bind' : 'disagree-bind'
    return finish(outcome, counterparts.length, candidatesUpserted, shadowCatalogId, extraLog)
  }

  return finish(
    candidatesUpserted > 0 ? 'candidate-only' : 'none',
    counterparts.length,
    candidatesUpserted,
    null,
    extraLog,
  )
}
