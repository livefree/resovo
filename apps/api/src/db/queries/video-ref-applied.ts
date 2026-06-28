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

import type { ExternalRefMatchStatus, ExternalRefProvider } from '@/types'

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
