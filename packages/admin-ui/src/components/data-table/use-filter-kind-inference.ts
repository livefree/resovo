/**
 * use-filter-kind-inference.ts — ADR-150 阶段 2 / D-150-2 自动过滤控件类型推导
 *
 * 输入：column（含 accessor + 可选显式 filterKind）+ rows[]（数据源采样）
 * 输出：AutoFilterKind = 'enum' | 'text' | 'number' | 'date'
 *
 * 推导算法（5 边界 / Opus 子代理设计 §2.2）：
 *   1. 显式覆盖：column.filterKind !== undefined → 直接返回
 *   2. SSR fallback：rows.length === 0 → 'text'
 *   3. 采样首 30 行非空值（filter null / undefined）→ samples.length === 0 时 → 'text'
 *   4. 类型分支：
 *      - 全部 typeof === 'number' → 'number'
 *      - 全部 typeof === 'boolean' → 'enum'
 *      - 全部 typeof === 'string':
 *          - 全部命中 ISO 日期正则 → 'date'
 *          - distinct ≤ 20 → 'enum'
 *          - 其余 → 'text'
 *      - mixed type（首行 number 但第 5 行 string）→ 'text' + dev warn
 *
 * 性能：O(30) 常数 / useMemo 依赖 [column.id, column.filterKind, rows[0], rows.length]
 * SSR：首屏 rows=0 fallback 'text' / hydration 后 rows 到达重算（popover lazy mount 避免突变）
 */

import { useMemo } from 'react'
import type { AutoFilterKind, TableColumn } from './types'

const SAMPLE_SIZE = 30
const ENUM_DISTINCT_THRESHOLD = 20
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?/

export function useFilterKindInference<T>(
  column: TableColumn<T>,
  rows: readonly T[],
): AutoFilterKind {
  return useMemo(() => {
    if (column.filterKind !== undefined) return column.filterKind
    if (rows.length === 0) return 'text'

    const samples: unknown[] = []
    const upper = Math.min(rows.length, SAMPLE_SIZE)
    for (let i = 0; i < upper; i++) {
      let raw: unknown
      try {
        raw = column.accessor(rows[i] as T)
      } catch {
        if (process.env.NODE_ENV === 'development') {
          // eslint-disable-next-line no-console
          console.warn(`[useFilterKindInference] accessor throw on column "${column.id}" row ${i} → fallback 'text'`)
        }
        return 'text'
      }
      if (raw === null || raw === undefined) continue
      samples.push(raw)
    }
    if (samples.length === 0) return 'text'

    const firstType = typeof samples[0]
    const allSameType = samples.every((v) => typeof v === firstType)
    if (!allSameType) {
      if (process.env.NODE_ENV === 'development') {
        // eslint-disable-next-line no-console
        console.warn(
          `[useFilterKindInference] column "${column.id}" mixed type samples ` +
          `(first=${firstType}, others differ) → fallback 'text'. ` +
          `Provide explicit filterKind to suppress.`,
        )
      }
      return 'text'
    }

    if (firstType === 'number') return 'number'
    if (firstType === 'boolean') return 'enum'
    if (firstType === 'string') {
      const strings = samples as string[]
      if (strings.every((s) => ISO_DATE_REGEX.test(s))) return 'date'
      const distinct = new Set(strings).size
      if (distinct <= ENUM_DISTINCT_THRESHOLD) return 'enum'
      return 'text'
    }
    return 'text'
  }, [column, rows])
}
