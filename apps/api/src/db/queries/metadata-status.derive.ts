/**
 * metadata-status.derive.ts — 统一元数据状态派生（ADR-201 / META-32-A）
 *
 * 服务端**集中**派生 `MetadataStatusSummary`（D-201-2 / 派生规则）：UI 不在 cell/tooltip 现算核心状态。
 * 纯函数 `buildMetadataStatusSummary` + 按页批量 refs 查询 `getMetadataProviderRefs`（避免 cell N+1）。
 *
 * 取数真源优先级（ADR-201 D-201-E）：
 *   `catalog_external_refs`（ADR-177 canonical，relation）> `video_external_refs`（video 级 match_status）
 *   > `media_catalog` 四 ID 列（仅 cache 兜底）。
 *   `applied` 不得仅据 `media_catalog.*_id IS NOT NULL`；refs rejected 但 cache 有值 → `problem`。
 *   例外：tmdb / imdb 当前无 refs 写入路径（META-38 接入前），cache 命中作 `applied` + reasonCode `cache_only_no_ref`。
 *
 * 阈值（D-201-C）集中此处，UI 不得散落。
 */

import type { Pool, PoolClient } from 'pg'
import type {
  VideoType, DoubanStatus, BangumiStatus, VideoMetaQuality,
  MetadataProvider, MetadataProviderState, MetadataProviderStatus,
  MetadataIssueLevel, MetadataStatusIssue, MetadataStatusOverall,
  MetadataNextAction, MetadataStatusSummary,
} from '@/types'
import { METADATA_PROVIDERS, METADATA_PROVIDER_ORDER } from '@/types'

/** complete 完整度阈值（ADR-201 D-201-C，暂定 80；后续按真实数据校准，禁散落 UI）。 */
export const METADATA_COMPLETE_SCORE_THRESHOLD = 80

type CatalogRelation = 'exact' | 'parent' | 'candidate' | 'rejected'
type VideoMatchStatus = 'auto_matched' | 'manual_confirmed' | 'candidate' | 'rejected'

/** 单 provider 的 refs 真源聚合（catalog canonical + video 级各取最强一条）。 */
export interface ProviderRefAggregate {
  provider: MetadataProvider
  catalogRelation: CatalogRelation | null
  catalogConfidence: number | null
  catalogExternalId: string | null
  videoMatchStatus: VideoMatchStatus | null
  videoMatchMethod: string | null
  videoConfidence: number | null
  videoExternalId: string | null
  videoIsPrimary: boolean
}

/** `buildMetadataStatusSummary` 输入契约（DbVideoRow 可投影得出；cache 兜底 + refs 真源）。 */
export interface MetadataStatusSourceRow {
  type: VideoType
  doubanStatus: DoubanStatus | null
  bangumiStatus: BangumiStatus | null
  metaScore: number | null
  metaQuality: VideoMetaQuality | null
  doubanId: string | null
  tmdbId: number | null
  imdbId: string | null
  bangumiSubjectId: number | null
  /** 四源 refs 聚合（每 provider ≤1 条；缺则该 provider 走 status 列 / cache 兜底）。 */
  providerRefs: readonly ProviderRefAggregate[]
}

const ISSUE_RANK: Record<MetadataIssueLevel, number> = { none: 0, info: 1, warn: 2, danger: 3 }
const OVERALL_RANK: Record<MetadataStatusOverall, number> = {
  needs_review: 1, candidate: 2, missing: 3, partial: 4, complete: 5,
}
const NEXT_ACTION_BY_OVERALL: Record<MetadataStatusOverall, MetadataNextAction> = {
  needs_review: 'review_conflict',
  candidate: 'confirm_candidate',
  missing: 'run_enrichment',
  partial: 'improve_fields',
  complete: 'none',
}

// ── 纯派生 ────────────────────────────────────────────────────────────────────

function cacheExternalId(provider: MetadataProvider, row: MetadataStatusSourceRow): string | null {
  switch (provider) {
    case 'douban': return row.doubanId
    case 'tmdb': return row.tmdbId != null ? String(row.tmdbId) : null
    case 'imdb': return row.imdbId
    case 'bangumi': return row.bangumiSubjectId != null ? String(row.bangumiSubjectId) : null
  }
}

