import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react'

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
    isPlaying: false,
    setGeometry: vi.fn(),
    setHostMode: vi.fn(),
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

// ── useMiniPlayerVideo（控制视频状态）────────────────────────────

const { mockVideoState } = vi.hoisted(() => ({
  mockVideoState: {
    activeSrc: null as string | null,
    videoStatus: 'no-src' as import('@/app/[locale]/_lib/player/useMiniPlayerVideo').VideoStatus,
    isMuted: false,
    localCurrentTime: 0,
    localDuration: 0,
    handleToggleMute: vi.fn(),
    handleTogglePlay: vi.fn(),
    handleVideoCanPlay: vi.fn(),
    handleVideoPlay: vi.fn(),
    handleVideoPause: vi.fn(),
    handleVideoError: vi.fn(),
    handleVideoTimeUpdate: vi.fn(),
    handleVideoLoadedMetadata: vi.fn(),
    handleAutoplayBlockedClick: vi.fn(),
    handleSeek: vi.fn(),
  },
}))

vi.mock('@/app/[locale]/_lib/player/useMiniPlayerVideo', () => ({
  useMiniPlayerVideo: () => mockVideoState,
}))

// ── 测试工具：重置 mock 状态 ──────────────────────────────────────

beforeEach(() => {
  mockPlayerState.shortId = null
  mockPlayerState.hostOrigin = null
  mockPlayerState.takeoverActive = false
  mockPlayerState.isPlaying = false
  mockPlayerState.setGeometry.mockReset()
  mockPlayerState.setHostMode.mockReset()
  mockPlayerState.releaseMiniPlayer.mockReset()
  mockPush.mockReset()
  // reset video state
  mockVideoState.activeSrc = null
  mockVideoState.videoStatus = 'no-src'
  mockVideoState.isMuted = false
  mockVideoState.localCurrentTime = 0
  mockVideoState.localDuration = 0
  mockVideoState.handleTogglePlay.mockReset()
  mockVideoState.handleToggleMute.mockReset()
  mockVideoState.handleAutoplayBlockedClick.mockReset()
  mockVideoState.handleSeek.mockReset()
})

// ── HANDOFF-31 基础测试（不变）──────────────────────────────────

describe('MiniPlayer', () => {
  it('渲染 role="region" aria-label="迷你播放器"', async () => {
    const { MiniPlayer } = await import('@/app/[locale]/_lib/player/MiniPlayer')
    render(<MiniPlayer />)
    expect(screen.getByRole('region', { name: '迷你播放器' })).toBeTruthy()
  })

  it('无 shortId + videoStatus=no-src 时显示 mini-no-source', async () => {
    const { MiniPlayer } = await import('@/app/[locale]/_lib/player/MiniPlayer')
    render(<MiniPlayer />)
    expect(screen.getByTestId('mini-no-source')).toBeTruthy()
  })

  it('videoStatus=idle 时不显示 mini-no-source', async () => {
    mockVideoState.videoStatus = 'idle'
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
    expect(screen.getByTestId('mini-play-overlay')).toBeTruthy()
    expect(screen.getByTestId('mini-loading')).toBeTruthy()
    expect(screen.getByTestId('mini-error')).toBeTruthy()
    expect(screen.getByTestId('mini-no-source')).toBeTruthy()
  })
})

// ── HANDOFF-32 视频交互测试 ──────────────────────────────────────

