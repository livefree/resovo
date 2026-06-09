/**
 * @vitest-environment jsdom
 * admin-shell-nav-counts.test.ts — useAdminNavCounts hook 单测（ADR-190 / NTLG-P0-1-B）
 *
 * 覆盖（5 用例）：
 *   #1 mount fetch → 5 模块 count 映射成 href→count Map
 *   #2 count=0 / 缺省（无权·降级）不入 Map（无 badge）
 *   #3 加载前（counts=null）→ 空 Map
 *   #4 401/403 静默降级（不 warn，Map 保持空）
 *   #5 其他错误 → console.warn 留痕 + Map 保持空
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

vi.mock('../../../apps/server-next/src/lib/api-client', () => ({
  apiClient: { get: vi.fn() },
  ApiClientError: class ApiClientError extends Error {
    constructor(public code: string, message: string, public status: number) {
      super(message)
      this.name = 'ApiClientError'
    }
  },
}))

import * as apiClientMod from '../../../apps/server-next/src/lib/api-client'
import { useAdminNavCounts } from '../../../apps/server-next/src/lib/admin-shell-nav-counts'

const mockGet = apiClientMod.apiClient.get as ReturnType<typeof vi.fn>
const { ApiClientError } = apiClientMod

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('useAdminNavCounts', () => {
  it('#1 mount fetch → 5 模块 count 映射成 href→count Map', async () => {
    mockGet.mockResolvedValue({
      data: { moderation: 484, sources: 1939, imageHealth: 597, userSubmissions: 12, merge: 6 },
      meta: { partial: false, omitted: [] },
    })
    const { result } = renderHook(() => useAdminNavCounts())
    await waitFor(() => {
      const map = result.current()
      expect(map.get('/admin/moderation')).toBe(484)
      expect(map.get('/admin/sources')).toBe(1939)
      expect(map.get('/admin/image-health')).toBe(597)
      expect(map.get('/admin/user-submissions')).toBe(12)
      expect(map.get('/admin/merge')).toBe(6)
    })
    expect(mockGet).toHaveBeenCalledWith('/admin/system/nav-counts')
  })

  it('#2 count=0 / 缺省（无权·降级）不入 Map', async () => {
    mockGet.mockResolvedValue({
      // imageHealth/merge 缺省（moderator 角色省略）；sources=0
      data: { moderation: 484, sources: 0, userSubmissions: 12 },
      meta: { partial: true, omitted: ['imageHealth', 'merge'] },
    })
    const { result } = renderHook(() => useAdminNavCounts())
    await waitFor(() => expect(result.current().get('/admin/moderation')).toBe(484))
    const map = result.current()
    expect(map.has('/admin/sources')).toBe(false)        // 0 不入 Map
    expect(map.has('/admin/image-health')).toBe(false)   // 缺省不入 Map
    expect(map.has('/admin/merge')).toBe(false)
    expect(map.get('/admin/user-submissions')).toBe(12)
  })

  it('#3 加载前（counts=null）→ 空 Map', () => {
    mockGet.mockReturnValue(new Promise(() => { /* never resolves */ }))
    const { result } = renderHook(() => useAdminNavCounts())
    expect(result.current().size).toBe(0)
  })

  it('#4 401/403 静默降级（不 warn，Map 空）', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    mockGet.mockRejectedValue(new ApiClientError('FORBIDDEN', 'forbidden', 403))
    const { result } = renderHook(() => useAdminNavCounts())
    await waitFor(() => expect(mockGet).toHaveBeenCalled())
    expect(result.current().size).toBe(0)
    expect(warnSpy).not.toHaveBeenCalled()
  })

  it('#5 其他错误 → console.warn 留痕 + Map 空', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    mockGet.mockRejectedValue(new Error('500 server error'))
    const { result } = renderHook(() => useAdminNavCounts())
    await waitFor(() => expect(warnSpy).toHaveBeenCalled())
    expect(result.current().size).toBe(0)
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('[useAdminNavCounts]'),
      expect.any(Error),
    )
  })
})