/** douban / bangumi 的 status 列兜底映射（无 refs 时）。tmdb / imdb 无 status 列 → null。 */
function statusColumnState(provider: MetadataProvider, row: MetadataStatusSourceRow): MetadataProviderState | null {
  const status = provider === 'douban' ? row.doubanStatus
    : provider === 'bangumi' ? row.bangumiStatus : null
  if (!status) return null
  switch (status) {
    case 'matched': return 'applied'
    case 'candidate': return 'candidate'
    case 'unmatched': return 'missing'  // enrich 已试无候选
    case 'pending': return 'missing'
    default: return null
  }
}

/** 单 provider 派生（refs canonical 优先 → video ref → status 列 → cache 兜底）。 */
function deriveProviderStatus(
  provider: MetadataProvider,
  row: MetadataStatusSourceRow,
  ref: ProviderRefAggregate | undefined,
): MetadataProviderStatus {
  const cacheId = cacheExternalId(provider, row)
  const externalId = ref?.catalogExternalId ?? ref?.videoExternalId ?? cacheId
  const confidence = ref?.catalogConfidence ?? ref?.videoConfidence
    ?? (provider === 'douban' ? row.metaQuality?.douban_confidence ?? null : null)
  const matchMethod = ref?.videoMatchMethod
    ?? (provider === 'douban' ? row.metaQuality?.douban_match_method ?? null : null)
  const reasonCodes: string[] = []

  let state: MetadataProviderState
  let issueLevel: MetadataIssueLevel

  // bangumi 仅 anime（D-201-B：不适用不计缺失惩罚）
  if (provider === 'bangumi' && row.type !== 'anime') {
    state = 'not_applicable'; issueLevel = 'info'; reasonCodes.push('not_applicable_type')
  } else if (ref?.catalogRelation) {
    ({ state, issueLevel } = mapCatalogRelation(ref.catalogRelation, cacheId, reasonCodes))
  } else if (ref?.videoMatchStatus) {
    ({ state, issueLevel } = mapVideoMatchStatus(ref.videoMatchStatus, cacheId, reasonCodes))
  } else {
    const colState = statusColumnState(provider, row)
    if (colState) {
      state = colState
      issueLevel = colState === 'candidate' ? 'warn' : 'none'
      if (colState === 'candidate') reasonCodes.push('status_candidate')
    } else if (cacheId) {
      // tmdb / imdb cache-only（Phase 1 无 refs 写入路径，META-38 接入后改 refs 真源）
      state = 'applied'; issueLevel = 'info'; reasonCodes.push('cache_only_no_ref')
    } else {
      state = 'missing'; issueLevel = 'none'
    }
  }

  return {
    provider, state, issueLevel,
    externalId, label: externalId,
    confidence, matchMethod,
    appliedAt: null,  // Phase 1：无 per-provider 应用列（D-201 注释），整体时间见 summary.enrichedAt
    fetchedAt: null,  // Phase 1：无 per-provider fetch log（TMDB 接入后补 external_fetch_log）
    reasonCodes,
    tooltipLines: [],  // i18n 文案不下沉后端（META-33 UI 据结构化字段拼装）
  }
}

function mapCatalogRelation(
  relation: CatalogRelation, cacheId: string | null, reasonCodes: string[],
): { state: MetadataProviderState; issueLevel: MetadataIssueLevel } {
  if (relation === 'exact' || relation === 'parent') return { state: 'applied', issueLevel: 'none' }
  if (relation === 'candidate') { reasonCodes.push('catalog_candidate'); return { state: 'candidate', issueLevel: 'warn' } }
  // rejected
  if (cacheId) { reasonCodes.push('ref_rejected_cache_present'); return { state: 'problem', issueLevel: 'danger' } }
  return { state: 'missing', issueLevel: 'none' }
}

function mapVideoMatchStatus(
  matchStatus: VideoMatchStatus, cacheId: string | null, reasonCodes: string[],
): { state: MetadataProviderState; issueLevel: MetadataIssueLevel } {
  if (matchStatus === 'auto_matched' || matchStatus === 'manual_confirmed') return { state: 'applied', issueLevel: 'none' }
  if (matchStatus === 'candidate') { reasonCodes.push('video_candidate'); return { state: 'candidate', issueLevel: 'warn' } }
  // rejected
  if (cacheId) { reasonCodes.push('ref_rejected_cache_present'); return { state: 'problem', issueLevel: 'danger' } }
  return { state: 'missing', issueLevel: 'none' }
}

