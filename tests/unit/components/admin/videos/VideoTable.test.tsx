import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { VideoTable } from '@/components/admin/videos/VideoTable'

const getMock = vi.fn()
const patchMock = vi.fn()
const postMock = vi.fn()
const pushMock = vi.fn()
const mockSearchParams = new URLSearchParams()

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: (...args: unknown[]) => getMock(...args),
    patch: (...args: unknown[]) => patchMock(...args),
    post: (...args: unknown[]) => postMock(...args),
  },
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: (...args: unknown[]) => pushMock(...args) }),
  useSearchParams: () => ({
    get: (key: string) => mockSearchParams.get(key),
  }),
}))

vi.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (state: { user: { role: 'admin' } }) => unknown) => selector({ user: { role: 'admin' } }),
  selectIsAdmin: (state: { user?: { role?: string } }) => state.user?.role === 'admin',
}))

const MOCK_ROWS = [
  {
    id: 'v2',
    short_id: 'v2short',
    title: 'Zeta Movie',
    title_en: null,
    cover_url: null,
    type: 'movie',
    year: 2024,
    is_published: false,
    source_count: '3',
    active_source_count: '1',
    total_source_count: '3',
    visibility_status: 'internal',
    review_status: 'pending_review',
    created_at: '2026-03-20T00:00:00Z',
    douban_status: 'pending',
    meta_score: 40,
  },
  {
    id: 'v1',
    short_id: 'v1short',
    title: 'Alpha Movie',
    title_en: null,
    cover_url: null,
    type: 'series',
    year: 2025,
    is_published: true,
    source_count: '9',
    active_source_count: '8',
    total_source_count: '9',
    visibility_status: 'public',
    review_status: 'approved',
    created_at: '2026-03-20T00:00:00Z',
    douban_status: 'matched',
    meta_score: 85,
  },
]

// 暂存中行：approved + !is_published
const MOCK_STAGING_ROW = {
  id: 'v3',
  short_id: 'v3short',
  title: 'Staging Movie',
  title_en: null,
  cover_url: null,
  type: 'movie',
  year: 2026,
  is_published: false,
  source_count: '2',
  active_source_count: '2',
  total_source_count: '2',
  visibility_status: 'internal',
  review_status: 'approved',
  created_at: '2026-04-14T00:00:00Z',
  douban_status: 'matched',
  meta_score: 70,
}

