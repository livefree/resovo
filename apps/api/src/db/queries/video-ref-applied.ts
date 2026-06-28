/**
 * video-ref-applied.ts — video 级「外部条目是否已落地绑定」谓词契约（ADR-216 DC-216-1）
 *
 * 语义边界（ADR-216 D-216-2，**禁混用**）：
 *   - 本谓词（`videoRefAppliedSql` / `isVideoRefApplied`）= **「该 video 是否已和某 <provider>
 *     外部条目落地绑定」** = video 级 identity 事实，服务「是否匹配 / 发布门禁 / 富集完成」。
 *   - `metadata-status.derive.ts` 的 `METADATA_STATUS_JOIN_SQL` overall = **catalog-first 运营优先级**，
 *     服务「元数据状态列排序 / 待人工确认工作队列」。
 *   用 overall 回答「是否匹配」是范畴错误：catalog auto-consensus 保守判 candidate（externalRefRollup）
 *   会把 auto 匹配已落地行误降级 candidate（实测 60 漂移行经 overall 仅 34 applied / 28 candidate）。
 *
 * 阈值（含 `auto_matched`）：等价旧 `videos.douban_status='matched'`（enrich auto 也写 matched），
 *   不含 candidate / rejected。`VIDEO_REF_APPLIED_MATCH_STATUSES` 是 SQL 与 JS 两侧的**单一真源**。
 *
 * `is_primary`：**强制**（ADR-216 DC-216-1 裁定 / Codex r2 C-1）。041 仅约束「每 (video,provider)
 *   ≤1 primary」，未约束「applied ⟹ is_primary」；实测 live applied ref 全 is_primary（2026-06-27，0 边角），
 *   该 invariant 由 `video-ref-applied.test.ts` 契约测试守护，DB 数据层持续守护见 META-58 诊断。
 */

import type {
  DoubanMatchQualityStatus,
  DoubanStatus,
  ExternalRefMatchStatus,
  ExternalRefProvider,
} from '@/types'

/** applied = video 已落地绑定的 match_status 子集（含 auto = 等价旧列 matched）。SQL/JS 共享真源。 */
export const VIDEO_REF_APPLIED_MATCH_STATUSES = [
  'auto_matched',
  'manual_confirmed',
] as const satisfies readonly ExternalRefMatchStatus[]

/** JS 侧判定：(matchStatus, isPrimary) → 是否 applied。与 `videoRefAppliedSql` 同源（共享阈值常量）。 */
export function isVideoRefApplied(
  matchStatus: ExternalRefMatchStatus | null,
  isPrimary: boolean,
): boolean {
  if (!isPrimary || matchStatus == null) return false
  return (VIDEO_REF_APPLIED_MATCH_STATUSES as readonly string[]).includes(matchStatus)
}

/**
 * SQL 谓词：video 级「是否已和某 <provider> 外部条目落地绑定」。
 *
 * 拼接 `EXISTS` 关联子查询（`ver.video_id = <videoAlias>.id`）。仅引用硬编码 provider 字面量
 * （`ExternalRefProvider` 编译期约束）与阈值常量，不拼任何用户输入（与 `METADATA_STATUS_JOIN_SQL`
 * 同一安全约定）。`videoAlias` 由调用方控制（默认 `v`）。
 */
export function videoRefAppliedSql(provider: ExternalRefProvider, videoAlias = 'v'): string {
  const statusList = VIDEO_REF_APPLIED_MATCH_STATUSES.map((s) => `'${s}'`).join(', ')
  return `EXISTS (SELECT 1 FROM video_external_refs ver` +
    ` WHERE ver.video_id = ${videoAlias}.id` +
    ` AND ver.provider = '${provider}'` +
    ` AND ver.is_primary = true` +
    ` AND ver.match_status IN (${statusList}))`
}

// ── video 级 douban 4 态过滤谓词（ADR-216 D-216-10/13 / META-58-B-1）──────────
//
// 旧 `videos.douban_status` 列（migration 032，4 态 pending|matched|candidate|unmatched）退役，
// **过滤侧**迁 video 级谓词。**douban 真源信号分两源**（与 `videoRefAppliedSql` 纯 refs 契约差异）：
//   - matched / candidate → `video_external_refs`（refs 真源）
//   - unmatched / pending → `meta_quality.douban_match_status`（**越出纯 refs 边界**：refs 无记录的
//     「已 enrich 未命中」vs「从未 enrich」无法仅由 refs 区分，须读 meta_quality 信号列）
//
// **穷尽四分（D-216-13，Codex BLOCK 修正 D-216-10 非穷尽 pending）**：matched > candidate 后，
// NOT matched ∧ NOT candidate 之下按 douban_match_status 二分——`='unmatched'` → unmatched，
// **其余（含 NULL=never enrich / auto_matched/candidate/manual_confirmed 等中间态）→ pending 兜底**
// （`IS DISTINCT FROM 'unmatched'` NULL-safe）。保证旧列每行迁移后恰好一态、四态穷尽互斥，杜绝
// 「全选 4 态仍漏行」gap。
//
// **投影迁移整体延 META-60**（不在本卡）：旧 `SELECT v.douban_status` 派生（moderation 队列投影 /
// VIDEO_FULL_SELECT / videos.status 列表投影）与 derive `statusColumnState` 兜底耦合，须与 derive 列
// 兜底清理统一处理，详见 ADR-216 D-216-13。本卡仅迁**过滤侧**，投影侧暂留旧列（存量漂移行过滤-投影
// 瞬时不一致由 META-57 守卫止新血 + META-56 回填消除）。
//
// bangumi 无对等 meta_quality 信号（D-216-11，grep 零命中 bangumi_match_status），不提供 bangumi
// 4 态谓词，`bangumi_status` 暂留、退役另起 META-61。

