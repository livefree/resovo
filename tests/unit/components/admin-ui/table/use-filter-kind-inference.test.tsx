/**
 * use-filter-kind-inference.test.tsx — ADR-150 阶段 2 / EP-1 Step 2 单测
 *
 * 范围：8 推导边界用例（Opus 子代理设计 §6 #1-#8）
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useFilterKindInference } from '../../../../../packages/admin-ui/src/components/data-table/use-filter-kind-inference'
import type { TableColumn } from '../../../../../packages/admin-ui/src/components/data-table/types'

type R = { v: unknown }
const col = (id: string, accessor: (r: R) => unknown, extra: Partial<TableColumn<R>> = {}): TableColumn<R> => ({
  id, header: id, accessor, ...extra,
})

describe('useFilterKindInference (ADR-150 D-150-2)', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>
  beforeEach(() => { warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {}) })
  afterEach(() => { warnSpy.mockRestore() })

  it('#1 filterKind 显式 enum → 跳过采样直接返回', () => {
    const c = col('x', (r) => r.v, { filterKind: 'enum' })
    const { result } = renderHook(() => useFilterKindInference(c, [{ v: 1 }, { v: 2 }]))
    expect(result.current).toBe('enum')
  })

  it('#2 SSR rows=0 → fallback text', () => {
    const c = col('x', (r) => r.v)
    const { result } = renderHook(() => useFilterKindInference(c, []))
    expect(result.current).toBe('text')
  })

  it('#3 rows 首行 number + 同类型 → number', () => {
    const c = col('x', (r) => r.v)
    const rows = Array.from({ length: 10 }, (_, i) => ({ v: i }))
    const { result } = renderHook(() => useFilterKindInference(c, rows))
    expect(result.current).toBe('number')
  })

  it('#4 rows 首行 boolean → enum', () => {
    const c = col('x', (r) => r.v)
    const rows = [{ v: true }, { v: false }, { v: true }]
    const { result } = renderHook(() => useFilterKindInference(c, rows))
    expect(result.current).toBe('enum')
  })

  it('#5 rows 首行 ISO date string → date', () => {
    const c = col('x', (r) => r.v)
    const rows = [{ v: '2026-05-24' }, { v: '2026-05-23T12:34' }, { v: '2026-05-22' }]
    const { result } = renderHook(() => useFilterKindInference(c, rows))
    expect(result.current).toBe('date')
  })

  it('#6 rows string + distinct ≤ 20 → enum', () => {
    const c = col('x', (r) => r.v)
    const rows = Array.from({ length: 30 }, (_, i) => ({ v: `status-${i % 5}` }))
    const { result } = renderHook(() => useFilterKindInference(c, rows))
    expect(result.current).toBe('enum')
  })

  it('#7 rows string + distinct > 20 → text', () => {
    const c = col('x', (r) => r.v)
    const rows = Array.from({ length: 30 }, (_, i) => ({ v: `unique-${i}` }))
    const { result } = renderHook(() => useFilterKindInference(c, rows))
    expect(result.current).toBe('text')
  })

  it('#8 mixed type → fallback text + dev warn', () => {
    const original = process.env.NODE_ENV
    process.env.NODE_ENV = 'development'
    try {
      const c = col('x', (r) => r.v)
      const rows = [{ v: 1 }, { v: 'two' }, { v: 3 }]
      const { result } = renderHook(() => useFilterKindInference(c, rows))
      expect(result.current).toBe('text')
      expect(warnSpy).toHaveBeenCalled()
    } finally {
      process.env.NODE_ENV = original
    }
  })

  it('extra: rows 全 null/undefined → fallback text', () => {
    const c = col('x', (r) => r.v)
    const rows = [{ v: null }, { v: undefined }, { v: null }]
    const { result } = renderHook(() => useFilterKindInference(c, rows))
    expect(result.current).toBe('text')
  })

  it('extra: accessor throw → fallback text', () => {
    const original = process.env.NODE_ENV
    process.env.NODE_ENV = 'development'
    try {
      const c = col('x', () => { throw new Error('boom') })
      const { result } = renderHook(() => useFilterKindInference(c, [{ v: 1 }, { v: 2 }]))
      expect(result.current).toBe('text')
      expect(warnSpy).toHaveBeenCalled()
    } finally {
      process.env.NODE_ENV = original
    }
  })
})
