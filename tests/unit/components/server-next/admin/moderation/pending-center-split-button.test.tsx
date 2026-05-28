/**
 * pending-center-split-button.test.tsx — CHG-363-A SPLIT-UI -A
 *
 * 范围：PendingCenter "✂ 拆分" 按钮入口条件渲染 + 跳转 URL（plan §10.2 / plan #10）
 *
 * 覆盖：
 *  1. episodeCount > 1 → 拆分按钮显示
 *  2. episodeCount === 1 → 拆分按钮不显示（单集视频无拆分语义）
 *  3. 点击拆分按钮 → window.open(`/admin/merge?split=:videoId`, '_blank', noopener,noreferrer)
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, cleanup } from '@testing-library/react'

// next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
}))

// admin-ui stubs
vi.mock('@resovo/admin-ui', () => ({
  VisChip: () => null,
  DecisionCard: () => null,
  StaffNoteBar: () => null,
  Thumb: () => null,
}))

// EpisodeSelector / LinesPanel / AdminPlayer stubs
vi.mock(
  '../../../../../../apps/server-next/src/app/admin/moderation/_client/EpisodeSelector',
  () => ({ EpisodeSelector: () => null })
)
vi.mock(
  '../../../../../../apps/server-next/src/app/admin/moderation/_client/LinesPanel',
  () => ({ LinesPanel: () => null })
)
vi.mock(
  '../../../../../../apps/server-next/src/app/admin/moderation/_client/AdminPlayer',
  () => ({ AdminPlayer: () => null })
)

// useSelectedLine + api stubs
vi.mock(
  '../../../../../../apps/server-next/src/lib/moderation/use-selected-line',
  () => ({
    useSelectedLine: () => ({
      selected: null,
      onLineSelect: vi.fn(),
      clearSelection: vi.fn(),
    }),
  })
)
vi.mock('../../../../../../apps/server-next/src/lib/moderation/api', () => ({
  updateStaffNote: vi.fn(),
  fetchVideoLines: vi.fn().mockResolvedValue([]),
}))

import { PendingCenter } from '../../../../../../apps/server-next/src/app/admin/moderation/_client/PendingCenter'
import type { VideoQueueRow } from '@resovo/types'

const baseRow = (overrides: Partial<VideoQueueRow> = {}): VideoQueueRow =>
  ({
    id: '11111111-2222-3333-4444-555555555555',
    slug: 'test-slug',
    shortId: 'aB3kR9x1',
    title: '测试视频',
    type: 'movie',
    year: 2026,
    country: 'CN',
    rating: 8.5,
    episodeCount: 1,
    coverUrl: null,
    visibilityStatus: 'internal',
    reviewStatus: 'pending_review',
    badges: [],
    staffNote: null,
    submittedAt: '2026-05-01T00:00:00Z',
    ...overrides,
  }) as unknown as VideoQueueRow

const windowOpenSpy = vi.fn()

beforeEach(() => {
  windowOpenSpy.mockReset()
  vi.stubGlobal('open', windowOpenSpy)
  // jsdom 默认有 window.open；通过 vi.stubGlobal 重定向
  Object.defineProperty(window, 'open', {
    configurable: true,
    writable: true,
    value: windowOpenSpy,
  })
})

afterEach(() => {
  cleanup()
})

describe('PendingCenter — CHG-363-A "✂ 拆分" 按钮入口', () => {
  it('episodeCount > 1 → 拆分按钮显示', () => {
    render(
      <PendingCenter
        v={baseRow({ episodeCount: 12 })}
        onStaffNoteChange={vi.fn()}
        onEditVideo={vi.fn()}
      />
    )
    expect(screen.getByTestId('pending-center-split-button')).toBeTruthy()
  })

  it('episodeCount === 1 → 拆分按钮不显示（单集视频无拆分语义）', () => {
    render(
      <PendingCenter
        v={baseRow({ episodeCount: 1 })}
        onStaffNoteChange={vi.fn()}
        onEditVideo={vi.fn()}
      />
    )
    expect(screen.queryByTestId('pending-center-split-button')).toBeNull()
  })

  it('点击拆分按钮 → window.open(`/admin/merge?split=:videoId`, "_blank", "noopener,noreferrer")', () => {
    const row = baseRow({ episodeCount: 24, id: 'video-uuid-abc' })
    render(
      <PendingCenter
        v={row}
        onStaffNoteChange={vi.fn()}
        onEditVideo={vi.fn()}
      />
    )
    fireEvent.click(screen.getByTestId('pending-center-split-button'))
    expect(windowOpenSpy).toHaveBeenCalledWith(
      '/admin/merge?split=video-uuid-abc',
      '_blank',
      'noopener,noreferrer'
    )
  })
})
