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
    isMuted: false,
    volume: 1,
    flipOrigin: null,
    currentEpisode: 1,
    setGeometry: vi.fn(),
    setHostMode: vi.fn(),
    releaseMiniPlayer: vi.fn(),
    setFlipOrigin: vi.fn(),
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
    videoTitle: null as string | null,
    videoEpisodeCount: 0,
    handleToggleMute: vi.fn(),
    handleTogglePlay: vi.fn(),
    handleVideoCanPlay: vi.fn(),
    handleVideoPlay: vi.fn(),
    handleVideoPause: vi.fn(),
    handleVideoError: vi.fn(),
    handleVideoTimeUpdate: vi.fn(),
    handleVideoLoadedMetadata: vi.fn(),
    handleVideoLoadedData: vi.fn(),
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
  mockPlayerState.currentEpisode = 1
  mockPlayerState.setGeometry.mockReset()
  mockPlayerState.setHostMode.mockReset()
  mockPlayerState.releaseMiniPlayer.mockReset()
  mockPlayerState.setFlipOrigin.mockReset()
  mockPush.mockReset()
  // reset video state
  mockVideoState.activeSrc = null
  mockVideoState.videoStatus = 'no-src'
  mockVideoState.isMuted = false
  mockVideoState.localCurrentTime = 0
  mockVideoState.localDuration = 0
  mockVideoState.videoTitle = null
  mockVideoState.videoEpisodeCount = 0
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

  // HANDOFF-36: 展开按钮已移除，控制栏改为 hover 显示且永远在 DOM 中
  it('HANDOFF-36：控制栏永远在 DOM 中（不再依赖 expand 切换）', async () => {
    const { MiniPlayer } = await import('@/app/[locale]/_lib/player/MiniPlayer')
    render(<MiniPlayer />)
    expect(screen.getByTestId('mini-player-controls')).toBeTruthy()
    expect(screen.getByTestId('mini-player-progress')).toBeTruthy()
    expect(screen.getByTestId('mini-player-mute')).toBeTruthy()
  })

  it('HANDOFF-36：控制栏初始 opacity=0（未 hover），mouseEnter 后 opacity=1', async () => {
    const { MiniPlayer } = await import('@/app/[locale]/_lib/player/MiniPlayer')
    render(<MiniPlayer />)
    const controls = screen.getByTestId('mini-player-controls')
    expect(controls.style.opacity).toBe('0')
    await act(async () => {
      fireEvent.mouseEnter(screen.getByTestId('mini-player'))
    })
    expect(controls.style.opacity).toBe('1')
  })

  it('HANDOFF-36：toggle-expand 按钮已被移除', async () => {
    const { MiniPlayer } = await import('@/app/[locale]/_lib/player/MiniPlayer')
    render(<MiniPlayer />)
    expect(screen.queryByTestId('mini-player-toggle-expand')).toBeNull()
  })

  it('HANDOFF-36：无 shortId 时 header 显示"迷你播放器"', async () => {
    const { MiniPlayer } = await import('@/app/[locale]/_lib/player/MiniPlayer')
    render(<MiniPlayer />)
    expect(screen.getByTestId('mini-player-title').textContent).toContain('迷你播放器')
    expect(screen.queryByTestId('mini-player-episode')).toBeNull()
  })

  it('HANDOFF-36：有 shortId 但 title 未到位时显示"正在加载…"', async () => {
    mockPlayerState.shortId = 'abc'
    mockVideoState.videoTitle = null
    const { MiniPlayer } = await import('@/app/[locale]/_lib/player/MiniPlayer')
    render(<MiniPlayer />)
    expect(screen.getByTestId('mini-player-title').textContent).toContain('正在加载')
  })

  it('HANDOFF-36：title 到位 + episodeCount>1 时显示标题 + 第N集', async () => {
    mockPlayerState.shortId = 'abc'
    mockPlayerState.currentEpisode = 3
    mockVideoState.videoTitle = '进击的巨人'
    mockVideoState.videoEpisodeCount = 25
    const { MiniPlayer } = await import('@/app/[locale]/_lib/player/MiniPlayer')
    render(<MiniPlayer />)
    expect(screen.getByTestId('mini-player-title').textContent).toContain('进击的巨人')
    expect(screen.getByTestId('mini-player-episode').textContent).toContain('第 3 集')
  })

  it('HANDOFF-36：episodeCount=1（电影）时不显示集数', async () => {
    mockPlayerState.shortId = 'abc'
    mockPlayerState.currentEpisode = 1
    mockVideoState.videoTitle = '某电影'
    mockVideoState.videoEpisodeCount = 1
    const { MiniPlayer } = await import('@/app/[locale]/_lib/player/MiniPlayer')
    render(<MiniPlayer />)
    expect(screen.getByTestId('mini-player-title').textContent).toContain('某电影')
    expect(screen.queryByTestId('mini-player-episode')).toBeNull()
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
    expect(screen.getByTestId('mini-player-controls')).toBeTruthy()
    expect(screen.getByTestId('mini-player-title')).toBeTruthy()
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

  it('play/pause 按钮 aria-label 随 isPlaying 变化（HANDOFF-36：控制栏永远在 DOM）', async () => {
    mockVideoState.videoStatus = 'idle'
    mockPlayerState.isPlaying = true
    const { MiniPlayer } = await import('@/app/[locale]/_lib/player/MiniPlayer')
    render(<MiniPlayer />)
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
    const progressBar = screen.getByRole('slider')
    fireEvent.keyDown(progressBar, { key: 'ArrowLeft' })
    expect(mockVideoState.handleSeek).toHaveBeenCalledTimes(1)
  })
})

