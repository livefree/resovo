/**
 * identity-candidate.ts — identity_candidate DB 查询（SEQ-20260602-03 / CHG-VIR-8 / Phase 2b）
 *
 * schema 真源 = ADR-105a D-105a-7（migration 086）。**仅 DB query 层**（不 import Service）。
 * canonical_pair_key / evidence_hash / scorePair 在 Service 层算好传入。所有 SQL 参数化（db-rules.md）。
 *
 * 事务函数（①②③④）收 `PoolClient`（R5：旧 pending→superseded + 新建同 BEGIN/COMMIT，
 * 事务由 Service candidateUpsert 持有，参 MediaCatalogService.findOrCreate 范式）；
 * 只读报表（⑤⑥）收 `Pool`。
 */

import type { Pool, PoolClient } from 'pg'

// ── 行类型 ────────────────────────────────────────────────────────

/**
 * 候选触发来源（migration 086 CHECK 真源；111 扩 'enrichment'——外部 ID 绑定后定向重评，
 * BUGFIX-IDENTITY-ENRICH-RESCORE）。本 alias 为 TS 侧唯一收口，扩值须同步 CHECK migration。
 */
export type IdentityTriggerSource = 'ingest' | 'offline-rescore' | 'manual-search' | 'enrichment' | 'title_change'

export interface IdentityCandidateRow {
  readonly id: string
  readonly left_video_id: string
  readonly right_video_id: string
  readonly canonical_pair_key: string
  readonly status: 'pending' | 'confirmed' | 'rejected' | 'superseded'
  readonly parser_version: string
  readonly scorer_version: string
  readonly evidence_jsonb: unknown
  readonly evidence_hash: string
  readonly legacy_score: string | null
  readonly identity_score: string
  readonly strong_negative_reasons: string[]
  readonly trigger_source: IdentityTriggerSource
  readonly group_key: string | null
  readonly revived_from_candidate_id: string | null
  readonly superseded_by_candidate_id: string | null
  readonly created_at: string
  readonly updated_at: string
}

/** 写入入参（Service 算好 canonicalPairKey + evidenceHash 后传入；leftVideoId < rightVideoId 已规范）。 */
export interface IdentityCandidateInsert {
  leftVideoId: string
  rightVideoId: string
  canonicalPairKey: string
  parserVersion: string
  scorerVersion: string
  evidenceJsonb: unknown
  evidenceHash: string
  legacyScore: number | null
  identityScore: number
  strongNegativeReasons: readonly string[]
  triggerSource: IdentityTriggerSource
  groupKey: string | null
  revivedFromCandidateId?: string | null
}

/** 对比报表行（join videos/media_catalog；same_legacy_group 判定新增召回 vs 一致）。 */
export interface IdentityCandidateCompareRow {
  readonly id: string
  readonly canonical_pair_key: string
  readonly left_video_id: string
  readonly right_video_id: string
  readonly left_title: string
  readonly right_title: string
  readonly identity_score: string
  readonly legacy_score: string | null
  readonly strong_negative_reasons: string[]
  readonly evidence_jsonb: unknown
  readonly same_legacy_group: boolean
}

const SELECT_COLS = `
  id, left_video_id, right_video_id, canonical_pair_key, status, parser_version, scorer_version,
  evidence_jsonb, evidence_hash, legacy_score::text, identity_score::text, strong_negative_reasons,
  trigger_source, group_key, revived_from_candidate_id, superseded_by_candidate_id,
  created_at::text, updated_at::text`

// ── ⓪ 旧版本 pending 探测（GOV-2 消费侧诚实化 / SEQ-20260612-03）────────

/**
 * 是否存在**非当前版本**的 pending 候选——identity 当前版本空表时区分
 * 「真空表（可静默降级 legacy）」vs「版本搁浅（升级后未重扫，需 UI 警示）」。
 * 2026-06-12 实证：parser bump 搁浅 207 pending → 工作区静默降级被用户当 bug 报告。
 */