/** 整体状态派生（ADR-201 §派生规则 1–6；禁静默归 complete）。 */
function deriveOverall(
  providers: readonly MetadataProviderStatus[], enrichedAt: string | null, score: number | null,
): MetadataStatusOverall {
  const hasDanger = providers.some((p) => p.issueLevel === 'danger')
  const hasWarn = providers.some((p) => p.issueLevel === 'warn')
  const hasApplied = providers.some((p) => p.state === 'applied')
  const hasCandidate = providers.some((p) => p.state === 'candidate')
  const hasProblem = providers.some((p) => p.state === 'problem')

  if (hasProblem && hasDanger) return 'needs_review'
  if (hasCandidate && !hasDanger) return 'candidate'
  if (!hasApplied && !hasCandidate && !enrichedAt) return 'missing'
  if (hasApplied && (score == null || score < METADATA_COMPLETE_SCORE_THRESHOLD)) return 'partial'
  if (hasApplied && score != null && score >= METADATA_COMPLETE_SCORE_THRESHOLD && !hasWarn && !hasDanger) return 'complete'
  return 'partial'  // 边界默认 partial + issue（ADR 规则 6）
}

function collectIssues(providers: readonly MetadataProviderStatus[]): MetadataStatusIssue[] {
  const issues: MetadataStatusIssue[] = []
  for (const p of providers) {
    if (p.state === 'candidate') {
      issues.push({ code: 'candidate_unconfirmed', level: 'warn', provider: p.provider, message: `${p.provider} candidate not applied`, action: 'confirm_candidate' })
    } else if (p.state === 'problem') {
      issues.push({ code: p.reasonCodes[0] ?? 'provider_conflict', level: 'danger', provider: p.provider, message: `${p.provider} needs review`, action: 'review_conflict' })
    }
  }
  return issues
}

/** 主来源：按显示顺序取第一个 applied 来源（无则 null）。 */
function pickPrimaryProvider(byProvider: Record<MetadataProvider, MetadataProviderStatus>): MetadataProvider | null {
  for (const provider of METADATA_PROVIDER_ORDER) {
    if (byProvider[provider].state === 'applied') return provider
  }
  return null
}

/**
 * 纯派生：`MetadataStatusSourceRow` → `MetadataStatusSummary`（ADR-201 唯一管理端契约）。
 * `providers` 恒含四 key（缺源归 missing / 不适用归 not_applicable，D-201-A·B）。
 */
export function buildMetadataStatusSummary(row: MetadataStatusSourceRow): MetadataStatusSummary {
  const refByProvider = new Map<MetadataProvider, ProviderRefAggregate>()
  for (const r of row.providerRefs) refByProvider.set(r.provider, r)

  const byProvider = {} as Record<MetadataProvider, MetadataProviderStatus>
  for (const provider of METADATA_PROVIDERS) {
    byProvider[provider] = deriveProviderStatus(provider, row, refByProvider.get(provider))
  }
  const providerList = METADATA_PROVIDER_ORDER.map((p) => byProvider[p])

  const score = row.metaScore ?? null
  const enrichedAt = row.metaQuality?.enriched_at ?? null
  const overall = deriveOverall(providerList, enrichedAt, score)
  const issues = collectIssues(providerList)
  const issueLevel = providerList.reduce<MetadataIssueLevel>(
    (acc, p) => (ISSUE_RANK[p.issueLevel] > ISSUE_RANK[acc] ? p.issueLevel : acc), 'none',
  )

  return {
    overall,
    issueLevel,
    score,
    enrichedAt,
    primaryProvider: pickPrimaryProvider(byProvider),
    providers: byProvider,
    issues,
    nextAction: NEXT_ACTION_BY_OVERALL[overall],
    sort: {
      statusRank: OVERALL_RANK[overall],
      issueRank: ISSUE_RANK[issueLevel],
      scoreRank: score,
      updatedAt: enrichedAt,
    },
  }
}

// ── 按页批量 refs 查询（避免 cell N+1；列表/详情共用）─────────────────────────

interface VideoRefKey { readonly id: string; readonly catalogId: string }

interface DbVideoRefRow {
  video_id: string
  provider: MetadataProvider
  match_status: VideoMatchStatus
  match_method: string | null
  confidence: string | null
  external_id: string | null
  is_primary: boolean
}
interface DbCatalogRefRow {
  catalog_id: string
  provider: MetadataProvider
  relation: CatalogRelation
  confidence: string | null
  external_id: string | null
}

