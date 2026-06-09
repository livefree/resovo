/**
 * admin-nav-counts.types.ts — 侧边栏导航计数聚合 DTO（ADR-190 / NTLG-P0-1）
 *
 * `GET /admin/system/nav-counts` 响应契约：5 模块"待处理积压"批量聚合。
 * 各计数可缺省（角色无权 / 子查询失败 → 进 meta.omitted，逐模块容错 §11 D8）。
 */

/** 侧边栏可计数的 5 个模块键（与 admin-nav href 一一映射，前端接入侧建链） */
export type AdminNavCountKey =
  | 'moderation'
  | 'sources'
  | 'imageHealth'
  | 'userSubmissions'
  | 'merge'

/** 计数主体：每键可选——缺省即该模块无权或降级（badge 不渲染） */
export type AdminNavCounts = Partial<Record<AdminNavCountKey, number>>

/** `GET /admin/system/nav-counts` 完整响应（ADR-190 §端点契约） */
export interface AdminNavCountsResponse {
  readonly data: AdminNavCounts
  readonly meta: {
    /** 是否非全集（有模块被省略） */
    readonly partial: boolean
    /** 被省略的模块键清单（无权 / 子查询失败降级） */
    readonly omitted: AdminNavCountKey[]
  }
}