export async function hasStaleVersionPending(
  db: Pool,
  current: { parserVersion: string; scorerVersion: string },
): Promise<boolean> {
  const r = await db.query<{ exists: boolean }>(
    `SELECT EXISTS(
       SELECT 1 FROM identity_candidate
       WHERE status = 'pending'
         AND (parser_version <> $1 OR scorer_version <> $2)
     ) AS exists`,
    [current.parserVersion, current.scorerVersion],
  )
  return r.rows[0]?.exists ?? false
}

/**
 * 旧版本 pending 残留显式 supersede（GOV-3 / GOV-1 步骤 ④ 固化）：重扫 candidateUpsert
 * 只对再次评出的 pair 自动腾位，召回不到的旧 pending（对侧已软删等死对子）残留旧版本，
 * 对工作区不可见且语义过时 → 标 superseded。confirmed/rejected 审计行不动。
 * @returns 受影响行数
 */
export async function supersedeStaleVersionPending(
  db: Pool,
  current: { parserVersion: string; scorerVersion: string },
): Promise<number> {
  const r = await db.query(
    `UPDATE identity_candidate SET status = 'superseded'
     WHERE status = 'pending'
       AND (parser_version <> $1 OR scorer_version <> $2)`,
    [current.parserVersion, current.scorerVersion],
  )
  return r.rowCount ?? 0
}

// ── ① 查当前 pending（先比 hash no-op 判定 / R5）─────────────────────

export async function findPendingByPairKey(
  client: PoolClient,
  canonicalPairKey: string,
): Promise<IdentityCandidateRow | null> {
  const r = await client.query<IdentityCandidateRow>(
    `SELECT ${SELECT_COLS} FROM identity_candidate
     WHERE canonical_pair_key = $1 AND status = 'pending' LIMIT 1`,
    [canonicalPairKey],
  )
  return r.rows[0] ?? null
}

// ── ② 插入新候选行（ON CONFLICT DO NOTHING 防并发竞态 / R5）───────────

/**
 * 插入新 pending 候选。`ON CONFLICT (canonical_pair_key) WHERE status='pending' DO NOTHING`
 * —— 并发抢先时 RETURNING 空 → 返回 null（Service 重查收敛，参 findOrCreate ON CONFLICT 范式）。
 */
export async function insertCandidate(
  client: PoolClient,
  input: IdentityCandidateInsert,
): Promise<IdentityCandidateRow | null> {
  const r = await client.query<IdentityCandidateRow>(
    `INSERT INTO identity_candidate
       (left_video_id, right_video_id, canonical_pair_key, status, parser_version, scorer_version,
        evidence_jsonb, evidence_hash, legacy_score, identity_score, strong_negative_reasons,
        trigger_source, group_key, revived_from_candidate_id)
     VALUES ($1,$2,$3,'pending',$4,$5,$6::jsonb,$7,$8,$9,$10,$11,$12,$13)
     ON CONFLICT (canonical_pair_key) WHERE status = 'pending' DO NOTHING
     RETURNING ${SELECT_COLS}`,
    [
      input.leftVideoId,
      input.rightVideoId,
      input.canonicalPairKey,
      input.parserVersion,
      input.scorerVersion,
      JSON.stringify(input.evidenceJsonb),
      input.evidenceHash,
      input.legacyScore,
      input.identityScore,
      input.strongNegativeReasons,
      input.triggerSource,
      input.groupKey,
      input.revivedFromCandidateId ?? null,
    ],
  )
  return r.rows[0] ?? null
}

// ── ③ supersede 腾位 + 回填 superseded_by（Y2/Y5）───────────────────
// partial unique `WHERE status='pending'` 要求「先腾位旧 pending（移出约束）→ 再 insert 新」，
// 故拆两步：supersedePendingByPairKey 先标 superseded（superseded_by 暂空）→ insert 新 →
// setSupersededBy 回填指针。全程同事务（R5）。