// ── HANDOFF-34 P2 体验增强 ────────────────────────────────────────

describe('MiniPlayer — HANDOFF-34 P2-2 video 清理方式', () => {
  it('关闭按钮触发 releaseMiniPlayer（P2-2 行为不变）', async () => {
    const { MiniPlayer } = await import('@/app/[locale]/_lib/player/MiniPlayer')
    render(<MiniPlayer />)
    fireEvent.click(screen.getByRole('button', { name: '关闭播放器' }))
    expect(mockPlayerState.releaseMiniPlayer).toHaveBeenCalledTimes(1)
  })
})

describe('MiniPlayer — HANDOFF-34 P2-1 useCallback + FLIP', () => {
  it('有 hostOrigin 时点击返回按钮先调 setFlipOrigin 再调 setHostMode', async () => {
    mockPlayerState.hostOrigin = { href: '/watch/test-slug', slug: 'test-slug' }
    const { MiniPlayer } = await import('@/app/[locale]/_lib/player/MiniPlayer')
    render(<MiniPlayer />)
    const callOrder: string[] = []
    mockPlayerState.setFlipOrigin.mockImplementation(() => callOrder.push('setFlipOrigin'))
    mockPlayerState.setHostMode.mockImplementation(() => callOrder.push('setHostMode'))
    fireEvent.click(screen.getByTestId('mini-player-return-btn'))
    expect(callOrder[0]).toBe('setFlipOrigin')
    expect(callOrder[1]).toBe('setHostMode')
  })

  it('无 hostOrigin 时点击返回按钮不调 setFlipOrigin', async () => {
    mockPlayerState.hostOrigin = null
    const { MiniPlayer } = await import('@/app/[locale]/_lib/player/MiniPlayer')
    render(<MiniPlayer />)
    fireEvent.click(screen.getByTestId('mini-player-return-btn'))
    expect(mockPlayerState.setFlipOrigin).not.toHaveBeenCalled()
  })
})

describe('MiniPlayer — HANDOFF-34 resize handle 方向感知', () => {
  it('corner=br 时 resize handle 位于 top-left（bottom/right 未定义）', async () => {
    mockPlayerState.geometry = { v: 1 as const, width: 320, height: 180, corner: 'br' as const }
    const { MiniPlayer } = await import('@/app/[locale]/_lib/player/MiniPlayer')
    render(<MiniPlayer />)
    const handle = screen.getByTestId('mini-player-resize-handle')
    expect(handle.style.top).toBe('0px')
    expect(handle.style.left).toBe('0px')
  })

  it('corner=tl 时 resize handle 位于 bottom-right', async () => {
    mockPlayerState.geometry = { v: 1 as const, width: 320, height: 180, corner: 'tl' as const }
    const { MiniPlayer } = await import('@/app/[locale]/_lib/player/MiniPlayer')
    render(<MiniPlayer />)
    const handle = screen.getByTestId('mini-player-resize-handle')
    expect(handle.style.bottom).toBe('0px')
    expect(handle.style.right).toBe('0px')
  })

  it('corner=tr 时 resize handle 位于 bottom-left', async () => {
    mockPlayerState.geometry = { v: 1 as const, width: 320, height: 180, corner: 'tr' as const }
    const { MiniPlayer } = await import('@/app/[locale]/_lib/player/MiniPlayer')
    render(<MiniPlayer />)
    const handle = screen.getByTestId('mini-player-resize-handle')
    expect(handle.style.bottom).toBe('0px')
    expect(handle.style.left).toBe('0px')
  })

  it('corner=bl 时 resize handle 位于 top-right', async () => {
    mockPlayerState.geometry = { v: 1 as const, width: 320, height: 180, corner: 'bl' as const }
    const { MiniPlayer } = await import('@/app/[locale]/_lib/player/MiniPlayer')
    render(<MiniPlayer />)
    const handle = screen.getByTestId('mini-player-resize-handle')
    expect(handle.style.top).toBe('0px')
    expect(handle.style.right).toBe('0px')
  })
})
