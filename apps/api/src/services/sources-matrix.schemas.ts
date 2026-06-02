/**
 * sources-matrix.schemas.ts — /admin/sources 端点 IO 契约 + 信号派生
 * （ADR-117 / CHG-VSR-3 Codex stop-time review FIX：从 SourcesMatrixService 拆出以满足 500 行硬限）
 *
 * 关注点（单一职责：端点契约层）：
 *   - Zod 请求校验 schema（route safeParse 消费）
 *   - 行级 mutation 结果 DTO（RouteTestResult / RouteReprobeResult / RouteDeleteResult）
 *   - aggregateSignal：raw 状态数组 → DualSignalState worst 派生（ADR-117 §决策要点 2 / 业务规则归口 Service 层）
 *
 * 消费方：`routes/admin/sources-matrix.ts`（schema）/ `SourcesMatrixService`（结果 DTO + aggregateSignal）/ 单测（aggregateSignal）。
 */

import { z } from 'zod'
import { SOURCE_QUICK_FILTERS } from '@resovo/types'
import type { DualSignalState } from '@resovo/types'

// ── Zod schema（ADR-117 §端点契约）──────────────────────────────────

// HOTFIX-PATCH-2A §2-EXT-1/2（2026-05-25）：probe/render status 4 态枚举 + csvToArray 范式（参 crawler.runs.ts）
const PROBE_STATUS_VALUES = ['pending', 'ok', 'partial', 'dead'] as const
const RENDER_STATUS_VALUES = ['pending', 'ok', 'partial', 'dead'] as const
const csvToStringArray = <T extends string>(values: readonly T[]) =>
  z.string().optional().transform((s, ctx) => {
    if (!s) return undefined
    const parts = s.split(',').map((p) => p.trim()).filter(Boolean)
    if (parts.length === 0) return undefined
    for (const p of parts) {
      if (!values.includes(p as T)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `invalid value: ${p}` })
        return z.NEVER
      }
    }
    return parts as T[]
  })
// HOTFIX-PATCH-2B（2026-05-25）：siteKey 动态值 csv → array（无 enum 约束 / 字符长度 1-64 安全约束）
const csvToFreeStringArray = (maxLen = 64) =>
  z.string().optional().transform((s, ctx) => {
    if (!s) return undefined
    const parts = s.split(',').map((p) => p.trim()).filter(Boolean)
    if (parts.length === 0) return undefined
    for (const p of parts) {
      if (p.length > maxLen) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `value too long: ${p}` })
        return z.NEVER
      }
    }
    return parts
  })
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/
// query 布尔（z.coerce.boolean 把 'false' 也判 true，故显式枚举 / 参 routes/admin/videos.ts queryBool）
const queryBool = z.enum(['true', 'false']).optional().transform((v) => (v === undefined ? undefined : v === 'true'))

export const VideoGroupsQuerySchema = z.object({
  page:          z.coerce.number().int().min(1).optional().default(1),
  limit:         z.coerce.number().int().min(1).max(100).optional().default(20),
  keyword:       z.string().optional(),
  // CHG-VSR-5-B：segment 四 Tab 已删（quickFilters/lowQuality 取代）
  // HOTFIX-PATCH-2B（2026-05-25）：siteKey 单值 → 数组（distinct 端点首次消费实证 / EXISTS ANY()）
  siteKey:       csvToFreeStringArray(64),
  // HOTFIX-PATCH-2A §2-EXT-1/2：CSV → enum 数组（参 crawler.runs.ts csvToArray）/ raw EXISTS ANY()
  probeStatus:   csvToStringArray(PROBE_STATUS_VALUES),
  renderStatus:  csvToStringArray(RENDER_STATUS_VALUES),
  // HOTFIX-PATCH-2A §1-BUG-3：updatedAt 日期范围（YYYY-MM-DD）/ HAVING MAX(vs.updated_at) >= / <=
  updatedAtFrom: z.string().regex(ISO_DATE_RE, 'updatedAtFrom 必须是 YYYY-MM-DD 格式').optional(),
  updatedAtTo:   z.string().regex(ISO_DATE_RE, 'updatedAtTo 必须是 YYYY-MM-DD 格式').optional(),
  // CHG-VSR-3 / D-117-VSR3-5：quickFilters KPI 卡快捷筛选（CSV → SourceQuickFilter 数组 / WHERE EXISTS 可组合 AND）
  quickFilters:  csvToStringArray(SOURCE_QUICK_FILTERS),
  // CHG-VSR-3 / D-117-VSR3-5：lowQuality 质量列 boolean 筛选（与 quickFilters 'low_quality' OR 合流单份谓词）
  lowQuality:    queryBool,
  // CHG-VSR-3：lastChecked 日期范围（YYYY-MM-DD）/ HAVING MAX(vs.last_probed_at) >= / <（CHG-VSR-1 "卡 3 实现"）
  lastCheckedFrom: z.string().regex(ISO_DATE_RE, 'lastCheckedFrom 必须是 YYYY-MM-DD 格式').optional(),
  lastCheckedTo:   z.string().regex(ISO_DATE_RE, 'lastCheckedTo 必须是 YYYY-MM-DD 格式').optional(),
  // ADR-150 阶段 5 EP-4 + CHG-VSR-3 / D-117-VSR3-6：sort 白名单扩 activeSources/quality/lastChecked
  sortField:     z.enum(['video', 'lineCount', 'sourceCount', 'updated_at', 'activeSources', 'quality', 'lastChecked']).optional(),
  sortDir:       z.enum(['asc', 'desc']).optional(),
})