/** 腾位：把该 pair 的 pending 标 superseded（superseded_by 暂 NULL）。返回被腾位的 id（应唯一）。 */
export async function supersedePendingByPairKey(
  client: PoolClient,
  canonicalPairKey: string,
): Promise<string | null> {
  const r = await client.query<{ id: string }>(
    `UPDATE identity_candidate
     SET status = 'superseded', updated_at = NOW()
     WHERE canonical_pair_key = $1 AND status = 'pending'
     RETURNING id`,
    [canonicalPairKey],
  )
  return r.rows[0]?.id ?? null
}

/** 回填 superseded_by 指针（腾位 + insert 新行后）。 */
export async function setSupersededBy(
  client: PoolClient,
  candidateId: string,
  supersededByCandidateId: string,
): Promise<void> {
  await client.query(
    `UPDATE identity_candidate
     SET superseded_by_candidate_id = $2, updated_at = NOW()
     WHERE id = $1`,
    [candidateId, supersededByCandidateId],
  )
}

// ── ④ 查最近一条 rejected（复活判定 / R6）────────────────────────────

export async function findLatestRejectedByPairKey(
  client: PoolClient,
  canonicalPairKey: string,
): Promise<IdentityCandidateRow | null> {
  const r = await client.query<IdentityCandidateRow>(
    `SELECT ${SELECT_COLS} FROM identity_candidate
     WHERE canonical_pair_key = $1 AND status = 'rejected'
     ORDER BY created_at DESC LIMIT 1`,
    [canonicalPairKey],
  )
  return r.rows[0] ?? null
}

// ── ⑤ 对比报表读（join videos/media_catalog；版本过滤 Y5）─────────────

export async function listForCompareReport(
  db: Pool,
  params: {
    scorerVersion: string
    parserVersion: string
    limit: number
    offset: number
    /** CHG-VIR-10：可选 trigger_source 切片（ingest vs offline-rescore）；缺省全量 */
    triggerSource?: IdentityTriggerSource
  },
): Promise<IdentityCandidateCompareRow[]> {
  const r = await db.query<IdentityCandidateCompareRow>(
    `SELECT ic.id, ic.canonical_pair_key, ic.left_video_id, ic.right_video_id,
            lv.title AS left_title, rv.title AS right_title,
            ic.identity_score::text, ic.legacy_score::text, ic.strong_negative_reasons,
            ic.evidence_jsonb,
            (lmc.title_normalized = rmc.title_normalized
             AND lmc.year IS NOT DISTINCT FROM rmc.year
             AND lv.type = rv.type) AS same_legacy_group
     FROM identity_candidate ic
     JOIN videos lv ON lv.id = ic.left_video_id
     JOIN videos rv ON rv.id = ic.right_video_id
     JOIN media_catalog lmc ON lmc.id = lv.catalog_id
     JOIN media_catalog rmc ON rmc.id = rv.catalog_id
     WHERE ic.status = 'pending' AND ic.scorer_version = $1 AND ic.parser_version = $2
       AND ($5::text IS NULL OR ic.trigger_source = $5)
     ORDER BY ic.identity_score DESC, ic.canonical_pair_key ASC
     LIMIT $3 OFFSET $4`,
    [params.scorerVersion, params.parserVersion, params.limit, params.offset, params.triggerSource ?? null],
  )
  return r.rows
}

// ── ⑦ 审核台 similar：按 videoId 召回 pending 候选 pair（对侧 video / CHG-VIR-9-A）────

/** by-videoId 召回行：对侧 video（SimilarVideoItem 字段）+ 候选评分。 */
export interface IdentityCandidateNeighborRow {
  readonly candidate_id: string
  readonly neighbor_video_id: string
  readonly title: string
  readonly type: string
  readonly year: number | null
  readonly country: string | null
  readonly genres: string[]
  readonly cover_url: string | null
  readonly meta_score: number
  readonly review_status: string
  readonly is_published: boolean
  readonly identity_score: string
  readonly strong_negative_reasons: string[]
  readonly evidence_jsonb: unknown
  readonly status: string
}

