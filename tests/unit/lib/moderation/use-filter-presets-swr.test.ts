/**
 * @vitest-environment jsdom
 * use-filter-presets-swr.test.ts — ADR-144 / CHG-SN-8-FUP-PRESET-TEAM-EP-B
 * hook 改造 localStorage → DB 双源测试
 *
 * 覆盖（5 用例）：
 *   #1 mount 首次 fetch 调 listFilterPresets + dataSource 切到 'live'
 *   #2 fetch 失败保持 localStorage fallback（dataSource = 'local'）
 *   #3 save 调 createFilterPreset + 本地乐观更新
 *   #4 setDefault 调 apiUpdate + 互斥乐观更新
 *   #5 importLocalToServer 批量上传 + 清 localStorage + 重新 fetch
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

vi.mock('../../../../apps/server-next/src/lib/moderation/filter-presets-api', () => ({
  listFilterPresets: vi.fn(),
  createFilterPreset: vi.fn(),
  updateFilterPreset: vi.fn(),
  deleteFilterPreset: vi.fn(),
}))

import * as api from '../../../../apps/server-next/src/lib/moderation/filter-presets-api'
import { useFilterPresets } from '../../../../apps/server-next/src/lib/moderation/use-filter-presets'

const mockList = api.listFilterPresets as ReturnType<typeof vi.fn>
const mockCreate = api.createFilterPreset as ReturnType<typeof vi.fn>
const mockUpdate = api.updateFilterPreset as ReturnType<typeof vi.fn>

const makeApiPreset = (overrides: Record<string, unknown> = {}) => ({
  id: 'p-1',
  ownerUserId: 'u-1',
  ownerUsername: 'alice',
  name: 'test',
  scope: 'private' as const,
  tab: 'pending' as const,
  query: { type: 'movie' },
  isDefault: false,
  createdAt: '2026-05-22T10:00:00.000Z',
  updatedAt: '2026-05-22T10:00:00.000Z',
  ...overrides,
})

beforeEach(() => {
  vi.clearAllMocks()
  try { window.localStorage.clear() } catch { /* jsdom 兜底 */ }
})

describe('useFilterPresets — DB 双源（ADR-144）', () => {
  it('#1 mount 首次 fetch → dataSource = live', async () => {
    mockList.mockResolvedValueOnce([makeApiPreset()])
    const { result } = renderHook(() => useFilterPresets('pending'))
    await waitFor(() => {
      expect(result.current.dataSource).toBe('live')
      expect(result.current.presets).toHaveLength(1)
      expect(result.current.presets[0].name).toBe('test')
    })
    expect(mockList).toHaveBeenCalled()
  })

  it('#2 fetch 失败 → localStorage fallback（dataSource 维持 local）', async () => {
    window.localStorage.setItem(
      'admin.moderation.presets.v1',
      JSON.stringify({ version: 'v1', presets: [{ id: 'local-1', name: 'local', tab: 'pending', query: {}, isDefault: false, createdAt: '2026-05-01T00:00:00.000Z', updatedAt: '2026-05-01T00:00:00.000Z' }] }),
    )
    mockList.mockRejectedValueOnce(new Error('network error'))
    const { result } = renderHook(() => useFilterPresets('pending'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.dataSource).toBe('local')
    expect(result.current.presets).toHaveLength(1)
    expect(result.current.presets[0].name).toBe('local')
  })

  it('#3 save 调 createFilterPreset + 本地乐观插入', async () => {
    mockList.mockResolvedValueOnce([])
    mockCreate.mockResolvedValueOnce(makeApiPreset({ name: 'new preset' }))
    const { result } = renderHook(() => useFilterPresets('pending'))
    await waitFor(() => expect(result.current.dataSource).toBe('live'))

    await act(async () => {
      await result.current.save({ name: 'new preset', tab: 'pending', query: { type: 'movie' } })
    })
    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
      name: 'new preset',
      tab: 'pending',
      scope: 'private',
    }))
    expect(result.current.presets).toHaveLength(1)
    expect(result.current.presets[0].name).toBe('new preset')
  })

  it('#4 setDefault 调 apiUpdate + 互斥乐观更新', async () => {
    const p1 = makeApiPreset({ id: 'p-1', name: 'p1', isDefault: true })
    const p2 = makeApiPreset({ id: 'p-2', name: 'p2', isDefault: false })
    mockList.mockResolvedValueOnce([p1, p2])
    mockUpdate.mockResolvedValueOnce({ ...p2, isDefault: true })
    const { result } = renderHook(() => useFilterPresets('pending'))
    await waitFor(() => expect(result.current.presets).toHaveLength(2))

    await act(async () => {
      await result.current.setDefault('p-2')
    })
    expect(mockUpdate).toHaveBeenCalledWith('p-2', expect.objectContaining({ isDefault: true }))
    // 互斥：p-1 isDefault 应该被清
    const p1After = result.current.presets.find((p) => p.id === 'p-1')!
    const p2After = result.current.presets.find((p) => p.id === 'p-2')!
    expect(p1After.isDefault).toBe(false)
    expect(p2After.isDefault).toBe(true)
  })

  it('#5 importLocalToServer 批量上传 + 清 localStorage + refetch', async () => {
    window.localStorage.setItem(
      'admin.moderation.presets.v1',
      JSON.stringify({ version: 'v1', presets: [
        { id: 'loc-1', name: 'loc1', tab: 'pending', query: {}, isDefault: false, createdAt: '2026-05-01', updatedAt: '2026-05-01' },
        { id: 'loc-2', name: 'loc2', tab: 'all', query: { type: 'movie' }, isDefault: true, createdAt: '2026-05-01', updatedAt: '2026-05-01' },
      ] }),
    )
    mockList.mockResolvedValueOnce([])  // 初次 mount
    mockCreate.mockResolvedValueOnce(makeApiPreset({ id: 'srv-1', name: 'loc1' }))
    mockCreate.mockResolvedValueOnce(makeApiPreset({ id: 'srv-2', name: 'loc2', tab: 'all' }))
    mockList.mockResolvedValueOnce([
      makeApiPreset({ id: 'srv-1', name: 'loc1' }),
      makeApiPreset({ id: 'srv-2', name: 'loc2', tab: 'all' }),
    ])
    const { result } = renderHook(() => useFilterPresets('pending'))
    await waitFor(() => expect(result.current.dataSource).toBe('live'))
    // 验证 mount 后检测到 localPending
    expect(result.current.localPendingCount).toBe(2)

    let importResult: { imported: number; failed: number } | null = null
    await act(async () => {
      importResult = await result.current.importLocalToServer()
    })
    expect(importResult).toEqual({ imported: 2, failed: 0 })
    expect(mockCreate).toHaveBeenCalledTimes(2)
    // 导入默认 isDefault=false（避免冲突）
    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ isDefault: false }))
    // localStorage 清空
    expect(window.localStorage.getItem('admin.moderation.presets.v1')).toBeNull()
    expect(result.current.localPendingCount).toBe(0)
  })
})
