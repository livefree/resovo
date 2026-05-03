// @vitest-environment jsdom

/**
 * use-images.test.ts — useVideoImages hook 单元测试（CHG-SN-4-08）
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

vi.mock('../../../../../apps/server-next/src/lib/videos/api', () => ({
  getVideoImages: vi.fn(),
  updateVideoImage: vi.fn(),
}))

import * as api from '../../../../../apps/server-next/src/lib/videos/api'
import { useVideoImages } from '../../../../../apps/server-next/src/lib/videos/use-images'
import type { VideoImagesData } from '../../../../../apps/server-next/src/lib/videos/use-images'

function makeImages(overrides: Partial<VideoImagesData> = {}): VideoImagesData {
  return {
    poster:          { url: 'https://cdn.example.com/poster.jpg', status: 'ok' },
    backdrop:        { url: null, status: null },
    logo:            { url: null, status: null },
    banner_backdrop: { url: null, status: null },
    lastStatusUpdatedAt: '2024-01-01T00:00:00Z',
    ...overrides,
  }
}

describe('useVideoImages', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('加载成功后 images 就位', async () => {
    const images = makeImages()
    vi.mocked(api.getVideoImages).mockResolvedValue(images)

    const { result } = renderHook(() => useVideoImages('v1'))
    expect(result.current[0].loading).toBe(true)

    await act(async () => { await new Promise((r) => setTimeout(r, 0)) })

    expect(result.current[0].loading).toBe(false)
    expect(result.current[0].images?.poster.url).toBe('https://cdn.example.com/poster.jpg')
  })

  it('加载失败时 error 就位', async () => {
    vi.mocked(api.getVideoImages).mockRejectedValue(new Error('网络错误'))

    const { result } = renderHook(() => useVideoImages('v1'))
    await act(async () => { await new Promise((r) => setTimeout(r, 0)) })

    expect(result.current[0].error).toBeInstanceOf(Error)
  })

  it('update：成功后 images 局部更新为 pending_review', async () => {
    vi.mocked(api.getVideoImages).mockResolvedValue(makeImages())
    vi.mocked(api.updateVideoImage).mockResolvedValue({
      data: { kind: 'poster', url: 'https://cdn.example.com/new-poster.jpg', status: 'pending_review' },
    })

    const { result } = renderHook(() => useVideoImages('v1'))
    await act(async () => { await new Promise((r) => setTimeout(r, 0)) })

    await act(async () => {
      await result.current[1].update('poster', 'https://cdn.example.com/new-poster.jpg')
    })

    expect(api.updateVideoImage).toHaveBeenCalledWith('v1', 'poster', 'https://cdn.example.com/new-poster.jpg')
    expect(result.current[0].images?.poster.url).toBe('https://cdn.example.com/new-poster.jpg')
    expect(result.current[0].images?.poster.status).toBe('pending_review')
  })

  it('update：pending 状态在操作期间设置正确', async () => {
    vi.mocked(api.getVideoImages).mockResolvedValue(makeImages())
    let resolveUpdate!: () => void
    vi.mocked(api.updateVideoImage).mockReturnValue(
      new Promise((r) => { resolveUpdate = () => r({ data: { kind: 'poster', url: 'x', status: 'pending_review' } }) }),
    )

    const { result } = renderHook(() => useVideoImages('v1'))
    await act(async () => { await new Promise((r) => setTimeout(r, 0)) })

    act(() => {
      void result.current[1].update('poster', 'https://cdn.example.com/x.jpg')
    })

    expect(result.current[0].updatePending.has('poster')).toBe(true)

    await act(async () => { resolveUpdate(); await new Promise((r) => setTimeout(r, 0)) })
    expect(result.current[0].updatePending.has('poster')).toBe(false)
  })
})
