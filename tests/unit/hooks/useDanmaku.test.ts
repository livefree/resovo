/**
 * tests/unit/hooks/useDanmaku.test.ts
 * CHG-22: useDanmaku 缓存策略、空数据、refetch
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

// ── Mocks ────────────────────────────────────────────────────────

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    getDanmaku: vi.fn(),
    postDanmaku: vi.fn(),
  },
}))

import { apiClient } from '@/lib/api-client'
import { useDanmaku } from '@/hooks/useDanmaku'

const mockClient = apiClient as {
  getDanmaku: ReturnType<typeof vi.fn>
  postDanmaku: ReturnType<typeof vi.fn>
}

// ── 测试数据 ─────────────────────────────────────────────────────

const MOCK_COMMENTS = [
  { time: 10, type: 0 as const, color: '#ffffff', text: '好看' },
  { time: 30, type: 1 as const, color: '#ff0000', text: '顶部弹幕' },
]

// ── sessionStorage mock ───────────────────────────────────────────

const storage: Record<string, string> = {}

beforeEach(() => {
  vi.clearAllMocks()
  Object.keys(storage).forEach((k) => delete storage[k])

  Object.defineProperty(window, 'sessionStorage', {
    value: {
      getItem: (k: string) => storage[k] ?? null,
      setItem: (k: string, v: string) => { storage[k] = v },
      removeItem: (k: string) => { delete storage[k] },
      clear: () => Object.keys(storage).forEach((k) => delete storage[k]),
    },
    writable: true,
  })
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ═══════════════════════════════════════════════════════════════
// useDanmaku
// ═══════════════════════════════════════════════════════════════

describe('useDanmaku', () => {
  it('shortId 为 null 时不发起请求，返回空列表', () => {
    const { result } = renderHook(() => useDanmaku(null, 1))
    expect(result.current.comments).toHaveLength(0)
    expect(mockClient.getDanmaku).not.toHaveBeenCalled()
  })

  it('正常获取弹幕数据', async () => {
    mockClient.getDanmaku.mockResolvedValue({ data: MOCK_COMMENTS })
    const { result } = renderHook(() => useDanmaku('abCD1234', 1))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
      expect(result.current.comments).toHaveLength(2)
    })
    expect(result.current.comments[0].text).toBe('好看')
  })

  it('请求失败时 error 非空，comments 为空', async () => {
    mockClient.getDanmaku.mockRejectedValue(new Error('网络错误'))
    const { result } = renderHook(() => useDanmaku('abCD1234', 1))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
      expect(result.current.error).toBe('弹幕加载失败')
      expect(result.current.comments).toHaveLength(0)
    })
  })

  it('命中 sessionStorage 缓存时不重复请求', async () => {
    mockClient.getDanmaku.mockResolvedValue({ data: MOCK_COMMENTS })

    // 第一次渲染，写入缓存
    const { result, unmount } = renderHook(() => useDanmaku('abCD1234', 1))
    await waitFor(() => expect(result.current.comments).toHaveLength(2))
    unmount()

    vi.clearAllMocks()

    // 第二次渲染，应命中缓存
    const { result: result2 } = renderHook(() => useDanmaku('abCD1234', 1))
    await waitFor(() => expect(result2.current.comments).toHaveLength(2))
    expect(mockClient.getDanmaku).not.toHaveBeenCalled()
  })

  it('换集数时缓存键不同，重新请求', async () => {
    mockClient.getDanmaku.mockResolvedValue({ data: MOCK_COMMENTS })
    const { result, rerender } = renderHook(
      ({ ep }: { ep: number }) => useDanmaku('abCD1234', ep),
      { initialProps: { ep: 1 } }
    )

    await waitFor(() => expect(result.current.comments).toHaveLength(2))
    expect(mockClient.getDanmaku).toHaveBeenCalledWith('abCD1234', 1)

    mockClient.getDanmaku.mockResolvedValue({ data: [MOCK_COMMENTS[0]] })
    rerender({ ep: 2 })

    await waitFor(() => expect(result.current.comments).toHaveLength(1))
    expect(mockClient.getDanmaku).toHaveBeenCalledWith('abCD1234', 2)
  })

  it('refetch 可手动重新请求（跳过缓存时需先清除缓存）', async () => {
    mockClient.getDanmaku.mockResolvedValue({ data: MOCK_COMMENTS })
    const { result } = renderHook(() => useDanmaku('abCD1234', 1))

    await waitFor(() => expect(result.current.comments).toHaveLength(2))
    expect(mockClient.getDanmaku).toHaveBeenCalledTimes(1)

    // 清除缓存后 refetch 应重新请求
    storage['danmaku:abCD1234:1'] = ''

    await act(async () => {
      result.current.refetch()
    })

    await waitFor(() => expect(mockClient.getDanmaku).toHaveBeenCalledTimes(2))
  })
})
