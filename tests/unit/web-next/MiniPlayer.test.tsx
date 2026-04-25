import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'

// ── 全局 mock：matchMedia / scrollY ───────────────────────────────

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
})

afterEach(() => {
  // clearAllMocks：清 call history，不清 mockImplementation（避免 matchMedia 被 restoreAllMocks 重置为 undefined）
  vi.clearAllMocks()
})

// ── next/navigation ──────────────────────────────────────────────

const mockPush = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useParams: () => ({ locale: 'zh-CN' }),
}))

// ── playerStore ──────────────────────────────────────────────────

const { mockPlayerState } = vi.hoisted(() => ({
  mockPlayerState: {
    shortId: null as string | null,
    hostOrigin: null as { href: string; slug: string } | null,
    geometry: null,
    takeoverActive: false,
    setGeometry: vi.fn(),
    releaseMiniPlayer: vi.fn(),
  },
}))

vi.mock('@/stores/playerStore', () => ({
  usePlayerStore: (selector: (s: typeof mockPlayerState) => unknown) =>
    selector(mockPlayerState),
}))

// ── drag.ts（纯 DOM pointer events，单元测试中不执行）────────────

vi.mock('@/lib/mini-player/drag', () => ({
  attachMiniPlayerDrag: () => () => {},
  attachViewportResizeWatcher: () => () => {},
}))

// ── 测试工具：重置 mock 状态 ──────────────────────────────────────

beforeEach(() => {
  mockPlayerState.shortId = null
  mockPlayerState.hostOrigin = null
  mockPlayerState.takeoverActive = false
  mockPlayerState.setGeometry.mockReset()
  mockPlayerState.releaseMiniPlayer.mockReset()
  mockPush.mockReset()
})

// ── 测试套件 ─────────────────────────────────────────────────────

describe('MiniPlayer', () => {
  it('渲染 role="region" aria-label="迷你播放器"', async () => {
    const { MiniPlayer } = await import('@/app/[locale]/_lib/player/MiniPlayer')
    render(<MiniPlayer />)
    expect(screen.getByRole('region', { name: '迷你播放器' })).toBeTruthy()
  })

  it('无 shortId 时显示 mini-no-source', async () => {
    const { MiniPlayer } = await import('@/app/[locale]/_lib/player/MiniPlayer')
    render(<MiniPlayer />)
    expect(screen.getByTestId('mini-no-source')).toBeTruthy()
  })

  it('有 shortId 时不显示 mini-no-source', async () => {
    mockPlayerState.shortId = 'abc123'
    const { MiniPlayer } = await import('@/app/[locale]/_lib/player/MiniPlayer')
    render(<MiniPlayer />)
    expect(screen.queryByTestId('mini-no-source')).toBeNull()
  })

  it('Esc 键触发 releaseMiniPlayer', async () => {
    const { MiniPlayer } = await import('@/app/[locale]/_lib/player/MiniPlayer')
    render(<MiniPlayer />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(mockPlayerState.releaseMiniPlayer).toHaveBeenCalledTimes(1)
  })

  it('关闭按钮触发 releaseMiniPlayer', async () => {
    const { MiniPlayer } = await import('@/app/[locale]/_lib/player/MiniPlayer')
    render(<MiniPlayer />)
    fireEvent.click(screen.getByRole('button', { name: '关闭播放器' }))
    expect(mockPlayerState.releaseMiniPlayer).toHaveBeenCalledTimes(1)
  })

  it('无 hostOrigin 时返回按钮 aria-disabled="true"', async () => {
    const { MiniPlayer } = await import('@/app/[locale]/_lib/player/MiniPlayer')
    render(<MiniPlayer />)
    const btn = screen.getByTestId('mini-player-return-btn')
    expect(btn.getAttribute('aria-disabled')).toBe('true')
  })

  it('有 hostOrigin.slug 时返回按钮 aria-disabled="false"', async () => {
    mockPlayerState.hostOrigin = { href: '/watch/test-slug', slug: 'test-slug' }
    const { MiniPlayer } = await import('@/app/[locale]/_lib/player/MiniPlayer')
    render(<MiniPlayer />)
    const btn = screen.getByTestId('mini-player-return-btn')
    expect(btn.getAttribute('aria-disabled')).toBe('false')
  })

  it('点击返回按钮 → router.push 到 /watch', async () => {
    mockPlayerState.hostOrigin = { href: '/watch/test-slug', slug: 'test-slug' }
    const { MiniPlayer } = await import('@/app/[locale]/_lib/player/MiniPlayer')
    render(<MiniPlayer />)
    fireEvent.click(screen.getByTestId('mini-player-return-btn'))
    expect(mockPush).toHaveBeenCalledWith('/zh-CN/watch/test-slug')
  })

  it('展开/折叠按钮初始 aria-expanded="false"', async () => {
    const { MiniPlayer } = await import('@/app/[locale]/_lib/player/MiniPlayer')
    render(<MiniPlayer />)
    const btn = screen.getByTestId('mini-player-toggle-expand')
    expect(btn.getAttribute('aria-expanded')).toBe('false')
    expect(btn.getAttribute('aria-label')).toBe('展开')
  })

  it('点击展开按钮后 aria-expanded="true"，aria-label 变为"折叠"', async () => {
    const { MiniPlayer } = await import('@/app/[locale]/_lib/player/MiniPlayer')
    render(<MiniPlayer />)
    const btn = screen.getByTestId('mini-player-toggle-expand')
    await act(async () => { fireEvent.click(btn) })
    expect(btn.getAttribute('aria-expanded')).toBe('true')
    expect(btn.getAttribute('aria-label')).toBe('折叠')
  })

  it('Expanded 时控制栏占位元素存在', async () => {
    const { MiniPlayer } = await import('@/app/[locale]/_lib/player/MiniPlayer')
    render(<MiniPlayer />)
    const btn = screen.getByTestId('mini-player-toggle-expand')
    await act(async () => { fireEvent.click(btn) })
    expect(screen.getByTestId('mini-player-progress')).toBeTruthy()
    expect(screen.getByTestId('mini-player-mute')).toBeTruthy()
  })

  it('takeoverActive=true 时容器 display:none', async () => {
    mockPlayerState.takeoverActive = true
    const { MiniPlayer } = await import('@/app/[locale]/_lib/player/MiniPlayer')
    render(<MiniPlayer />)
    const container = screen.getByTestId('mini-player')
    expect(container.style.display).toBe('none')
  })

  it('data-testid 占位元素全部存在', async () => {
    const { MiniPlayer } = await import('@/app/[locale]/_lib/player/MiniPlayer')
    render(<MiniPlayer />)
    expect(screen.getByTestId('mini-player-return-btn')).toBeTruthy()
    expect(screen.getByTestId('mini-player-toggle-expand')).toBeTruthy()
    expect(screen.getByTestId('mini-player-play-pause')).toBeTruthy()
    expect(screen.getByTestId('mini-loading')).toBeTruthy()
    expect(screen.getByTestId('mini-error')).toBeTruthy()
    expect(screen.getByTestId('mini-no-source')).toBeTruthy()
  })
})
