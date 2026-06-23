/**
 * use-watch-slug-sync.test.tsx — BUGFIX-WATCH-EP-URL（Bug 1）
 *
 * useWatchSlugSync 进入 watch 页时的初始化口径：
 * - closed/pip + 不同 slug → initPlayer(extractShortId(slug), URL ?ep)（曾写死 (slug, 1)）
 * - sameSlug（mini→full 交接）→ 仅 setHostMode('full')，不 initPlayer（不回归断点续播）
 * - busy + 不同 slug → needsConfirm；confirm() 同样按 ?ep + extractShortId 初始化
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const searchParamsGet = vi.fn().mockReturnValue(null)
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), back: vi.fn(), push: vi.fn() }),
  useSearchParams: () => ({ get: searchParamsGet }),
}))

const { initPlayerMock, setHostModeMock, mockState } = vi.hoisted(() => {
  const state = {
    hostMode: 'closed' as 'closed' | 'full' | 'mini' | 'pip',
    hostOrigin: null as { href: string; slug: string } | null,
    isHydrated: true,
    initPlayer: vi.fn(),
    setHostMode: vi.fn(),
  }
  return { initPlayerMock: state.initPlayer, setHostModeMock: state.setHostMode, mockState: state }
})

vi.mock('@/stores/playerStore', () => {
  const usePlayerStore = (selector?: (s: typeof mockState) => unknown) =>
    selector ? selector(mockState) : mockState
  return { usePlayerStore }
})

import { renderHook, act, cleanup } from '@testing-library/react'
import { useWatchSlugSync } from '../../../apps/web-next/src/app/[locale]/watch/[slug]/_hooks/use-watch-slug-sync'

const SLUG = 'three-body-aB3kR9x1'
const SHORT = 'aB3kR9x1'

describe('useWatchSlugSync — BUGFIX-WATCH-EP-URL', () => {
  beforeEach(() => {
    initPlayerMock.mockClear()
    setHostModeMock.mockClear()
    searchParamsGet.mockReset()
    searchParamsGet.mockReturnValue(null)
    mockState.hostMode = 'closed'
    mockState.hostOrigin = null
    mockState.isHydrated = true
  })

  afterEach(() => cleanup())

  it('closed + 不同 slug + ?ep=3 → initPlayer(extractShortId, 3) 而非 (slug, 1)', () => {
    searchParamsGet.mockImplementation((k: string) => (k === 'ep' ? '3' : null))
    renderHook(() => useWatchSlugSync(SLUG))
    expect(initPlayerMock).toHaveBeenCalledWith(SHORT, 3)
    expect(setHostModeMock).toHaveBeenCalledWith('full', { href: `/watch/${SLUG}`, slug: SLUG })
  })

  it('无 ?ep → 默认第 1 集（仍用 extractShortId）', () => {
    renderHook(() => useWatchSlugSync(SLUG))
    expect(initPlayerMock).toHaveBeenCalledWith(SHORT, 1)
  })

  it('sameSlug（mini→full 交接）→ 不调 initPlayer，仅 setHostMode(full)', () => {
    mockState.hostMode = 'mini'
    mockState.hostOrigin = { href: `/watch/${SLUG}`, slug: SLUG }
    searchParamsGet.mockImplementation((k: string) => (k === 'ep' ? '1' : null))
    renderHook(() => useWatchSlugSync(SLUG))
    expect(initPlayerMock).not.toHaveBeenCalled()
    expect(setHostModeMock).toHaveBeenCalledWith('full')
  })

  it('busy + 不同 slug → needsConfirm；confirm() 按 ?ep 初始化', () => {
    mockState.hostMode = 'mini'
    mockState.hostOrigin = { href: '/watch/other-CCCCCCCC', slug: 'other-CCCCCCCC' }
    searchParamsGet.mockImplementation((k: string) => (k === 'ep' ? '5' : null))
    const { result } = renderHook(() => useWatchSlugSync(SLUG))
    expect(result.current.needsConfirm).toBe(true)
    expect(initPlayerMock).not.toHaveBeenCalled()
    act(() => {
      result.current.confirm()
    })
    expect(initPlayerMock).toHaveBeenCalledWith(SHORT, 5)
  })
})