function toNum(v: string | null): number | null {
  if (v == null) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/**
 * 取一批视频的四源 refs 聚合（每 (video, provider) 取 video 级最强 + 每 (catalog, provider) 取 catalog 级最强）。
 * 两条批量查询（按 video_ids / catalog_ids），JS 内组装 → 避免 cell N+1（ADR §数据支撑）。
 */
export async function getMetadataProviderRefs(
  db: Pool | PoolClient,
  videos: readonly VideoRefKey[],
): Promise<Map<string, ProviderRefAggregate[]>> {
  const result = new Map<string, ProviderRefAggregate[]>()
  if (videos.length === 0) return result

  const videoIds = videos.map((v) => v.id)
  const catalogIds = [...new Set(videos.map((v) => v.catalogId))]

  // video 级：每 (video, provider) 取最强（is_primary → manual_confirmed > auto_matched > candidate > rejected → confidence）
  const vRes = await db.query<DbVideoRefRow>(
    `SELECT DISTINCT ON (video_id, provider)
            video_id, provider, match_status, match_method, confidence, external_id, is_primary
       FROM video_external_refs
      WHERE video_id = ANY($1::uuid[])
      ORDER BY video_id, provider,
               is_primary DESC,
               CASE match_status
                 WHEN 'manual_confirmed' THEN 0 WHEN 'auto_matched' THEN 1
                 WHEN 'candidate' THEN 2 WHEN 'rejected' THEN 3 ELSE 4 END,
               confidence DESC NULLS LAST`,
    [videoIds],
  )
  // catalog 级（canonical）：每 (catalog, provider) 取最强（exact > parent > candidate > rejected → confidence）
  const cRes = await db.query<DbCatalogRefRow>(
    `SELECT DISTINCT ON (catalog_id, provider)
            catalog_id, provider, relation, confidence, external_id
       FROM catalog_external_refs
      WHERE catalog_id = ANY($1::uuid[])
      ORDER BY catalog_id, provider,
               CASE relation
                 WHEN 'exact' THEN 0 WHEN 'parent' THEN 1
                 WHEN 'candidate' THEN 2 WHEN 'rejected' THEN 3 ELSE 4 END,
               confidence DESC NULLS LAST`,
    [catalogIds],
  )

  const vByVideo = new Map<string, DbVideoRefRow[]>()
  for (const r of vRes.rows) {
    const list = vByVideo.get(r.video_id) ?? []
    list.push(r); vByVideo.set(r.video_id, list)
  }
  const cByCatalog = new Map<string, DbCatalogRefRow[]>()
  for (const r of cRes.rows) {
    const list = cByCatalog.get(r.catalog_id) ?? []
    list.push(r); cByCatalog.set(r.catalog_id, list)
  }

  for (const v of videos) {
    const vrefs = vByVideo.get(v.id) ?? []
    const crefs = cByCatalog.get(v.catalogId) ?? []
    const aggregates: ProviderRefAggregate[] = []
    for (const provider of METADATA_PROVIDERS) {
      const cr = crefs.find((r) => r.provider === provider)
      const vr = vrefs.find((r) => r.provider === provider)
      if (!cr && !vr) continue
      aggregates.push({
        provider,
        catalogRelation: cr?.relation ?? null,
        catalogConfidence: cr ? toNum(cr.confidence) : null,
        catalogExternalId: cr?.external_id ?? null,
        videoMatchStatus: vr?.match_status ?? null,
        videoMatchMethod: vr?.match_method ?? null,
        videoConfidence: vr ? toNum(vr.confidence) : null,
        videoExternalId: vr?.external_id ?? null,
        videoIsPrimary: vr?.is_primary ?? false,
      })
    }
    result.set(v.id, aggregates)
  }
  return result
}

/** DbVideoRow → MetadataStatusSourceRow 投影（refs 由 `getMetadataProviderRefs` 注入）。 */
export function toMetadataStatusSourceRow(
  row: {
    type: VideoType
    douban_status: DoubanStatus | null
    bangumi_status: BangumiStatus | null
    meta_score: number | null
    meta_quality: VideoMetaQuality | null
    douban_id: string | null
    tmdb_id: number | null
    imdb_id: string | null
    bangumi_subject_id: number | null
  },
  providerRefs: readonly ProviderRefAggregate[],
): MetadataStatusSourceRow {
  return {
    type: row.type,
    doubanStatus: row.douban_status,
    bangumiStatus: row.bangumi_status,
    metaScore: row.meta_score,
    metaQuality: row.meta_quality,
    doubanId: row.douban_id,
    tmdbId: row.tmdb_id,
    imdbId: row.imdb_id,
    bangumiSubjectId: row.bangumi_subject_id,
    providerRefs,
  }
}
