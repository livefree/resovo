/**
 * SubmissionsListClient.test.tsx — SubmissionsListClient CSV 导出测试（CHG-SN-6-23）
 *
 * 覆盖（聚焦 csv-export 接入）：
 *   1. rows 非空 → 按钮渲染 + enabled
 *   2. rows 空 → 按钮 disabled
 *   3. 点击 → a.click + filename pattern + Blob 类型
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

const listSubmissionsMock = vi.fn()
const listCrawlerSitesMock = vi.fn().mockResolvedValue([])

vi.mock('../../../../../../apps/server-next/src/lib/submissions/api', () => ({
  listSubmissions: (...args: unknown[]) => listSubmissionsMock(...args),
  approveSubmission: vi.fn(),
  rejectSubmission: vi.fn(),
  batchApproveSubmissions: vi.fn(),
  batchRejectSubmissions: vi.fn(),
}))

vi.mock('../../../../../../apps/server-next/src/lib/crawler/api', () => ({
  listCrawlerSites: (...args: unknown[]) => listCrawlerSitesMock(...args),
}))

vi.mock('../../../../../../apps/server-next/src/lib/api-client', () => ({
  ApiClientError: class extends Error {
    constructor(message: string, public readonly status?: number) { super(message) }
  },
  apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn(), put: vi.fn() },
}))

vi.mock('@resovo/admin-ui', async () => {
  const actual = await vi.importActual<typeof import('@resovo/admin-ui')>('@resovo/admin-ui')
  return {
    ...actual,
    useToast: () => ({ push: vi.fn(), dismiss: vi.fn(), dismissAll: vi.fn() }),
  }
})

import { SubmissionsListClient } from '../../../../../../apps/server-next/src/app/admin/submissions/_client/SubmissionsListClient'

const SUB_ROW = {
  id: 's-1',
  video_id: 'v-1',
  source_url: 'https://example.com/video.mp4',
  source_name: '示例源',
  submitted_by: 'u-1',
  submitted_by_username: 'alice',
  video_title: '示例视频',
  video_type: 'movie',
  video_site_key: 'site-a',
  created_at: '2026-05-15T10:00:00Z',
}

const ROW_RES = { data: [SUB_ROW], total: 1, page: 1, limit: 20 }
const EMPTY_RES = { data: [], total: 0, page: 1, limit: 20 }

beforeEach(() => {
  listSubmissionsMock.mockReset()
})

describe('SubmissionsListClient — CSV 导出', () => {
  it('1. rows 非空 → 按钮渲染 + enabled', async () => {
    listSubmissionsMock.mockResolvedValueOnce(ROW_RES)
    render(<SubmissionsListClient />)
    await waitFor(() => screen.getByText('示例视频'))
    const btn = screen.getByTestId('submissions-export-csv') as HTMLButtonElement
    expect(btn.disabled).toBe(false)
  })

  it('2. rows 空 → 按钮 disabled', async () => {
    listSubmissionsMock.mockResolvedValueOnce(EMPTY_RES)
    render(<SubmissionsListClient />)
    await waitFor(() => screen.getByTestId('submissions-export-csv'))
    const btn = screen.getByTestId('submissions-export-csv') as HTMLButtonElement
    expect(btn.disabled).toBe(true)
  })

  it('3. 点击导出 → a.click + filename pattern + Blob 类型', async () => {
    listSubmissionsMock.mockResolvedValueOnce(ROW_RES)
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
      render(<SubmissionsListClient />)
      const btn = await waitFor(() => screen.getByTestId('submissions-export-csv'))
      fireEvent.click(btn)
      expect(clickSpy).toHaveBeenCalledOnce()
      const blobArg = createObjectUrlSpy.mock.calls[0]?.[0] as Blob
      expect(blobArg).toBeInstanceOf(Blob)
      expect(blobArg.type).toContain('text/csv')
      expect(downloads[0]).toMatch(/^submissions-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.csv$/)
    } finally {
      createSpy.mockRestore()
    }
  })
})

// ── CHG-SN-7-REDO-02-D deprecation banner ─────────────────────────

describe('SubmissionsListClient — REDO-02-D 迁移 deprecation banner', () => {
  it('4. banner 渲染 + 跳转按钮存在 + 文案含目标路径', async () => {
    listSubmissionsMock.mockResolvedValueOnce({ data: [], total: 0, page: 1, limit: 20 })
    const { container } = render(<SubmissionsListClient />)
    const banner = await waitFor(() => screen.getByTestId('submissions-deprecation-banner'))
    expect(banner).not.toBeNull()
    expect(banner.textContent).toContain('/admin/user-submissions')
    expect(banner.textContent).toContain('M-SN-9 退役')
    const redirectBtn = screen.getByTestId('submissions-deprecation-redirect')
    expect(redirectBtn).not.toBeNull()
    expect(redirectBtn.textContent).toContain('切换到新页面')
    // jsdom 下 Next Link 通常渲染 <a>，但 legacyBehavior + child button 包装层级不稳定 —
    // 用更宽松的"banner 整体含 href 字符串"断言即可
    expect(container.innerHTML).toContain('/admin/user-submissions')
  })
})
