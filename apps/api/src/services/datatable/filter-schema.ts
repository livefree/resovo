/**
 * filter-schema.ts — ADR-150 阶段 3 / EP-2 Step 2
 *
 * DataTable 列固有自动过滤的统一过滤参数 schema（D-150-4）。
 * 替代各路由 ad-hoc zod schema / 后端 Service 通过 FILTER_FIELDS 白名单消费。
 *
 * 前端 → 后端：URL `?filters=<encoded-json>`
 * 后端 zod parse + 校验 6 种 FilterValue / FILTER_FIELDS 白名单 lookup miss 静默忽略（防 DT 误传）
 */

import { z } from 'zod'

export const FilterValueSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('text'), value: z.string().max(200) }),
  z.object({ kind: z.literal('number'), value: z.number() }),
  z.object({ kind: z.literal('bool'), value: z.boolean() }),
  z.object({ kind: z.literal('enum'), value: z.array(z.string().max(64)).max(50) }),
  z.object({
    kind: z.literal('range'),
    min: z.number().optional(),
    max: z.number().optional(),
  }),
  z.object({
    kind: z.literal('date-range'),
    from: z.string().datetime({ offset: true }).optional(),
    to: z.string().datetime({ offset: true }).optional(),
  }),
])

export type FilterValue = z.infer<typeof FilterValueSchema>

/**
 * DtFiltersSchema — URL query param `filters` 解析为 Record<filterKey, FilterValue>。
 * 输入是 URL-encoded JSON 字符串；缺省 / 空字符串 / 解析失败 → undefined（route 静默接受）。
 *
 * 用法（route）：
 *   const QuerySchema = z.object({ ..., filters: DtFiltersSchema })
 *   const parsed = QuerySchema.safeParse(request.query)
 *   parsed.data.filters // Record<string, FilterValue> | undefined
 */
export const DtFiltersSchema = z
  .string()
  .optional()
  .transform((s, ctx) => {
    if (!s) return undefined
    let parsed: unknown
    try {
      parsed = JSON.parse(decodeURIComponent(s))
    } catch {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'filters JSON parse failed' })
      return z.NEVER
    }
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'filters must be object' })
      return z.NEVER
    }
    const result: Record<string, FilterValue> = {}
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      const valid = FilterValueSchema.safeParse(v)
      if (!valid.success) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `filter "${k}" invalid: ${valid.error.message}` })
        return z.NEVER
      }
      result[k] = valid.data
    }
    return result
  })