/**
 * 召回某 video 的 pending 候选 pair（取对侧 video + SimilarVideoItem 字段，复用 listSimilarCandidates
 * 的 videos+media_catalog JOIN 范式）。利用索引 4/5（left/right video FK 反查）。版本过滤（Y5）。
 */
export async function listPendingCandidatesByVideoId(
  db: Pool,
  params: { videoId: string; scorerVersion: string; parserVersion: string; limit: number },
): Promise<IdentityCandidateNeighborRow[]> {
  const r = await db.query<IdentityCandidateNeighborRow>(
    `SELECT
       ic.id AS candidate_id,
       (CASE WHEN ic.left_video_id = $1 THEN ic.right_video_id ELSE ic.left_video_id END) AS neighbor_video_id,
       nv.title, nv.type, nmc.year, nmc.country,
       COALESCE(nmc.genres, ARRAY[]::text[]) AS genres,
       nmc.cover_url, nv.meta_score, nv.review_status, nv.is_published,
       ic.identity_score::text, ic.strong_negative_reasons, ic.evidence_jsonb, ic.status
     FROM identity_candidate ic
     JOIN videos nv
       ON nv.id = (CASE WHEN ic.left_video_id = $1 THEN ic.right_video_id ELSE ic.left_video_id END)
       AND nv.deleted_at IS NULL
     LEFT JOIN media_catalog nmc ON nmc.id = nv.catalog_id
     WHERE (ic.left_video_id = $1 OR ic.right_video_id = $1)
       AND ic.status = 'pending'
       AND ic.scorer_version = $2 AND ic.parser_version = $3
     ORDER BY ic.identity_score DESC, ic.canonical_pair_key ASC
     LIMIT $4`,
    [params.videoId, params.scorerVersion, params.parserVersion, params.limit],
  )
  return r.rows
}

// ── ⑧ /admin/merge：pending 候选 pair（merge source=identity 折叠用 / CHG-VIR-9-A）──────
// CHG-VIR-16-TBL-BE：拆至 ./identity-candidate.pairs（500 行硬限，sources-matrix 拆分先例）；
// re-export 保持外部 import 路径不变（VideoMergesService.schemas / 测试 mock 路径零迁移）。

export {
  listPendingCandidatePairs,
  countPendingCandidatePairs,
  listPendingCandidatePairsLight,
  listPendingPairsLightByVideoIds,
  listPendingPairsByIds,
  type PendingCandidatePairRow,
  type PendingCandidatePairLightRow,
} from './identity-candidate.pairs'

// ── ⑨ 人工裁定写路径（CHG-VIR-9-B / ADR-178）─────────────────────────

/**
 * 事务内按 id 读 candidate（reject 校验用）。`FOR UPDATE` 行锁防并发裁定竞态
 * （两个并发 reject / reject-vs-merge 串行化）。
 */
export async function findCandidateById(
  client: PoolClient,
  candidateId: string,
): Promise<IdentityCandidateRow | null> {
  const r = await client.query<IdentityCandidateRow>(
    `SELECT ${SELECT_COLS} FROM identity_candidate
     WHERE id = $1 FOR UPDATE`,
    [candidateId],
  )
  return r.rows[0] ?? null
}

/**
 * 事务前只读按 id 读 candidate（merge candidateId 快速失败校验 / D-178-3「校验全部在 BEGIN 之前」）。
 * 正确性由事务内 updateCandidateStatus from-state 守卫兜底，本函数仅为快速失败 UX。
 */
export async function findCandidateByIdReadonly(
  db: Pool,
  candidateId: string,
): Promise<IdentityCandidateRow | null> {
  const r = await db.query<IdentityCandidateRow>(
    `SELECT ${SELECT_COLS} FROM identity_candidate
     WHERE id = $1`,
    [candidateId],
  )
  return r.rows[0] ?? null
}

/**
 * 事务内更新 candidate 状态（pending→confirmed/rejected）。from-state 守卫：
 * WHERE status=$from，并发冲突时 rowCount=0 → 调用方抛 STATE_CONFLICT 回滚整事务（D-178-3）。
 */