/**
 * douban 4 态 JS 判定输入（refs 事实 + meta_quality 信号，诚实暴露越界依赖）。
 * 由 DbVideoRow / `MetadataStatusSourceRow` 投影得出，供 JS↔SQL 对拍（D-216-12 铁律）。
 */
export interface DoubanRefStateInput {
  /** video 有 applied primary douban ref（`isVideoRefApplied` 聚合真值）。 */
  hasApplied: boolean
  /** video 有任意 candidate douban ref（**非 primary**：D-216-10，candidate ref 默认 is_primary=false）。 */
  hasCandidate: boolean
  /** `meta_quality.douban_match_status`（无 meta_quality 或字段缺省时 null = never enrich，归 pending 兜底）。 */
  doubanMatchStatus: DoubanMatchQualityStatus | null
}

/**
 * douban 单态 JS 谓词（逐态独立 boolean，与 `doubanRefStateSql` 逐分支对拍 / D-216-12）。
 * 漂移中间态 4 态皆 false（与 SQL 一致，保守不归虚假态）。
 */
export function matchesDoubanRefState(state: DoubanStatus, input: DoubanRefStateInput): boolean {
  const notMatchedNotCandidate = !input.hasApplied && !input.hasCandidate
  switch (state) {
    case 'matched':
      return input.hasApplied
    case 'candidate':
      return !input.hasApplied && input.hasCandidate
    case 'unmatched':
      return notMatchedNotCandidate && input.doubanMatchStatus === 'unmatched'
    case 'pending':
      return notMatchedNotCandidate && input.doubanMatchStatus !== 'unmatched'
    default:
      return false
  }
}

/** candidate ref 存在性子查询（**不加 is_primary**：D-216-10，candidate 默认非 primary）。 */
function doubanCandidateExistsSql(videoAlias: string): string {
  return `EXISTS (SELECT 1 FROM video_external_refs ver` +
    ` WHERE ver.video_id = ${videoAlias}.id` +
    ` AND ver.provider = 'douban'` +
    ` AND ver.match_status = 'candidate')`
}

/**
 * douban 单态 SQL 谓词（与 `matchesDoubanRefState` 逐分支对拍 / D-216-12）。
 * unmatched/pending 引用 `meta_quality` 信号列（越出纯 refs 边界，见模块上方说明）。
 * 仅拼硬编码字面量（与 `videoRefAppliedSql` 同安全约定，不拼用户输入）。
 */
export function doubanRefStateSql(state: DoubanStatus, videoAlias = 'v'): string {
  const applied = videoRefAppliedSql('douban', videoAlias)
  const candidate = doubanCandidateExistsSql(videoAlias)
  const dms = `(${videoAlias}.meta_quality->>'douban_match_status')`
  switch (state) {
    case 'matched':
      return applied
    case 'candidate':
      return `(NOT ${applied} AND ${candidate})`
    case 'unmatched':
      return `(NOT ${applied} AND NOT ${candidate} AND ${dms} = 'unmatched')`
    case 'pending':
      return `(NOT ${applied} AND NOT ${candidate} AND ${dms} IS DISTINCT FROM 'unmatched')`
    default:
      return 'false'
  }
}

/**
 * douban 多态过滤谓词（旧 `v.douban_status = ANY($::text[])` / `= $` 迁移）。
 * 入参为已校验 `DoubanStatus` 闭集枚举（非用户原始串），逐态 OR 组合内联（安全，同上约定）。
 * 空集防御性返回 `false`（调用方应先 guard length 跳过过滤，不应传空集）。
 */
export function doubanRefStateFilterSql(
  states: readonly DoubanStatus[], videoAlias = 'v',
): string {
  const unique = [...new Set(states)]
  if (unique.length === 0) return 'false'
  if (unique.length === 1) return doubanRefStateSql(unique[0], videoAlias)
  return `(${unique.map((s) => doubanRefStateSql(s, videoAlias)).join(' OR ')})`
}
