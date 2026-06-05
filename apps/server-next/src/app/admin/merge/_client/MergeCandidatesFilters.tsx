'use client'

/**
 * MergeCandidatesFilters.tsx — 合并工作区表格检索接线（CHG-VIR-16-TBL-FE / D-105a-19）
 *
 * 自 MergeCandidatesSection 拆出（500 行红线）：
 *   - buildCandidateSearchParams：filters Map → 检索参数纯函数（相似度 % → 0..1 / 候选数
 *     整数 ≥2 / q 文本；min>max 前端交换规范化——后端 zod refine 仍严格 422，
 *     输入顺序不应砸表格到错误态）
 *   - MergeSearchInput：工具条搜索框（→ filters['q'] kind text；复用共享原语
 *     DataTableSearchInput〔D-149-8 IME composition + debounce + Enter〕，本层仅
 *     filters Map read-modify-write 适配，不丢并发列筛选 + 外部清除同步回显）
 *
 * getRange/getTextValue 与 VideoFilterFields 同款局部 helper（第 2 处出现，
 * 第 3 处时按共享规则上提 admin-ui / lib 共享层）。
 */

import { useCallback, useRef } from 'react'
import { DataTableSearchInput, type FilterValue } from '@resovo/admin-ui'
import type { ListCandidatesParams } from '@resovo/types'

// ── filters Map → 检索参数 ─────────────────────────────────────────

function getRange(filters: ReadonlyMap<string, FilterValue>, key: string): { min?: number; max?: number } | undefined {
  const v = filters.get(key)
  return v?.kind === 'range' ? { min: v.min, max: v.max } : undefined
}

function getTextValue(filters: ReadonlyMap<string, FilterValue>, key: string): string | undefined {
  const v = filters.get(key)
  return v?.kind === 'text' && v.value ? v.value : undefined
}

/** min>max 交换规范化（输入顺序防御） */
function normalizeRange(r: { min?: number; max?: number } | undefined): { min?: number; max?: number } | undefined {
  if (!r) return undefined
  if (r.min !== undefined && r.max !== undefined && r.min > r.max) return { min: r.max, max: r.min }
  return r
}

/** 相似度筛选 UI 以百分比输入（列显示 %）→ 请求 0..1（÷100 + clamp 防 zod 422） */
function pctToScore(v: number | undefined): number | undefined {
  if (v === undefined) return undefined
  return Math.min(Math.max(v / 100, 0), 1)
}

/** 候选数筛选整数化 + 下限 2（折叠组成员数 ≥2，zod min(2) 同口径防 422） */
function clampVideoCount(v: number | undefined): number | undefined {
  if (v === undefined) return undefined
  return Math.max(2, Math.round(v))
}

export type CandidateSearchParams = Pick<
  ListCandidatesParams,
  'identityScoreMin' | 'identityScoreMax' | 'videoCountMin' | 'videoCountMax' | 'q'
>

/** D-105a-19：filters Map → 组级检索参数（缺省维度不发送，零参数 = {}） */
export function buildCandidateSearchParams(filters: ReadonlyMap<string, FilterValue>): CandidateSearchParams {
  const idRange = normalizeRange(getRange(filters, 'identityScore'))
  const vcRange = normalizeRange(getRange(filters, 'videoCount'))
  const identityScoreMin = pctToScore(idRange?.min)
  const identityScoreMax = pctToScore(idRange?.max)
  const videoCountMin = clampVideoCount(vcRange?.min)
  const videoCountMax = clampVideoCount(vcRange?.max)
  const q = getTextValue(filters, 'q')
  return {
    ...(identityScoreMin !== undefined ? { identityScoreMin } : {}),
    ...(identityScoreMax !== undefined ? { identityScoreMax } : {}),
    ...(videoCountMin !== undefined ? { videoCountMin } : {}),
    ...(videoCountMax !== undefined ? { videoCountMax } : {}),
    ...(q ? { q } : {}),
  }
}

// ── 工具条搜索框 ───────────────────────────────────────────────────

/**
 * 工具条搜索框（→ filters['q']）。「作品」列 text filter 共用同一 q 通道
 * （ADR-105a AMENDMENT 遗留 ③ / VideoColumns title 列先例）。
 * debounce/IME/Enter 行为由共享原语 DataTableSearchInput 承担（D-149-8）；
 * 本层 read-modify-write filters Map（不丢并发列筛选），外部清除经 value 受控合约回显。
 */
export function MergeSearchInput({ filters, onCommit }: {
  readonly filters: ReadonlyMap<string, FilterValue>
  readonly onCommit: (next: ReadonlyMap<string, FilterValue>) => void
}) {
  // filtersRef 保最新 filters：commit 时 read-modify-write，不覆盖并发列筛选
  const filtersRef = useRef(filters)
  filtersRef.current = filters

  const handleChange = useCallback((value: string) => {
    const next = new Map(filtersRef.current)
    const trimmed = value.trim()
    const committed = getTextValue(filtersRef.current, 'q') ?? ''
    if (trimmed === committed) return // debounce 后值未变（含初始空）→ 零提交
    if (trimmed) next.set('q', { kind: 'text', value: trimmed })
    else next.delete('q')
    onCommit(next)
  }, [onCommit])

  return (
    <DataTableSearchInput
      size="sm"
      value={getTextValue(filters, 'q') ?? ''}
      onChange={handleChange}
      placeholder="搜索作品标题"
      aria-label="搜索作品标题"
      data-testid="merge-candidates-search"
    />
  )
}
