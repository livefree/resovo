/**
 * identity-candidate.pairs.ts — /admin/merge pending 候选 pair 查询（CHG-VIR-9-A 起 ⑧ 段）
 *
 * CHG-VIR-16-TBL-BE 自 identity-candidate.ts 拆出（500 行硬限，sources-matrix 拆分先例）；
 * 原模块 re-export 保持外部 import 路径不变。
 *
 * 内容：merge source=identity 折叠消费的 pending pair 行（完整/轻列）+ 共用 WHERE 口径。
 * ADR-105a AMENDMENT 2026-06-05 D-105a-19：有界全量轻列折叠管线（light 全量 / 闭包补全 /
 * 页分量完整行回查）；listPendingCandidatePairs / countPendingCandidatePairs 在列表路径
 * 退役，本体保留供报表与测试。
 */

import type { Pool } from 'pg'

export interface PendingCandidatePairRow {
  readonly id: string
  readonly left_video_id: string
  readonly right_video_id: string
  readonly identity_score: string
  readonly legacy_score: string | null
  readonly strong_negative_reasons: string[]
  readonly evidence_jsonb: unknown
  readonly group_key: string | null
}

// CHG-VIR-9-C FIX-3（Codex review）：双侧排除软删视频——legacy merge 软删 pair 一侧后该 candidate
// 仍 pending（仅 candidateId merge 路径会置 confirmed），不过滤则列表给出确认必败的 stale 候选。
// list 与 count 共用同一口径（分页 total 一致性）。
const PENDING_PAIR_WHERE = `
     WHERE ic.status = 'pending' AND ic.scorer_version = $1 AND ic.parser_version = $2
       AND EXISTS (SELECT 1 FROM videos lv WHERE lv.id = ic.left_video_id AND lv.deleted_at IS NULL)
       AND EXISTS (SELECT 1 FROM videos rv WHERE rv.id = ic.right_video_id AND rv.deleted_at IS NULL)`

/** 拉 pending 候选 pair（版本过滤 Y5 + 软删双侧排除）。Service 折叠成 CandidateGroup（每 pair→2-video group）。 */
export async function listPendingCandidatePairs(
  db: Pool,
  params: { scorerVersion: string; parserVersion: string; limit: number; offset: number },
): Promise<PendingCandidatePairRow[]> {
  const r = await db.query<PendingCandidatePairRow>(
    `SELECT id, left_video_id, right_video_id, identity_score::text, legacy_score::text,
            strong_negative_reasons, evidence_jsonb, group_key
     FROM identity_candidate ic${PENDING_PAIR_WHERE}
     ORDER BY identity_score DESC, canonical_pair_key ASC
     LIMIT $3 OFFSET $4`,
    [params.scorerVersion, params.parserVersion, params.limit, params.offset],
  )
  return r.rows
}

// ── D-105a-19（CHG-VIR-16-TBL-BE）：有界全量轻列折叠管线 query ──────────

/**
 * 轻列 pending pair 行（全局折叠 stage 1/R-1 闭包补全用）：
 * 不含 evidence_jsonb / strong_negative_reasons / legacy_score / group_key 重列，
 * 2000 行量级内存占用平凡；完整行经 listPendingPairsByIds 仅对当前页分量回查。
 */
export interface PendingCandidatePairLightRow {
  readonly id: string
  readonly left_video_id: string
  readonly right_video_id: string
  readonly identity_score: string
  readonly canonical_pair_key: string
}

const PENDING_PAIR_LIGHT_COLS = `id, left_video_id, right_video_id, identity_score::text, canonical_pair_key`

/**
 * D-105a-19 stage 1：轻列全量（WHERE 逐字复用 PENDING_PAIR_WHERE 口径；调用方传 cap+1 探测截断）。
 * 行数 0 = pending 真空表（Service 据此降级 legacy——降级判定在任何组级筛选之前）。
 */
export async function listPendingCandidatePairsLight(
  db: Pool,
  params: { scorerVersion: string; parserVersion: string; limit: number },
): Promise<PendingCandidatePairLightRow[]> {
  const r = await db.query<PendingCandidatePairLightRow>(
    `SELECT ${PENDING_PAIR_LIGHT_COLS}
     FROM identity_candidate ic${PENDING_PAIR_WHERE}
     ORDER BY identity_score DESC, canonical_pair_key ASC
     LIMIT $3`,
    [params.scorerVersion, params.parserVersion, params.limit],
  )
  return r.rows
}

/**
 * D-105a-19 截断态闭包补全（评审红线 R-1 方案 (b)）：触及 video 集合的全部 pending pair（轻列）。
 * 截断边界处分量缺成员/缺 candidateId 锚点 → videoCount 筛选不可信 + confirm 漏 pair，
 * 故 truncated 态下按界内 video 集合补查迭代至闭包（守卫在 Service 层）。
 */
export async function listPendingPairsLightByVideoIds(
  db: Pool,
  params: { scorerVersion: string; parserVersion: string; videoIds: readonly string[] },
): Promise<PendingCandidatePairLightRow[]> {
  if (params.videoIds.length === 0) return []
  const r = await db.query<PendingCandidatePairLightRow>(
    `SELECT ${PENDING_PAIR_LIGHT_COLS}
     FROM identity_candidate ic${PENDING_PAIR_WHERE}
       AND (ic.left_video_id = ANY($3) OR ic.right_video_id = ANY($3))
     ORDER BY identity_score DESC, canonical_pair_key ASC`,
    [params.scorerVersion, params.parserVersion, params.videoIds],
  )
  return r.rows
}

/**
 * D-105a-19 stage 5：按轻列 pair id 回查完整行（含 evidence，当前页分量重建 PairCluster<完整行> 用）。
 * status='pending' 守卫：轻列与回查之间并发 confirm/reject 的 pair 自然脱落
 * （buildGroupFromCluster 防御口径兜底，与既有两步查询竞态语义一致）。
 * ORDER BY 与轻列同序（分量内 pair 保序契约由 Service 按轻列序重组保证，此处排序仅稳定输出）。
 */
export async function listPendingPairsByIds(
  db: Pool,
  ids: readonly string[],
): Promise<PendingCandidatePairRow[]> {
  if (ids.length === 0) return []
  const r = await db.query<PendingCandidatePairRow>(
    `SELECT id, left_video_id, right_video_id, identity_score::text, legacy_score::text,
            strong_negative_reasons, evidence_jsonb, group_key
     FROM identity_candidate ic
     WHERE ic.id = ANY($1) AND ic.status = 'pending'
     ORDER BY identity_score DESC, canonical_pair_key ASC`,
    [ids],
  )
  return r.rows
}

/**
 * CHG-VIR-9-C FIX-2（Codex review）：pending 候选全量 count（与 listPendingCandidatePairs 同 WHERE 口径）。
 * 根因：Service 曾用 `groups.length`（当前页行数）当 total，候选超 limit 时前端无法翻页。
 * D-105a-19：列表路径退役（轻列全量自身给出存在性与组数），保留供报表/测试消费。
 */
export async function countPendingCandidatePairs(
  db: Pool,
  params: { scorerVersion: string; parserVersion: string },
): Promise<number> {
  const r = await db.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM identity_candidate ic${PENDING_PAIR_WHERE}`,
    [params.scorerVersion, params.parserVersion],
  )
  return parseInt(r.rows[0]?.count ?? '0', 10)
}