describe('MiniPlayer — HANDOFF-32 视频状态', () => {
  it('videoStatus=loading 时显示 mini-loading，不显示 mini-no-source', async () => {
    mockVideoState.videoStatus = 'loading'
    mockPlayerState.shortId = 'abc123'
    const { MiniPlayer } = await import('@/app/[locale]/_lib/player/MiniPlayer')
    render(<MiniPlayer />)
    const loadingEl = screen.getByTestId('mini-loading')
    expect(loadingEl.style.display).toBe('flex')
    expect(screen.queryByTestId('mini-no-source')).toBeNull()
  })

  it('videoStatus=error 时显示 mini-error overlay（播放失败文案）', async () => {
    mockVideoState.videoStatus = 'error'
    const { MiniPlayer } = await import('@/app/[locale]/_lib/player/MiniPlayer')
    render(<MiniPlayer />)
    const errorEl = screen.getByTestId('mini-error')
    expect(errorEl.style.display).toBe('flex')
    expect(errorEl.textContent).toContain('播放失败')
  })

  it('videoStatus=autoplay-blocked 时显示 play 图标和"点击播放"文案', async () => {
    mockVideoState.videoStatus = 'autoplay-blocked'
    mockPlayerState.shortId = 'abc123'
    const { MiniPlayer } = await import('@/app/[locale]/_lib/player/MiniPlayer')
    render(<MiniPlayer />)
    expect(screen.getByText('点击播放')).toBeTruthy()
    expect(screen.queryByTestId('mini-no-source')).toBeNull()
  })

  it('videoStatus=idle + isPlaying=false 时 mini-play-overlay display:flex（暂停图标）', async () => {
    mockVideoState.videoStatus = 'idle'
    mockPlayerState.isPlaying = false
    const { MiniPlayer } = await import('@/app/[locale]/_lib/player/MiniPlayer')
    render(<MiniPlayer />)
    const overlay = screen.getByTestId('mini-play-overlay')
    expect(overlay.style.display).toBe('flex')
  })

  it('videoStatus=idle + isPlaying=true + 未 hover 时 mini-play-overlay 隐藏', async () => {
    mockVideoState.videoStatus = 'idle'
    mockPlayerState.isPlaying = true
    const { MiniPlayer } = await import('@/app/[locale]/_lib/player/MiniPlayer')
    render(<MiniPlayer />)
    const overlay = screen.getByTestId('mini-play-overlay')
    expect(overlay.style.display).toBe('none')
  })

  it('handleClose 调用后 releaseMiniPlayer 被触发', async () => {
    const { MiniPlayer } = await import('@/app/[locale]/_lib/player/MiniPlayer')
    render(<MiniPlayer />)
    fireEvent.click(screen.getByRole('button', { name: '关闭播放器' }))
    expect(mockPlayerState.releaseMiniPlayer).toHaveBeenCalledTimes(1)
  })

  it('activeSrc 非空时 video 元素出现在 DOM 中', async () => {
    // 模拟 hook 已解析出播放地址（含 fallback 到 sources[0] 的情况）
    mockVideoState.activeSrc = 'http://cdn.example.com/sources0.mp4'
    mockVideoState.videoStatus = 'loading'
    const { MiniPlayer } = await import('@/app/[locale]/_lib/player/MiniPlayer')
    render(<MiniPlayer />)
    await waitFor(() => {
      const video = document.querySelector('video')
      expect(video).not.toBeNull()
    })
  })

  it('Expanded 时 play/pause 按钮 aria-label 随 isPlaying 变化', async () => {
    mockVideoState.videoStatus = 'idle'
    mockPlayerState.isPlaying = true
    const { MiniPlayer } = await import('@/app/[locale]/_lib/player/MiniPlayer')
    render(<MiniPlayer />)
    const toggleBtn = screen.getByTestId('mini-player-toggle-expand')
    await act(async () => { fireEvent.click(toggleBtn) })
    const playPauseBtn = screen.getByTestId('mini-player-play-pause')
    expect(playPauseBtn.getAttribute('aria-label')).toBe('暂停')
  })

  it('m 键触发 handleToggleMute', async () => {
    const { MiniPlayer } = await import('@/app/[locale]/_lib/player/MiniPlayer')
    render(<MiniPlayer />)
    fireEvent.keyDown(document, { key: 'm' })
    expect(mockVideoState.handleToggleMute).toHaveBeenCalledTimes(1)
  })
})

// ── HANDOFF-33 主路径治理测试 ────────────────────────────────────

