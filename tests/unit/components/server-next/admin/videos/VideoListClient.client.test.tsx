/**
 * VideoListClient.client.test.tsx — 组件级集成测试 / 聚焦 CSV 导出（CHG-SN-6-24）
 *
 * 覆盖：
 *   1. rows 非空 → 导出按钮渲染 + enabled
 *   2. rows 空 → disabled
 *   3. 点击 → a.click + filename pattern + Blob 类型
 *
 * 注：VideoListClient 主功能由 buildVideoFilter / buildFilterChips 单测 + e2e 覆盖；
 * 本 test 文件聚焦 CSV 导出接入（继承 CHG-SN-6-22/23 范式）。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

const listVideosMock = vi.fn()
const listCrawlerSitesMock = vi.fn().mockResolvedValue([])

vi.mock('@/lib/videos/api', () => ({
  listVideos: (...args: unknown[]) => listVideosMock(...args),
  batchPublish: vi.fn(),
  batchUnpublish: vi.fn(),
  reviewVideo: vi.fn(),
}))

vi.mock('@/lib/crawler/api', () => ({
  listCrawlerSites: (...args: unknown[]) => listCrawlerSitesMock(...args),
}))

vi.mock('@/lib/api-client', () => ({
  ApiClientError: class extends Error {
    constructor(message: string, public readonly status?: number) { super(message) }
  },
  apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn(), put: vi.fn() },
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/admin/videos',
}))

vi.mock('@/app/admin/videos/_client/VideoEditDrawer', () => ({
  VideoEditDrawer: () => null,
}))

vi.mock('@resovo/admin-ui', async () => {
  const actual = await vi.importActual<typeof import('@resovo/admin-ui')>('@resovo/admin-ui')
  return {
    ...actual,
    useToast: () => ({ push: vi.fn(), dismiss: vi.fn(), dismissAll: vi.fn() }),
  }
})

import { VideoListClient } from '../../../../../../apps/server-next/src/app/admin/videos/_client/VideoListClient'

const VIDEO_ROW = {
  id: 'vid-1',
  short_id: 'abc1234',
  title: '示例视频',
  title_en: 'Sample Video',
  cover_url: null,
  type: 'movie' as const,
  year: 2024,
  is_published: false,
  source_count: '3',
  active_source_count: '3',
  review_status: 'pending_review' as const,
  created_at: '2026-05-15T10:00:00Z',
}

const ROW_RES = { data: [VIDEO_ROW], total: 1, page: 1, limit: 20 }
const EMPTY_RES = { data: [], total: 0, page: 1, limit: 20 }

beforeEach(() => {
  listVideosMock.mockReset()
})

describe('VideoListClient — CSV 导出', () => {
  it('1. rows 非空 → 按钮渲染 + enabled', async () => {
    listVideosMock.mockResolvedValue(ROW_RES)
    render(<VideoListClient />)
    await waitFor(() => screen.getByTestId('videos-export-csv'))
    const btn = screen.getByTestId('videos-export-csv') as HTMLButtonElement
    expect(btn.disabled).toBe(false)
  })

  it('2. rows 空 → 按钮 disabled', async () => {
    listVideosMock.mockResolvedValue(EMPTY_RES)
    render(<VideoListClient />)
    await waitFor(() => screen.getByTestId('videos-export-csv'))
    const btn = screen.getByTestId('videos-export-csv') as HTMLButtonElement
    expect(btn.disabled).toBe(true)
  })

  it('3. 点击导出 → a.click + filename pattern + Blob 类型', async () => {
    listVideosMock.mockResolvedValue(ROW_RES)
    const clickSpy = vi.fn()
    const downloads: string[] = []
    const createObjectUrlSpy = vi.fn(() => 'blob:fake-url')
    Object.defineProperty(URL, 'createObjectURL', { value: createObjectUrlSpy, configurable: true })
    Object.defineProperty(URL, 'revokeObjectURL', { value: vi.fn(), configurable: true })
    const origCreate = document.createElement.bind(document)
    const createSpy = vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = origCreate(tag) as HTMLElement
      if (tag === 'a') {
        const anchor = el as HTMLAnchorElement
        anchor.click = clickSpy
        Object.defineProperty(anchor, 'download', {
          set(v: string) { downloads.push(v) },
          configurable: true,
        })
      }
      return el
    })
    try {
      render(<VideoListClient />)
      const btn = await waitFor(() => screen.getByTestId('videos-export-csv'))
      fireEvent.click(btn)
      expect(clickSpy).toHaveBeenCalledOnce()
      const blobArg = createObjectUrlSpy.mock.calls[0]?.[0] as Blob
      expect(blobArg).toBeInstanceOf(Blob)
      expect(blobArg.type).toContain('text/csv')
      expect(downloads[0]).toMatch(/^videos-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.csv$/)
    } finally {
      createSpy.mockRestore()
    }
  })
})