export async function updateCandidateStatus(
  client: PoolClient,
  candidateId: string,
  fromStatus: 'pending',
  toStatus: 'confirmed' | 'rejected',
): Promise<number> {
  const r = await client.query(
    `UPDATE identity_candidate
        SET status = $3, updated_at = NOW()
      WHERE id = $1 AND status = $2`,
    [candidateId, fromStatus, toStatus],
  )
  return r.rowCount ?? 0
}

// ── ⑥ 对比报表聚合计数（一致/新增召回/拦截 三桶 / §6.1）───────────────

export async function countCompareBuckets(
  db: Pool,
  params: { scorerVersion: string; parserVersion: string },
): Promise<{ pendingTotal: number; blockedTotal: number; crossGroupTotal: number }> {
  const r = await db.query<{ pending_total: string; blocked_total: string; cross_group_total: string }>(
    `SELECT
       COUNT(*)::text AS pending_total,
       COUNT(*) FILTER (WHERE cardinality(ic.strong_negative_reasons) > 0)::text AS blocked_total,
       COUNT(*) FILTER (WHERE NOT (
         lmc.title_normalized = rmc.title_normalized
         AND lmc.year IS NOT DISTINCT FROM rmc.year
         AND lv.type = rv.type))::text AS cross_group_total
     FROM identity_candidate ic
     JOIN videos lv ON lv.id = ic.left_video_id
     JOIN videos rv ON rv.id = ic.right_video_id
     JOIN media_catalog lmc ON lmc.id = lv.catalog_id
     JOIN media_catalog rmc ON rmc.id = rv.catalog_id
     WHERE ic.status = 'pending' AND ic.scorer_version = $1 AND ic.parser_version = $2`,
    [params.scorerVersion, params.parserVersion],
  )
  const row = r.rows[0]
  return {
    pendingTotal: parseInt(row?.pending_total ?? '0', 10),
    blockedTotal: parseInt(row?.blocked_total ?? '0', 10),
    crossGroupTotal: parseInt(row?.cross_group_total ?? '0', 10),
  }
}

/** 三桶按 trigger_source 切片（CHG-VIR-10 shadow precision/recall 报表：ingest vs offline 分布）。 */
export interface CompareBucketsBySourceRow {
  readonly triggerSource: IdentityTriggerSource
  readonly pendingTotal: number
  readonly blockedTotal: number
  readonly crossGroupTotal: number
}

export async function countCompareBucketsBySource(
  db: Pool,
  params: { scorerVersion: string; parserVersion: string },
): Promise<CompareBucketsBySourceRow[]> {
  const r = await db.query<{
    trigger_source: CompareBucketsBySourceRow['triggerSource']
    pending_total: string
    blocked_total: string
    cross_group_total: string
  }>(
    `SELECT
       ic.trigger_source,
       COUNT(*)::text AS pending_total,
       COUNT(*) FILTER (WHERE cardinality(ic.strong_negative_reasons) > 0)::text AS blocked_total,
       COUNT(*) FILTER (WHERE NOT (
         lmc.title_normalized = rmc.title_normalized
         AND lmc.year IS NOT DISTINCT FROM rmc.year
         AND lv.type = rv.type))::text AS cross_group_total
     FROM identity_candidate ic
     JOIN videos lv ON lv.id = ic.left_video_id
     JOIN videos rv ON rv.id = ic.right_video_id
     JOIN media_catalog lmc ON lmc.id = lv.catalog_id
     JOIN media_catalog rmc ON rmc.id = rv.catalog_id
     WHERE ic.status = 'pending' AND ic.scorer_version = $1 AND ic.parser_version = $2
     GROUP BY ic.trigger_source
     ORDER BY ic.trigger_source ASC`,
    [params.scorerVersion, params.parserVersion],
  )
  return r.rows.map((row) => ({
    triggerSource: row.trigger_source,
    pendingTotal: parseInt(row.pending_total, 10),
    blockedTotal: parseInt(row.blocked_total, 10),
    crossGroupTotal: parseInt(row.cross_group_total, 10),
  }))
}
