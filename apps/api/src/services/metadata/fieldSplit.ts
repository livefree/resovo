/**
 * fieldSplit.ts — catalog 更新字段「身份/type」与「内容标量」拆分原语
 *
 * META-49-B1（ADR-205 方案 X / arch-reviewer a2eb1cd50a6e28838）：reconcile 重构把内容标量字段
 * 剥离到上层统一裁决，但**身份副作用必须留各源 service 自有事务**：
 * - cache 列（doubanId/bangumiSubjectId/tmdbId/imdbId）：经 safeUpdate 触发 catalog_external_refs
 *   同事务写（ADR-177）+ fill-if-empty 白名单（ADR-186），不进 reconcile trust 加权。
 * - type：走 ADR-203 caller 层 fill-if-default 专属路径，不进 reconcile（D-205-5）。
 *
 * 内容标量字段（title/description/coverUrl/genres/country/rating/图片…）= reconcile 白名单，
 * 上抛 proposedFields；B1 过渡期由 enrich 层立即 safeUpdate（行为等价），B2 换 reconcile 加权。
 */

import type { CatalogUpdateData } from '@/api/db/queries/mediaCatalog'

/** 留各源 service 事务内写的「身份/type」字段键（不进 reconcile）。 */
const IDENTITY_TYPE_KEYS: ReadonlySet<string> = new Set([
  'doubanId',
  'bangumiSubjectId',
  'tmdbId',
  'imdbId',
  'type',
])

/**
 * 把 catalog 更新字段拆为「身份/type（identityFields）」与「内容标量（contentFields）」两组。
 * 仅按键分流，不改值；调用方各自决定 identityFields 留事务写 / contentFields 上抛。
 */
export function splitIdentityScalarFields(fields: CatalogUpdateData): {
  identityFields: CatalogUpdateData
  contentFields: CatalogUpdateData
} {
  const identityFields: CatalogUpdateData = {}
  const contentFields: CatalogUpdateData = {}
  for (const [key, value] of Object.entries(fields)) {
    if (IDENTITY_TYPE_KEYS.has(key)) {
      ;(identityFields as Record<string, unknown>)[key] = value
    } else {
      ;(contentFields as Record<string, unknown>)[key] = value
    }
  }
  return { identityFields, contentFields }
}
