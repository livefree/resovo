/**
 * KeywordCrawlDrawer.test.tsx — CW1-C 关键词采集 Drawer 单测
 *
 * 真源：~/.claude/plans/cheerful-orbiting-hare.md §W1 拆卡 3
 *
 * 覆盖（≥ 7）：
 *   1. 关闭时 → 不调 API
 *   2. 打开时 → 默认全选 enabled 站点（disabled 站点不渲染）
 *   3. empty keyword → 预览按钮 disabled（不调 API）
 *   4. 反选 / 单选交互 → 选中数变化（且立即采集 disabled）
 *   5. previewKeyword 调用 + 渲染表格（有结果 / 多站点 flatten）
 *   6. previewKeyword 无结果 → empty state
 *   7. 立即采集 → runCrawlerKeyword + success toast + onClose
 *   8. 站点失败（error）→ 渲染错误行
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

const previewKeywordMock = vi.fn()
const runCrawlerKeywordMock = vi.fn()
const toastPushMock = vi.fn()
const routerPushMock = vi.fn()

vi.mock('@/lib/crawler/api', () => ({
  previewKeyword: (...args: unknown[]) => previewKeywordMock(...args),
  runCrawlerKeyword: (...args: unknown[]) => runCrawlerKeywordMock(...args),
}))

vi.mock('@/lib/api-client', () => ({
  ApiClientError: class extends Error {
    constructor(message: string, public readonly status?: number, public readonly code?: string) {
      super(message)
    }
  },
  apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn(), put: vi.fn() },
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: (...args: unknown[]) => routerPushMock(...args),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
}))

vi.mock('@resovo/admin-ui', async () => {
  const actual = await vi.importActual<typeof import('@resovo/admin-ui')>('@resovo/admin-ui')
  return {
    ...actual,
    useToast: () => ({
      push: (i: unknown) => { toastPushMock(i); return 'tid' },
      dismiss: vi.fn(),
      dismissAll: vi.fn(),
    }),
  }
})

import { KeywordCrawlDrawer } from '@/app/admin/crawler/_client/KeywordCrawlDrawer'
import type { CrawlerSite } from '@/lib/crawler/api'

function makeSite(key: string, opts: Partial<CrawlerSite> = {}): CrawlerSite {
  return {
    key,
    name: `Site ${key.toUpperCase()}`,
    displayName: null,
    apiUrl: 'https://example.com',
    detail: null,
    sourceType: 'vod' as const,
    format: 'json' as const,
    weight: 1,
    isAdult: false,
    disabled: false,
    fromConfig: false,
    lastCrawledAt: null,
    lastCrawlStatus: null,
    ingestPolicy: {
      allow_auto_publish: false,
      allow_search_index: true,
      allow_recommendation: true,
      allow_public_detail: true,
      allow_playback: true,
      require_review_before_publish: false,
    },
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...opts,
  }
}

const SITES: readonly CrawlerSite[] = [
  makeSite('alpha'),
  makeSite('beta'),
  makeSite('gamma', { disabled: true }), // 不会出现在多选列表
]

beforeEach(() => {
  previewKeywordMock.mockReset()
  runCrawlerKeywordMock.mockReset()
  toastPushMock.mockReset()
  routerPushMock.mockReset()
})

describe('KeywordCrawlDrawer', () => {
  it('1. 关闭时 → 不调 API', () => {
    render(<KeywordCrawlDrawer open={false} onClose={() => {}} sites={SITES} />)
    expect(previewKeywordMock).not.toHaveBeenCalled()
    expect(runCrawlerKeywordMock).not.toHaveBeenCalled()
  })

  it('2. 打开时 → 默认全选 enabled 站点 / disabled 站点不渲染', () => {
    render(<KeywordCrawlDrawer open={true} onClose={() => {}} sites={SITES} />)
    expect(screen.getByTestId('keyword-crawl-site-alpha')).not.toBeNull()
    expect(screen.getByTestId('keyword-crawl-site-beta')).not.toBeNull()
    // disabled 站点 gamma 不渲染
    expect(screen.queryByTestId('keyword-crawl-site-gamma')).toBeNull()
    // 默认全选
    const alpha = screen.getByTestId('keyword-crawl-site-alpha') as HTMLInputElement
    const beta = screen.getByTestId('keyword-crawl-site-beta') as HTMLInputElement
    expect(alpha.checked).toBe(true)
    expect(beta.checked).toBe(true)
  })

  it('3. empty keyword → 预览按钮 disabled / 不调 API', () => {
    render(<KeywordCrawlDrawer open={true} onClose={() => {}} sites={SITES} />)
    const previewBtn = screen.getByTestId('keyword-crawl-preview-btn') as HTMLButtonElement
    expect(previewBtn.disabled || previewBtn.getAttribute('aria-disabled') === 'true').toBe(true)
    fireEvent.click(previewBtn)
    expect(previewKeywordMock).not.toHaveBeenCalled()
  })

  it('4. 反选 → 选中数清零 / 立即采集 disabled', async () => {
    render(<KeywordCrawlDrawer open={true} onClose={() => {}} sites={SITES} />)
    // 反选：把 alpha + beta 全部取消（enabled 共 2 个）
    fireEvent.click(screen.getByTestId('keyword-crawl-invert'))
    await waitFor(() => {
      const alpha = screen.getByTestId('keyword-crawl-site-alpha') as HTMLInputElement
      const beta = screen.getByTestId('keyword-crawl-site-beta') as HTMLInputElement
      expect(alpha.checked).toBe(false)
      expect(beta.checked).toBe(false)
    })
    // 立即采集仍 disabled（无 results）
    const runBtn = screen.getByTestId('keyword-crawl-run-btn') as HTMLButtonElement
    expect(runBtn.disabled || runBtn.getAttribute('aria-disabled') === 'true').toBe(true)
  })

  it('5. previewKeyword 调用 + 渲染表格（有结果）', async () => {
    previewKeywordMock.mockResolvedValueOnce([
      {
        siteKey: 'alpha',
        items: [
          { title: '复仇者联盟', year: 2012, type: 'movie', sourceCount: 3, sourceStatus: 'ok', siteKey: 'alpha' },
          { title: '复仇者联盟 2', year: 2015, type: 'movie', sourceCount: 2, sourceStatus: 'timeout', siteKey: 'alpha' },
        ],
        error: null,
      },
      {
        siteKey: 'beta',
        items: [
          { title: '复仇者', year: 2020, type: 'series', sourceCount: 1, sourceStatus: 'unknown', siteKey: 'beta' },
        ],
        error: null,
      },
    ])
    render(<KeywordCrawlDrawer open={true} onClose={() => {}} sites={SITES} />)
    // 填关键词
    const input = screen.getByTestId('keyword-crawl-keyword').querySelector('input') as HTMLInputElement
    fireEvent.change(input, { target: { value: '复仇者' } })
    // 点击预览
    fireEvent.click(screen.getByTestId('keyword-crawl-preview-btn'))
    await waitFor(() => {
      expect(previewKeywordMock).toHaveBeenCalledWith('复仇者', ['alpha', 'beta'], undefined)
    })
    await waitFor(() => {
      expect(screen.getByTestId('keyword-crawl-preview-result')).not.toBeNull()
      // 3 条 item 文本可见
      expect(screen.getAllByText(/复仇者/).length).toBeGreaterThanOrEqual(3)
    })
    // 立即采集按钮启用
    const runBtn = screen.getByTestId('keyword-crawl-run-btn') as HTMLButtonElement
    expect(runBtn.disabled).toBe(false)
  })

  it('6. previewKeyword 空结果 → empty state', async () => {
    previewKeywordMock.mockResolvedValueOnce([
      { siteKey: 'alpha', items: [], error: null },
      { siteKey: 'beta', items: [], error: null },
    ])
    render(<KeywordCrawlDrawer open={true} onClose={() => {}} sites={SITES} />)
    const input = screen.getByTestId('keyword-crawl-keyword').querySelector('input') as HTMLInputElement
    fireEvent.change(input, { target: { value: '不存在的视频' } })
    fireEvent.click(screen.getByTestId('keyword-crawl-preview-btn'))
    await waitFor(() => {
      expect(screen.getByTestId('keyword-crawl-preview-empty')).not.toBeNull()
    })
    // 立即采集 disabled
    const runBtn = screen.getByTestId('keyword-crawl-run-btn') as HTMLButtonElement
    expect(runBtn.disabled || runBtn.getAttribute('aria-disabled') === 'true').toBe(true)
  })

  it('7. 立即采集 → runCrawlerKeyword + success toast + onClose', async () => {
    previewKeywordMock.mockResolvedValueOnce([
      {
        siteKey: 'alpha',
        items: [{ title: 'X', year: 2020, type: 'movie', sourceCount: 1, sourceStatus: 'ok', siteKey: 'alpha' }],
        error: null,
      },
    ])
    runCrawlerKeywordMock.mockResolvedValueOnce({
      runId: 'run-12345678-abcd',
      taskIds: ['t1'],
      enqueuedSiteKeys: ['alpha', 'beta'],
      skippedSiteKeys: [],
    })
    const onClose = vi.fn()
    render(<KeywordCrawlDrawer open={true} onClose={onClose} sites={SITES} />)
    const input = screen.getByTestId('keyword-crawl-keyword').querySelector('input') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'X' } })
    fireEvent.click(screen.getByTestId('keyword-crawl-preview-btn'))
    await waitFor(() => expect(previewKeywordMock).toHaveBeenCalled())

    const runBtn = await waitFor(() => {
      const btn = screen.getByTestId('keyword-crawl-run-btn') as HTMLButtonElement
      if (btn.disabled) throw new Error('still disabled')
      return btn
    })
    fireEvent.click(runBtn)

    await waitFor(() => {
      expect(runCrawlerKeywordMock).toHaveBeenCalledWith('X', ['alpha', 'beta'])
      expect(toastPushMock).toHaveBeenCalledWith(
        expect.objectContaining({ level: 'success', title: '已发起关键词采集' }),
      )
      expect(onClose).toHaveBeenCalled()
    })
  })

  it('8. 站点失败（error）→ 渲染错误行 + 仍可立即采集（若有其它站点有结果）', async () => {
    previewKeywordMock.mockResolvedValueOnce([
      { siteKey: 'alpha', items: [], error: 'ETIMEDOUT' },
      {
        siteKey: 'beta',
        items: [{ title: 'Hit', year: 2024, type: 'series', sourceCount: 2, sourceStatus: 'ok', siteKey: 'beta' }],
        error: null,
      },
    ])
    render(<KeywordCrawlDrawer open={true} onClose={() => {}} sites={SITES} />)
    const input = screen.getByTestId('keyword-crawl-keyword').querySelector('input') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'kw' } })
    fireEvent.click(screen.getByTestId('keyword-crawl-preview-btn'))
    await waitFor(() => {
      expect(screen.getByText(/站点失败：ETIMEDOUT/)).not.toBeNull()
      expect(screen.getByText('Hit')).not.toBeNull()
    })
    const runBtn = screen.getByTestId('keyword-crawl-run-btn') as HTMLButtonElement
    expect(runBtn.disabled).toBe(false)
  })
})
