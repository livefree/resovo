/**
 * PendingPaneControllerKeyboard.test.tsx — MODUX-P2-3 键盘流（item 1）
 *
 * 验证审核台原生 keydown → 共享 KeyboardShortcuts 迁移后的行为：
 *   - 导航键 J/K → setActiveIdx（批量模式仍生效 = batchSafe）
 *   - 审核键 A/R/S/E → 对应回调（批量模式暂停 = batchSafe:false 守卫）
 *   - shift+? → help 浮层（KeyboardHelpOverlay / Modal）渲染
 *
 * SplitPane mock 为 null：避免渲染深层 PendingCenter/RightPane 树（player/lines API）；
 * KeyboardShortcuts + Modal 保真（键盘流 + 浮层为被测目标）。
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup, screen, waitFor, act } from '@testing-library/react'

vi.mock('@resovo/admin-ui', async () => {
  const actual = await vi.importActual<typeof import('@resovo/admin-ui')>('@resovo/admin-ui')
  return { ...actual, SplitPane: () => null }
})

vi.mock('../../../../../../apps/server-next/src/lib/admin-preview-url', () => ({
  buildAdminPreviewUrl: vi.fn(() => 'http://preview.example/x?preview=admin'),
}))

import { PendingPaneController } from '../../../../../../apps/server-next/src/app/admin/moderation/_client/PendingPaneController'

type ControllerProps = Parameters<typeof PendingPaneController>[0]

function makeVideo(id: string): ControllerProps['videos'][number] {
  return {
    id, slug: `slug-${id}`, shortId: `V${id}`, title: `视频 ${id}`,
    type: 'movie', year: 2024, country: 'CN', episodeCount: 1,
    totalEpisodes: null, currentEpisodes: null, coverUrl: null, rating: null, category: null,
    isPublished: false, visibilityStatus: 'internal', reviewStatus: 'pending_review',
    reviewReason: null, reviewedBy: null, reviewedAt: null,
    probe: 'pending', render: 'pending',
    probeAggregate: { total: 0, ok: 0, state: 'pending' },
    renderAggregate: { total: 0, ok: 0, state: 'pending' },
    sourceCheckStatus: 'pending', metaScore: 50, needsManualReview: false,
    badges: [], staffNote: null, reviewLabelKey: null, doubanStatus: 'pending',
    reviewSource: 'manual', trendingTag: null,
    createdAt: '2026-05-01T00:00:00Z', updatedAt: '2026-05-01T00:00:00Z',
  } as unknown as ControllerProps['videos'][number]
}

function renderController(over: Partial<ControllerProps> = {}): ControllerProps {
  const props = {
    videos: [makeVideo('1'), makeVideo('2')],
    total: 2, activeIdx: 0, loading: false, loadingMore: false, nextCursor: null,
    setActiveIdx: vi.fn(), loadMore: vi.fn(),
    batchModeOn: false, selectedIds: new Set<string>(), onToggleSelect: vi.fn(),
    onApprove: vi.fn(), onRejectOpen: vi.fn(), onEditVideo: vi.fn(), onStaffNoteChange: vi.fn(),
    q: '', onQChange: vi.fn(), currentFilters: {}, onClearAllFilters: vi.fn(),
    ...over,
  } as unknown as ControllerProps
  render(<PendingPaneController {...props} />)
  return props
}

function dispatchKeydown(key: string, opts: { shiftKey?: boolean } = {}): void {
  act(() => {
    document.body.dispatchEvent(new KeyboardEvent('keydown', {
      key, shiftKey: !!opts.shiftKey, bubbles: true, cancelable: true,
    }))
  })
}

describe('PendingPaneController · 键盘流（MODUX-P2-3 / item 1）', () => {
  afterEach(() => cleanup())

  it("'j' → setActiveIdx（导航前进）", () => {
    const props = renderController()
    dispatchKeydown('j')
    expect(props.setActiveIdx).toHaveBeenCalled()
  })

  it("'a' → onApprove（非批量模式）", () => {
    const props = renderController()
    dispatchKeydown('a')
    expect(props.onApprove).toHaveBeenCalledTimes(1)
  })

  it("'e' → onEditVideo(active.id)", () => {
    const props = renderController()
    dispatchKeydown('e')
    expect(props.onEditVideo).toHaveBeenCalledWith('1')
  })

  it('批量模式：A/R/S/E 暂停（batchSafe 守卫）', () => {
    const props = renderController({ batchModeOn: true })
    dispatchKeydown('a')
    dispatchKeydown('r')
    dispatchKeydown('e')
    expect(props.onApprove).not.toHaveBeenCalled()
    expect(props.onRejectOpen).not.toHaveBeenCalled()
    expect(props.onEditVideo).not.toHaveBeenCalled()
  })

  it('批量模式：J 导航仍生效（batchSafe:true）', () => {
    const props = renderController({ batchModeOn: true })
    dispatchKeydown('j')
    expect(props.setActiveIdx).toHaveBeenCalled()
  })

  it("'shift+?' → help 浮层渲染", async () => {
    renderController()
    dispatchKeydown('?', { shiftKey: true })
    await waitFor(() => expect(screen.getByTestId('moderation-keyboard-help')).toBeTruthy())
    expect(screen.getByText('键盘快捷键')).toBeTruthy()
  })
})
