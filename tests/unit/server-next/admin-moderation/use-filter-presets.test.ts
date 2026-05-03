// @vitest-environment jsdom

/**
 * use-filter-presets.test.ts — useFilterPresets hook 单元测试（CHG-SN-4-FIX-F）
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useFilterPresets, summarizeQuery } from '../../../../apps/server-next/src/lib/moderation/use-filter-presets'
import type { FilterPreset } from '../../../../apps/server-next/src/lib/moderation/use-filter-presets'

const STORAGE_KEY = 'admin.moderation.presets.v1'

beforeEach(() => {
  window.localStorage.clear()
})

describe('useFilterPresets — 初始化', () => {
  it('localStorage 为空 → 初始 presets 空数组', () => {
    const { result } = renderHook(() => useFilterPresets('pending'))
    expect(result.current.presets).toEqual([])
    expect(result.current.applicablePresets).toEqual([])
    expect(result.current.defaultPreset).toBeNull()
  })

  it('localStorage 已有数据 → 读取并填充', () => {
    const seed: FilterPreset = {
      id: 'p1',
      name: '种子',
      tab: 'pending',
      query: { type: 'movie' },
      isDefault: true,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 'v1', presets: [seed] }))
    const { result } = renderHook(() => useFilterPresets('pending'))
    expect(result.current.presets).toHaveLength(1)
    expect(result.current.defaultPreset?.id).toBe('p1')
  })

  it('localStorage 数据 schema 不合规 → 降级为空', () => {
    window.localStorage.setItem(STORAGE_KEY, '{"invalid":true}')
    const { result } = renderHook(() => useFilterPresets('pending'))
    expect(result.current.presets).toEqual([])
  })
})

describe('useFilterPresets — CRUD', () => {
  it('save 新增预设 → presets +1 + 写入 localStorage', () => {
    const { result } = renderHook(() => useFilterPresets('pending'))
    act(() => {
      result.current.save({ name: '高优先级', tab: 'pending', query: { needsManualReview: true } })
    })
    expect(result.current.presets).toHaveLength(1)
    expect(result.current.presets[0]?.name).toBe('高优先级')
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY)!)
    expect(stored.presets).toHaveLength(1)
  })

  it('设默认时清除同 tab 已有默认（互斥）', () => {
    const { result } = renderHook(() => useFilterPresets('pending'))
    let firstId = ''
    act(() => {
      const p = result.current.save({ name: 'A', tab: 'pending', query: {}, isDefault: true })
      firstId = p.id
    })
    act(() => {
      result.current.save({ name: 'B', tab: 'pending', query: {}, isDefault: true })
    })
    const a = result.current.presets.find((p) => p.id === firstId)
    expect(a?.isDefault).toBe(false)
    const defaults = result.current.presets.filter((p) => p.isDefault)
    expect(defaults).toHaveLength(1)
    expect(defaults[0]?.name).toBe('B')
  })

  it('remove → presets -1 + 返回被删条供撤销', () => {
    const { result } = renderHook(() => useFilterPresets('pending'))
    let id = ''
    act(() => {
      id = result.current.save({ name: 'X', tab: 'pending', query: {} }).id
    })
    let removed: FilterPreset | null = null
    act(() => {
      removed = result.current.remove(id)
    })
    expect(removed).not.toBeNull()
    expect(removed!.name).toBe('X')
    expect(result.current.presets).toHaveLength(0)
  })

  it('restore → 撤销删除恢复条目', () => {
    const { result } = renderHook(() => useFilterPresets('pending'))
    let id = ''
    act(() => {
      id = result.current.save({ name: 'Y', tab: 'pending', query: {} }).id
    })
    let removed: FilterPreset | null = null
    act(() => {
      removed = result.current.remove(id)
    })
    act(() => {
      result.current.restore(removed!)
    })
    expect(result.current.presets).toHaveLength(1)
    expect(result.current.presets[0]?.id).toBe(id)
  })
})

describe('useFilterPresets — Tab 隔离', () => {
  it('currentTab=pending 仅返回 pending + all 的预设', () => {
    const { result } = renderHook(() => useFilterPresets('pending'))
    act(() => {
      result.current.save({ name: 'P', tab: 'pending', query: {} })
      result.current.save({ name: 'S', tab: 'staging', query: {} })
      result.current.save({ name: 'A', tab: 'all', query: {} })
    })
    const names = result.current.applicablePresets.map((p) => p.name).sort()
    expect(names).toEqual(['A', 'P'])
  })

  it('defaultPreset 仅在当前 tab applicable 中查找', () => {
    const { result } = renderHook(() => useFilterPresets('pending'))
    act(() => {
      result.current.save({ name: 'StagingDefault', tab: 'staging', query: {}, isDefault: true })
    })
    expect(result.current.defaultPreset).toBeNull()
  })
})

describe('summarizeQuery', () => {
  it('空 query → "无筛选"', () => {
    expect(summarizeQuery({})).toBe('无筛选')
  })

  it('多字段拼接', () => {
    const s = summarizeQuery({ type: 'movie', sourceCheckStatus: 'partial', hasStaffNote: true })
    expect(s).toContain('movie')
    expect(s).toContain('source:partial')
    expect(s).toContain('有备注')
  })

  it('hasStaffNote=false 不显示（仅 true 显示）', () => {
    const s = summarizeQuery({ hasStaffNote: false })
    expect(s).toBe('无筛选')
  })
})