describe('VideoTable (CHG-211/212)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    mockSearchParams.forEach((_value, key) => mockSearchParams.delete(key))
    getMock.mockImplementation(async (url: string) => {
      if (url.startsWith('/admin/videos?')) {
        const params = new URLSearchParams(url.split('?')[1] ?? '')
        const sortField = params.get('sortField')
        const sortDir = params.get('sortDir')
        // Server returns rows sorted per params (simulates server-side sort)
        if (sortField === 'title' && sortDir === 'desc') {
          // DESC: Zeta first (v2), Alpha second (v1)
          return { data: [...MOCK_ROWS], total: MOCK_ROWS.length }
        }
        // Default / title ASC: Alpha first (v1), Zeta second (v2)
        return { data: [...MOCK_ROWS].reverse(), total: MOCK_ROWS.length }
      }

      if (url === '/admin/videos/v1') {
        return {
          data: {
            id: 'v1',
            title: 'Alpha Movie',
            description: 'Old description',
            year: 2025,
            type: 'series',
            country: 'JP',
          },
        }
      }

      if (url === '/admin/sources?videoId=v1&page=1&limit=20') {
        return {
          data: [
            {
              id: 'src-1',
              source_url: 'https://cdn.example.com/v1.m3u8',
              source_name: 'main',
              is_active: true,
              episode_number: 1,
              season_number: 1,
            },
          ],
          total: 1,
        }
      }

      return { data: [], total: 0 }
    })
    patchMock.mockResolvedValue({
      data: {
        visibility_status: 'hidden',
        is_published: false,
      },
    })
    postMock.mockResolvedValue({})
  })

  it('applies default title sort and supports toggleSort', async () => {
    render(<VideoTable />)

    await screen.findByText('Alpha Movie')

    const rowsAsc = screen.getAllByTestId(/modern-table-row-/)
    expect(rowsAsc[0]?.getAttribute('data-testid')).toBe('modern-table-row-v1')

    fireEvent.click(screen.getByTestId('modern-table-sort-title'))

    await waitFor(() => {
      const rowsDesc = screen.getAllByTestId(/modern-table-row-/)
      expect(rowsDesc[0]?.getAttribute('data-testid')).toBe('modern-table-row-v2')
    })
  })

  it('supports column visibility toggle', async () => {
    render(<VideoTable />)
    await screen.findByText('Alpha Movie')

    fireEvent.click(screen.getByTestId('video-table-scroll-settings-btn'))
    fireEvent.click(screen.getByTestId('video-table-scroll-settings-content-visible-review_status'))

    await waitFor(() => {
      expect(screen.queryByTestId('modern-table-sort-review_status')).toBeNull()
    })
  })

  it('persists resized column width after remount', async () => {
    const { unmount } = render(<VideoTable />)
    await screen.findByText('Alpha Movie')

    const titleHeader = screen.getByTestId('modern-table-sort-title').closest('th')
    expect(titleHeader?.getAttribute('style')).toContain('width: 320px')

    fireEvent.mouseDown(screen.getByTestId('modern-table-resize-title'), { clientX: 100 })
    fireEvent.mouseMove(window, { clientX: 180 })
    fireEvent.mouseUp(window)

    await waitFor(() => {
      expect(titleHeader?.getAttribute('style')).toContain('width: 400px')
    })

    unmount()

    render(<VideoTable />)
    await screen.findByText('Alpha Movie')

    const remountTitleHeader = screen.getByTestId('modern-table-sort-title').closest('th')
    expect(remountTitleHeader?.getAttribute('style')).toContain('width: 400px')
  })

  it('requests visibilityStatus and reviewStatus filters from search params', async () => {
    mockSearchParams.set('visibilityStatus', 'internal')
    mockSearchParams.set('reviewStatus', 'approved')

    render(<VideoTable />)

    await waitFor(() => {
      expect(getMock).toHaveBeenCalledWith(expect.stringContaining('visibilityStatus=internal'))
      expect(getMock).toHaveBeenCalledWith(expect.stringContaining('reviewStatus=approved'))
    })
  })

  it('renders modern cells for source health, visibility and review status', async () => {
    render(<VideoTable />)

    const row = await screen.findByTestId('modern-table-row-v1')
    expect(within(row).getByText('Alpha Movie')).toBeTruthy()
    expect(within(row).getByText('v1short')).toBeTruthy()
    expect(within(row).getByText('🟡 8/9 活跃')).toBeTruthy()
    expect(within(row).getByText('公开')).toBeTruthy()
    expect(within(row).getByText('已通过')).toBeTruthy()
  })

  it('optimistically changes visibility via 3-state select without refetching the table (CHG-340)', async () => {
    render(<VideoTable />)

    const row = await screen.findByTestId('modern-table-row-v1')
    const visibilitySelect = within(row).getByTestId('visibility-select-v1')
    expect(getMock).toHaveBeenCalledTimes(1)
    // v1 has visibility_status: 'public'
    expect((visibilitySelect as HTMLSelectElement).value).toBe('public')

    fireEvent.change(visibilitySelect, { target: { value: 'hidden' } })

    await waitFor(() => {
      expect(patchMock).toHaveBeenCalledWith('/admin/videos/v1/visibility', { visibility: 'hidden' })
      // Optimistic update: select now shows 'hidden'
      expect((screen.getByTestId('visibility-select-v1') as HTMLSelectElement).value).toBe('hidden')
    })

    expect(getMock).toHaveBeenCalledTimes(1)
  })

  it('rolls back visibility on change failure (CHG-340)', async () => {
    patchMock.mockRejectedValueOnce(new Error('服务异常'))
    render(<VideoTable />)

    const row = await screen.findByTestId('modern-table-row-v1')
    const visibilitySelect = within(row).getByTestId('visibility-select-v1')
    fireEvent.change(visibilitySelect, { target: { value: 'hidden' } })

    await waitFor(() => {
      // State rolled back to original 'public'
      expect((screen.getByTestId('visibility-select-v1') as HTMLSelectElement).value).toBe('public')
    })
  })

  it('navigates to full edit page on edit button click (CHG-339: v2 actions)', async () => {
    render(<VideoTable />)

    await screen.findByText('Alpha Movie')
    const actionsDiv = screen.getByTestId('video-actions-v1')
    const editBtn = actionsDiv.querySelector('button[title="编辑"]') as HTMLElement
    expect(editBtn).toBeTruthy()
    fireEvent.click(editBtn)

    expect(pushMock).toHaveBeenCalledWith('/admin/videos/v1/edit')
  })

  it('supports publish/unpublish toggle button in actions (CHG-339: v2 actions)', async () => {
    render(<VideoTable />)
    await screen.findByText('Alpha Movie')

    // Alpha Movie (v1) is published → shows "已上架" button
    const actionsDiv = screen.getByTestId('video-actions-v1')
    const publishBtn = within(actionsDiv).getByTitle('下架')
    fireEvent.click(publishBtn)

    await waitFor(() => {
      expect(patchMock).toHaveBeenCalledWith('/admin/videos/v1/publish', { isPublished: false })
    })
  })

  // ── VIDEO-09: 豆瓣状态列 ─────────────────────────────────────────

  it('启用豆瓣状态列后渲染 badge 和同步按钮', async () => {
    render(<VideoTable />)
    await screen.findByText('Alpha Movie')

    // 启用豆瓣状态列
    fireEvent.click(screen.getByTestId('video-table-scroll-settings-btn'))
    fireEvent.click(screen.getByTestId('video-table-scroll-settings-content-visible-douban_status'))

    await waitFor(() => {
      // v1 douban_status = 'matched' → 已匹配 badge
      expect(screen.getByText('已匹配')).toBeDefined()
    })

    // 每行都有同步按钮
    expect(screen.getByTestId('douban-sync-v1')).toBeDefined()
    expect(screen.getByTestId('douban-sync-v2')).toBeDefined()
  })

  it('点击同步按钮调用 POST douban-sync 并刷新列表', async () => {
    render(<VideoTable />)
    await screen.findByText('Alpha Movie')

    fireEvent.click(screen.getByTestId('video-table-scroll-settings-btn'))
    fireEvent.click(screen.getByTestId('video-table-scroll-settings-content-visible-douban_status'))

    await waitFor(() => {
      expect(screen.getByTestId('douban-sync-v1')).toBeDefined()
    })

    const callsBefore = getMock.mock.calls.length
    fireEvent.click(screen.getByTestId('douban-sync-v1'))

    await waitFor(() => {
      expect(postMock).toHaveBeenCalledWith('/admin/videos/v1/douban-sync', {})
    })
    await waitFor(() => {
      expect(getMock.mock.calls.length).toBeGreaterThan(callsBefore)
    })
  })

  // ── VIDEO-09: 元数据完整度列 ─────────────────────────────────────

  it('启用元数据完整度列后渲染进度条', async () => {
    render(<VideoTable />)
    await screen.findByText('Alpha Movie')

    fireEvent.click(screen.getByTestId('video-table-scroll-settings-btn'))
    fireEvent.click(screen.getByTestId('video-table-scroll-settings-content-visible-meta_score'))

    await waitFor(() => {
      expect(screen.getByTestId('meta-score-v1')).toBeDefined()
    })
    expect(screen.getByTestId('meta-score-v2')).toBeDefined()
  })

  // ── VIDEO-09: 暂存中快捷操作 ──────────────────────────────────────

  it('approved + !is_published 行显示暂存按钮，点击跳转 /admin/staging', async () => {
    getMock.mockImplementation(async (url: string) => {
      if (url.startsWith('/admin/videos?')) {
        return { data: [MOCK_STAGING_ROW], total: 1 }
      }
      return { data: [], total: 0 }
    })

    render(<VideoTable />)
    await screen.findByText('Staging Movie')

    const stagingBtn = screen.getByTestId('video-staging-v3')
    expect(stagingBtn).toBeDefined()

    fireEvent.click(stagingBtn)
    expect(pushMock).toHaveBeenCalledWith('/admin/staging?videoId=v3')
  })

  it('is_published=true 的行不显示暂存按钮', async () => {
    render(<VideoTable />)
    await screen.findByText('Alpha Movie')

    // v1: review_status='approved', is_published=true → 不显示暂存按钮
    expect(screen.queryByTestId('video-staging-v1')).toBeNull()
    // v2: review_status='pending_review' → 不显示暂存按钮
    expect(screen.queryByTestId('video-staging-v2')).toBeNull()
  })

  // ── VIDEO-10: 复审按钮 ─────────────────────────────────────────────

  it('rejected 行显示复审按钮，点击调用 state-transition reopen_pending', async () => {
    getMock.mockImplementation(async (url: string) => {
      if (url.startsWith('/admin/videos?')) {
        return {
          data: [{
            ...MOCK_ROWS[0],
            id: 'v-rej',
            review_status: 'rejected',
            source_check_status: 'ok',
          }],
          total: 1,
        }
      }
      return { data: [], total: 0 }
    })

    render(<VideoTable />)
    await screen.findByText('Zeta Movie')

    const reopenBtn = screen.getByTestId('video-reopen-v-rej')
    expect(reopenBtn).toBeDefined()

    fireEvent.click(reopenBtn)

    await waitFor(() => {
      expect(postMock).toHaveBeenCalledWith(
        '/admin/videos/v-rej/state-transition',
        { action: 'reopen_pending' },
      )
    })
  })

  it('非 rejected 行不显示复审按钮', async () => {
    render(<VideoTable />)
    await screen.findByText('Alpha Movie')

    expect(screen.queryByTestId('video-reopen-v1')).toBeNull()
    expect(screen.queryByTestId('video-reopen-v2')).toBeNull()
  })

  // ── VIDEO-10: 触发补源按钮 ─────────────────────────────────────────

  it('all_dead 行显示补源按钮，点击调用 refetch-sources', async () => {
    getMock.mockImplementation(async (url: string) => {
      if (url.startsWith('/admin/videos?')) {
        return {
          data: [{
            ...MOCK_ROWS[0],
            id: 'v-dead',
            source_check_status: 'all_dead',
          }],
          total: 1,
        }
      }
      return { data: [], total: 0 }
    })

    render(<VideoTable />)
    await screen.findByText('Zeta Movie')

    const refetchBtn = screen.getByTestId('video-refetch-v-dead')
    expect(refetchBtn).toBeDefined()

    fireEvent.click(refetchBtn)

    await waitFor(() => {
      expect(postMock).toHaveBeenCalledWith('/admin/videos/v-dead/refetch-sources', {})
    })
  })

  it('非 all_dead 行不显示补源按钮', async () => {
    render(<VideoTable />)
    await screen.findByText('Alpha Movie')

    expect(screen.queryByTestId('video-refetch-v1')).toBeNull()
    expect(screen.queryByTestId('video-refetch-v2')).toBeNull()
  })
})