export const UpsertAliasSchema = z.object({
  displayName: z.string().min(1, '别名不能为空').max(100, '别名过长'),
  // CHG-368-B-A2b / ADR-164 §5.4：扩 codename + priority 可选字段
  codename: z.string().min(1).max(20)
    .regex(/^[一-龥A-Za-z0-9-]+$/, 'codename 仅允许中文/英文/数字/连字符')
    .nullable().optional(),
  priority: z.coerce.number().int().min(0, 'priority ≥ 0').max(100, 'priority ≤ 100').optional(),
}).strict()

/** CHG-368-B-A2b / ADR-164 §5.4：POST retire body */
export const RetireAliasSchema = z.object({
  reason: z.string().max(200, '退役原因 ≤ 200 字符').optional(),
}).strict()

/** CHG-368-B-A2b / ADR-164 §5.4：PUT priority body */
export const UpdatePriorityAliasSchema = z.object({
  priority: z.coerce.number().int().min(0, 'priority ≥ 0').max(100, 'priority ≤ 100'),
}).strict()

// ADR-117 AMENDMENT 2026-05-19：path 校验同 UpsertAliasParamsSchema siteKey 字段
export const RoutesBySiteParamsSchema = z.object({
  siteKey: z.string().min(1).max(100),
}).strict()

// ADR-117 AMENDMENT 2 2026-05-19 / CHG-SN-7-REDO-01-E2：row 7/8/9 path 共享 schema
export const RouteActionParamsSchema = z.object({
  siteKey: z.string().min(1).max(100),
  sourceName: z.string().min(1).max(200),
}).strict()

// ADR-158 / CHG-351-A：单源 inline probe + render-check path 共享 schema（R2 / .uuid() 422 前置 vs 500 fallthrough）
export const SingleSourceParamsSchema = z.object({
  id: z.string().uuid(),
}).strict()

// ── 行级 mutation 结果 DTO（ADR-117 AMENDMENT 2）──────────────────────

export interface RouteTestResult {
  readonly ok: boolean
  readonly latencyMs: number | null
  readonly sampleVideoId: string | null
  readonly probeJobId: string
}
export interface RouteReprobeResult {
  readonly probeJobId: string
  readonly queuedCount: number
}
export interface RouteDeleteResult {
  readonly deletedCount: number
  readonly deletedIds: readonly string[]
}

// ── 聚合信号状态推导（ADR-117 §决策要点 2 / CHG-SN-5-11-PATCH-2 P0-2 业务逻辑归口 Service）─

/**
 * 派生行级聚合信号：
 * - 空 → 'pending'
 * - 全 ok → 'ok'
 * - 全 dead → 'dead'
 * - 含 ok/partial → 'partial'
 * - 其他 → 'pending'
 */
export function aggregateSignal(statuses: readonly string[]): DualSignalState {
  if (statuses.length === 0) return 'pending'
  if (statuses.every((s) => s === 'ok')) return 'ok'
  if (statuses.every((s) => s === 'dead')) return 'dead'
  if (statuses.some((s) => s === 'ok' || s === 'partial')) return 'partial'
  return 'pending'
}
