// @vitest-environment jsdom

/**
 * use-filter-presets.test.ts — useFilterPresets hook 单元测试
 *
 * 历史：
 *   - CHG-SN-4-FIX-F 初版：localStorage 同步 CRUD
 *   - CHG-SN-8-FUP-PRESET-TEAM-EP-B / ADR-144：hook 改 async + DB 持久化；
 *     原同步 CRUD/Tab 隔离 5 用例已迁移至
 *     `tests/unit/lib/moderation/use-filter-presets-swr.test.ts`（5 异步用例覆盖
 *     listFilterPresets / createFilterPreset / apiUpdate 互斥 / importLocalToServer）
 *
 * 本文件保留：
 *   - 初始化 3 用例（localStorage seed 仍作 mount fallback；行为不变）
 *   - Tab 隔离 1 用例（defaultPreset 仅当前 tab 查找；不依赖 CRUD）
 *   - summarizeQuery 3 用例（纯函数无依赖）
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

describe('useFilterPresets — Tab 隔离', () => {
  // CHG-SN-8-FUP-PRESET-TEAM-EP-B 后：CRUD 5 用例已迁移至 use-filter-presets-swr.test.ts
  // 本测试改用 localStorage seed 而非 save() 测试 Tab 隔离逻辑（hook 内 isTabMatch 行为不变）

  it('defaultPreset 仅在当前 tab applicable 中查找', () => {
    const seed: FilterPreset = {
      id: 'p-staging-default',
      name: 'StagingDefault',
      tab: 'staging',
      query: {},
      isDefault: true,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 'v1', presets: [seed] }))
    const { result } = renderHook(() => useFilterPresets('pending'))
    // staging tab 预设不应作为 pending tab 的 default
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

  // MODUX-P3-1-B：年代 + 富集状态预设兼容
  it('year/decade/enrichmentStatus 展示', () => {
    const s = summarizeQuery({ year: 2024, decade: 2020, enrichmentStatus: 'complete' })
    expect(s).toContain('2024')
    expect(s).toContain('2020s')
    expect(s).toContain('富集:complete')
  })

  it('旧预设缺新字段 → 向后兼容（undefined 不显示）', () => {
    // 旧预设 JSON 快照仅含旧字段；新字段 undefined 不参与摘要
    const s = summarizeQuery({ type: 'movie' })
    expect(s).toBe('movie')
  })
})