describe('MiniPlayer — HANDOFF-33 P1-1 快捷键守卫', () => {
  it('input 聚焦时 Esc 不触发 releaseMiniPlayer', async () => {
    const { MiniPlayer } = await import('@/app/[locale]/_lib/player/MiniPlayer')
    render(<MiniPlayer />)
    const input = document.createElement('input')
    document.body.appendChild(input)
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(mockPlayerState.releaseMiniPlayer).not.toHaveBeenCalled()
    document.body.removeChild(input)
  })

  it('textarea 聚焦时 m 键不触发 handleToggleMute', async () => {
    const { MiniPlayer } = await import('@/app/[locale]/_lib/player/MiniPlayer')
    render(<MiniPlayer />)
    const textarea = document.createElement('textarea')
    document.body.appendChild(textarea)
    fireEvent.keyDown(textarea, { key: 'm' })
    expect(mockVideoState.handleToggleMute).not.toHaveBeenCalled()
    document.body.removeChild(textarea)
  })

  it('dialog[aria-modal="true"] 打开时 Esc 不触发 releaseMiniPlayer', async () => {
    const { MiniPlayer } = await import('@/app/[locale]/_lib/player/MiniPlayer')
    render(<MiniPlayer />)
    const dialog = document.createElement('div')
    dialog.setAttribute('role', 'dialog')
    dialog.setAttribute('aria-modal', 'true')
    document.body.appendChild(dialog)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(mockPlayerState.releaseMiniPlayer).not.toHaveBeenCalled()
    document.body.removeChild(dialog)
  })

  it('非 editable 元素且无 modal 时 Esc 正常触发 releaseMiniPlayer', async () => {
    const { MiniPlayer } = await import('@/app/[locale]/_lib/player/MiniPlayer')
    render(<MiniPlayer />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(mockPlayerState.releaseMiniPlayer).toHaveBeenCalledTimes(1)
  })
})

describe('MiniPlayer — HANDOFF-33 P1-2 返回按钮竞态修复', () => {
  it('点击返回按钮 → 先调 setHostMode("full") 再 router.push', async () => {
    mockPlayerState.hostOrigin = { href: '/watch/test-slug', slug: 'test-slug' }
    const { MiniPlayer } = await import('@/app/[locale]/_lib/player/MiniPlayer')
    render(<MiniPlayer />)
    const callOrder: string[] = []
    mockPlayerState.setHostMode.mockImplementation(() => callOrder.push('setHostMode'))
    mockPush.mockImplementation(() => callOrder.push('push'))
    fireEvent.click(screen.getByTestId('mini-player-return-btn'))
    expect(callOrder).toEqual(['setHostMode', 'push'])
    expect(mockPlayerState.setHostMode).toHaveBeenCalledWith('full')
    expect(mockPush).toHaveBeenCalledWith('/zh-CN/watch/test-slug')
  })

  it('无 hostOrigin 时点击返回按钮不调 setHostMode 和 router.push', async () => {
    mockPlayerState.hostOrigin = null
    const { MiniPlayer } = await import('@/app/[locale]/_lib/player/MiniPlayer')
    render(<MiniPlayer />)
    fireEvent.click(screen.getByTestId('mini-player-return-btn'))
    expect(mockPlayerState.setHostMode).not.toHaveBeenCalled()
    expect(mockPush).not.toHaveBeenCalled()
  })
})

describe('MiniPlayer — HANDOFF-33 P1-3 键盘 seek 立即调 handleSeek', () => {
  function setupVideoWithDuration(duration: number) {
    // JSDOM 不支持 media，需要手动 stub video 元素的 duration
    const proto = window.HTMLVideoElement.prototype
    Object.defineProperty(proto, 'duration', { get: () => duration, configurable: true })
    Object.defineProperty(proto, 'currentTime', {
      get: () => 30,
      set: () => {},
      configurable: true,
    })
  }

  afterEach(() => {
    // 恢复原始描述符，避免污染其他测试
    delete (window.HTMLVideoElement.prototype as Record<string, unknown>).duration
    delete (window.HTMLVideoElement.prototype as Record<string, unknown>).currentTime
  })

  it('进度条 ArrowRight → handleSeek 被调用', async () => {
    setupVideoWithDuration(120)
    mockVideoState.activeSrc = 'https://example.com/video.mp4'
    mockVideoState.videoStatus = 'idle'
    mockVideoState.localDuration = 120
    mockVideoState.localCurrentTime = 30
    mockPlayerState.shortId = 'abc123'
    mockPlayerState.isPlaying = true
    const { MiniPlayer } = await import('@/app/[locale]/_lib/player/MiniPlayer')
    render(<MiniPlayer />)
    fireEvent.click(screen.getByTestId('mini-player-toggle-expand'))
    const progressBar = screen.getByRole('slider')
    fireEvent.keyDown(progressBar, { key: 'ArrowRight' })
    expect(mockVideoState.handleSeek).toHaveBeenCalledTimes(1)
  })

  it('进度条 ArrowLeft → handleSeek 被调用', async () => {
    setupVideoWithDuration(120)
    mockVideoState.activeSrc = 'https://example.com/video.mp4'
    mockVideoState.videoStatus = 'idle'
    mockVideoState.localDuration = 120
    mockVideoState.localCurrentTime = 30
    mockPlayerState.shortId = 'abc123'
    mockPlayerState.isPlaying = true
    const { MiniPlayer } = await import('@/app/[locale]/_lib/player/MiniPlayer')
    render(<MiniPlayer />)
    fireEvent.click(screen.getByTestId('mini-player-toggle-expand'))
    const progressBar = screen.getByRole('slider')
    fireEvent.keyDown(progressBar, { key: 'ArrowLeft' })
    expect(mockVideoState.handleSeek).toHaveBeenCalledTimes(1)
  })
})
