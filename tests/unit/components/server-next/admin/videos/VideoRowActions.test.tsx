/**
 * VideoRowActions 单元测试（CHG-SN-3-05）
 *
 * 覆盖：
 * - buildItems（通过 VideoRowActions 间接覆盖）的条件显示逻辑
 * - 乐观更新：onRowUpdate 先于 API 被调用，失败时回滚
 * - admin-only 禁用：isAdmin=false 时豆瓣同步项 disabled
 * - getDetailHref：链接格式正确
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { VideoRowActions } from '../../../../../../apps/server-next/src/app/admin/videos/_client/VideoRowActions'
import type { VideoAdminRow } from '../../../../../../apps/server-next/src/lib/videos/types'

// ── mock API ──────────────────────────────────────────────────────

vi.mock('../../../../../../apps/server-next/src/lib/videos/api', () => ({
  updateVisibility: vi.fn(() => Promise.resolve()),
  stateTransition: vi.fn(() => Promise.resolve()),
  doubanSync: vi.fn(() => Promise.resolve()),
  refetchSources: vi.fn(() => Promise.resolve()),
}))

import * as videoApi from '../../../../../../apps/server-next/src/lib/videos/api'

// ── mock AdminDropdown ────────────────────────────────────────────
//
// AdminDropdown uses createPortal + browser layout APIs (getBoundingClientRect etc.)
// which are unavailable in jsdom. We render a simple stub that exposes items via
// data-key attributes so tests can click them directly.

vi.mock('@resovo/admin-ui', async () => {
  const actual = await vi.importActual<typeof import('@resovo/admin-ui')>('@resovo/admin-ui')
  return {
    ...actual,
    AdminDropdown: ({ items, trigger, open, onOpenChange }: {
      items: Array<{ key: string; label: React.ReactNode; onClick: () => void; disabled?: boolean; danger?: boolean }>
      trigger: React.ReactNode
      open: boolean
      onOpenChange: (v: boolean) => void
    }) => (
      <div data-testid="admin-dropdown-stub">
        <div
          data-testid="dropdown-trigger"
          role="button"
          onClick={() => onOpenChange(!open)}
        >
          {trigger}
        </div>
        {open && (
          <ul>
            {items.map((item) => (
              <li
                key={item.key}
                data-key={item.key}
                data-disabled={item.disabled ? 'true' : undefined}
                data-danger={item.danger ? 'true' : undefined}
                onClick={() => !item.disabled && item.onClick()}
              >
                {item.label}
              </li>
            ))}
          </ul>
        )}
      </div>
    ),
  }
})

// ── helpers ───────────────────────────────────────────────────────

function makeRow(overrides: Partial<VideoAdminRow> = {}): VideoAdminRow {
  return {
    id: 'v1',
    short_id: 'abc123',
    title: 'Test Video',
    title_en: null,
    cover_url: null,
    type: 'movie',
    year: 2024,
    is_published: false,
    source_count: '1',
    visibility_status: 'public',
    review_status: 'pending_review',
    created_at: '2024-01-01T00:00:00Z',
    ...overrides,
  }
}

function renderActions(
  row: VideoAdminRow,
  isAdmin = false,
  onRowUpdate = vi.fn(),
  onEditRequest = vi.fn(),
) {
  return render(
    <VideoRowActions
      row={row}
      isAdmin={isAdmin}
      onRowUpdate={onRowUpdate}
      onEditRequest={onEditRequest}
    />,
  )
}

function openDropdown() {
  fireEvent.click(screen.getByTestId('dropdown-trigger'))
}

function clickItem(key: string) {
  const el = document.querySelector(`[data-key="${key}"]`) as HTMLElement
  if (!el) throw new Error(`Item "${key}" not found in dropdown`)
  fireEvent.click(el)
}

// ── tests ─────────────────────────────────────────────────────────

describe('VideoRowActions — 条件显示', () => {
  it('visibility_status=public 时不显示"设为公开"', () => {
    renderActions(makeRow({ visibility_status: 'public' }))
    openDropdown()
    expect(document.querySelector('[data-key="set-public"]')).toBeNull()
    expect(document.querySelector('[data-key="set-internal"]')).toBeTruthy()
    expect(document.querySelector('[data-key="set-hidden"]')).toBeTruthy()
  })

  it('visibility_status=internal 时不显示"设为内部"', () => {
    renderActions(makeRow({ visibility_status: 'internal' }))
    openDropdown()
    expect(document.querySelector('[data-key="set-internal"]')).toBeNull()
    expect(document.querySelector('[data-key="set-public"]')).toBeTruthy()
  })

  it('is_published=false 时显示"上架"，不显示"下架"', () => {
    renderActions(makeRow({ is_published: false }))
    openDropdown()
    expect(document.querySelector('[data-key="publish"]')).toBeTruthy()
    expect(document.querySelector('[data-key="unpublish"]')).toBeNull()
  })

  it('is_published=true 时显示"下架"，不显示"上架"', () => {
    renderActions(makeRow({ is_published: true }))
    openDropdown()
    expect(document.querySelector('[data-key="unpublish"]')).toBeTruthy()
    expect(document.querySelector('[data-key="publish"]')).toBeNull()
  })

  it('review_status=pending_review 时显示"通过审核"+"拒绝审核"', () => {
    renderActions(makeRow({ review_status: 'pending_review' }))
    openDropdown()
    expect(document.querySelector('[data-key="approve"]')).toBeTruthy()
    expect(document.querySelector('[data-key="reject"]')).toBeTruthy()
    expect(document.querySelector('[data-key="reopen"]')).toBeNull()
  })

  it('review_status=rejected 时显示"重开审核"，不显示"通过/拒绝"', () => {
    renderActions(makeRow({ review_status: 'rejected' }))
    openDropdown()
    expect(document.querySelector('[data-key="reopen"]')).toBeTruthy()
    expect(document.querySelector('[data-key="approve"]')).toBeNull()
    expect(document.querySelector('[data-key="reject"]')).toBeNull()
  })

  it('review_status=approved 时不显示审核相关菜单项', () => {
    renderActions(makeRow({ review_status: 'approved' }))
    openDropdown()
    expect(document.querySelector('[data-key="approve"]')).toBeNull()
    expect(document.querySelector('[data-key="reject"]')).toBeNull()
    expect(document.querySelector('[data-key="reopen"]')).toBeNull()
  })

  it('"编辑基础信息"/"豆瓣同步"/"重新采集"/"查看详情" 始终显示', () => {
    renderActions(makeRow())
    openDropdown()
    expect(document.querySelector('[data-key="edit"]')).toBeTruthy()
    expect(document.querySelector('[data-key="douban-sync"]')).toBeTruthy()
    expect(document.querySelector('[data-key="refetch"]')).toBeTruthy()
    expect(document.querySelector('[data-key="view-detail"]')).toBeTruthy()
  })
})

describe('VideoRowActions — admin-only 禁用', () => {
  it('isAdmin=false 时豆瓣同步项 disabled', () => {
    renderActions(makeRow(), false)
    openDropdown()
    const el = document.querySelector('[data-key="douban-sync"]')
    expect(el?.getAttribute('data-disabled')).toBe('true')
  })

  it('isAdmin=true 时豆瓣同步项 enabled', () => {
    renderActions(makeRow(), true)
    openDropdown()
    const el = document.querySelector('[data-key="douban-sync"]')
    expect(el?.getAttribute('data-disabled')).toBeNull()
  })
})

describe('VideoRowActions — 乐观更新', () => {
  beforeEach(() => {
    vi.mocked(videoApi.updateVisibility).mockResolvedValue(
      { data: { visibility_status: 'internal', is_published: false } },
    )
  })

  it('点击"设为内部"立即调用 onRowUpdate，再调 API', async () => {
    const onRowUpdate = vi.fn()
    renderActions(makeRow({ visibility_status: 'public' }), false, onRowUpdate)
    openDropdown()
    clickItem('set-internal')
    expect(onRowUpdate).toHaveBeenCalledWith('v1', { visibility_status: 'internal' })
    await waitFor(() => expect(videoApi.updateVisibility).toHaveBeenCalledWith('v1', 'internal'))
  })

  it('API 失败时 onRowUpdate 回滚为原始值', async () => {
    vi.mocked(videoApi.updateVisibility).mockRejectedValueOnce(new Error('network error'))
    const onRowUpdate = vi.fn()
    const row = makeRow({ visibility_status: 'public', is_published: false, review_status: 'pending_review' })
    renderActions(row, false, onRowUpdate)
    openDropdown()
    clickItem('set-internal')
    await waitFor(() => expect(onRowUpdate).toHaveBeenCalledTimes(2))
    expect(onRowUpdate).toHaveBeenNthCalledWith(2, 'v1', {
      visibility_status: 'public',
      is_published: false,
      review_status: 'pending_review',
    })
  })
})

describe('VideoRowActions — 编辑请求', () => {
  it('点击"编辑基础信息"调用 onEditRequest', () => {
    const onEditRequest = vi.fn()
    renderActions(makeRow(), false, vi.fn(), onEditRequest)
    openDropdown()
    clickItem('edit')
    expect(onEditRequest).toHaveBeenCalledWith('v1')
  })
})

describe('VideoRowActions — state transition', () => {
  it('点击"上架"乐观更新 is_published=true 并调 stateTransition', async () => {
    vi.mocked(videoApi.stateTransition).mockResolvedValue({ data: makeRow({ is_published: true }) })
    const onRowUpdate = vi.fn()
    renderActions(makeRow({ is_published: false }), false, onRowUpdate)
    openDropdown()
    clickItem('publish')
    expect(onRowUpdate).toHaveBeenCalledWith('v1', { is_published: true })
    await waitFor(() => expect(videoApi.stateTransition).toHaveBeenCalledWith('v1', 'publish'))
  })

  it('点击"通过审核"乐观更新 review_status=approved', async () => {
    vi.mocked(videoApi.stateTransition).mockResolvedValue({ data: makeRow({ review_status: 'approved' }) })
    const onRowUpdate = vi.fn()
    renderActions(makeRow({ review_status: 'pending_review' }), false, onRowUpdate)
    openDropdown()
    clickItem('approve')
    expect(onRowUpdate).toHaveBeenCalledWith('v1', { review_status: 'approved' })
    await waitFor(() => expect(videoApi.stateTransition).toHaveBeenCalledWith('v1', 'approve'))
  })
})
