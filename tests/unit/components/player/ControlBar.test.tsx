/**
 * tests/unit/components/player/ControlBar.test.tsx
 * PLAYER-04: ControlBar 音量hover展开、移动端滑条隐藏、键盘状态机优先级
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ControlBar } from '@/components/player/ControlBar'
import { usePlayerStore } from '@/stores/playerStore'

// ── Mocks ─────────────────────────────────────────────────────────

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))

// Mock Video.js player instance
const mockPlayer = {
  play: vi.fn().mockResolvedValue(undefined),
  pause: vi.fn(),
  currentTime: vi.fn().mockReturnValue(0),
  volume: vi.fn(),
  muted: vi.fn(),
  isFullscreen: vi.fn().mockReturnValue(false),
  requestFullscreen: vi.fn().mockResolvedValue(undefined),
  exitFullscreen: vi.fn().mockResolvedValue(undefined),
  playbackRate: vi.fn(),
}

// ── 测试 ──────────────────────────────────────────────────────────

describe('ControlBar', () => {
  beforeEach(() => {
    // 重置 playerStore
    usePlayerStore.setState({
      isPlaying: false,
      volume: 0.8,
      isMuted: false,
      playbackSpeed: 1.0,
      currentTime: 60,
      duration: 3600,
      mode: 'default',
      isSpeedPanelOpen: false,
      isCCPanelOpen: false,
      isSettingsPanelOpen: false,
    })
    vi.clearAllMocks()
  })

  it('渲染控制栏', () => {
    render(<ControlBar player={null} />)
    expect(screen.getByTestId('control-bar')).toBeTruthy()
    expect(screen.getByTestId('play-pause-btn')).toBeTruthy()
    expect(screen.getByTestId('mute-btn')).toBeTruthy()
    expect(screen.getByTestId('time-display')).toBeTruthy()
  })

  it('播放状态未激活时显示播放按钮', () => {
    render(<ControlBar player={null} />)
    const btn = screen.getByTestId('play-pause-btn')
    expect(btn.textContent).toContain('▶')
  })

  it('播放状态激活时显示暂停按钮', () => {
    usePlayerStore.setState({ isPlaying: true })
    render(<ControlBar player={null} />)
    const btn = screen.getByTestId('play-pause-btn')
    expect(btn.textContent).toContain('⏸')
  })

  it('点击播放按钮调用 player.play()', () => {
    usePlayerStore.setState({ isPlaying: false })
    render(<ControlBar player={mockPlayer as never} />)
    fireEvent.click(screen.getByTestId('play-pause-btn'))
    expect(mockPlayer.play).toHaveBeenCalledTimes(1)
  })

  it('点击暂停按钮调用 player.pause()', () => {
    usePlayerStore.setState({ isPlaying: true })
    render(<ControlBar player={mockPlayer as never} />)
    fireEvent.click(screen.getByTestId('play-pause-btn'))
    expect(mockPlayer.pause).toHaveBeenCalledTimes(1)
  })

  it('音量滑条初始不可见（通过 opacity-0 隐藏）', () => {
    render(<ControlBar player={null} />)
    const slider = screen.getByTestId('volume-slider')
    // 未 hover 时 opacity-0
    expect(slider.className).toContain('opacity-0')
  })

  it('鼠标进入音量区域后音量滑条可见', () => {
    render(<ControlBar player={null} />)
    const volumeControl = screen.getByTestId('volume-control')
    fireEvent.mouseEnter(volumeControl)
    const slider = screen.getByTestId('volume-slider')
    expect(slider.className).toContain('opacity-100')
  })

  it('音量滑条有 hidden sm:block 类（移动端隐藏）', () => {
    render(<ControlBar player={null} />)
    const slider = screen.getByTestId('volume-slider')
    expect(slider.className).toContain('hidden')
    expect(slider.className).toContain('sm:block')
  })

  it('时间显示格式正确（mm:ss / h:mm:ss）', () => {
    render(<ControlBar player={null} />)
    const timeDisplay = screen.getByTestId('time-display')
    // currentTime=60 → 01:00, duration=3600 → 1:00:00
    expect(timeDisplay.textContent).toContain('01:00')
    expect(timeDisplay.textContent).toContain('1:00:00')
  })

  it('点击倍速按钮打开 speedPanel', () => {
    const openPanel = vi.fn()
    usePlayerStore.setState({ isSpeedPanelOpen: false, openPanel } as never)
    render(<ControlBar player={null} />)
    fireEvent.click(screen.getByTestId('speed-btn'))
    expect(openPanel).toHaveBeenCalledWith('speed')
  })

  it('倍速按钮显示当前倍速值', () => {
    usePlayerStore.setState({ playbackSpeed: 1.5 })
    render(<ControlBar player={null} />)
    expect(screen.getByTestId('speed-btn').textContent).toContain('1.5x')
  })

  it('剧场模式按钮有 hidden lg:flex 类（移动端隐藏）', () => {
    render(<ControlBar player={null} />)
    const theaterBtn = screen.getByTestId('control-theater-btn')
    expect(theaterBtn.className).toContain('hidden')
    expect(theaterBtn.className).toContain('lg:flex')
  })
})

// ── PLAYER-05: 键盘状态机优先级测试 ──────────────────────────────

import { usePlayerShortcuts } from '@/components/player/usePlayerShortcuts'

function ShortcutsHarness({ player }: { player: typeof mockPlayer | null }) {
  usePlayerShortcuts({ player: player as never })
  return <div data-testid="shortcut-harness" />
}

describe('usePlayerShortcuts 键盘状态机', () => {
  beforeEach(() => {
    usePlayerStore.setState({
      isPlaying: false,
      isEpisodePanelOpen: false,
      isSpeedPanelOpen: false,
      isCCPanelOpen: false,
      isSettingsPanelOpen: false,
      volume: 0.8,
      isMuted: false,
      currentTime: 30,
      duration: 3600,
    })
    vi.clearAllMocks()
  })

  it('正常模式：Space 触发播放', () => {
    render(<ShortcutsHarness player={mockPlayer} />)
    mockPlayer.play.mockResolvedValue(undefined)
    mockPlayer.paused = vi.fn().mockReturnValue(true)
    fireEvent.keyDown(window, { key: ' ' })
    expect(mockPlayer.play).toHaveBeenCalledTimes(1)
  })

  it('正常模式：← 后退 5 秒', () => {
    render(<ShortcutsHarness player={mockPlayer} />)
    mockPlayer.currentTime.mockReturnValue(30)
    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    expect(mockPlayer.currentTime).toHaveBeenCalledWith(25)
  })

  it('正常模式：→ 前进 5 秒', () => {
    render(<ShortcutsHarness player={mockPlayer} />)
    mockPlayer.currentTime.mockReturnValue(30)
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(mockPlayer.currentTime).toHaveBeenCalledWith(35)
  })

  it('正常模式：M 切换静音', () => {
    const setMuted = vi.fn()
    usePlayerStore.setState({ setMuted } as never)
    render(<ShortcutsHarness player={mockPlayer} />)
    fireEvent.keyDown(window, { key: 'm' })
    expect(setMuted).toHaveBeenCalledWith(true)
  })

  it('选集浮层打开时：非 Esc 键不触发播放快捷键', () => {
    usePlayerStore.setState({ isEpisodePanelOpen: true })
    mockPlayer.paused = vi.fn().mockReturnValue(true)
    render(<ShortcutsHarness player={mockPlayer} />)
    fireEvent.keyDown(window, { key: ' ' })
    expect(mockPlayer.play).not.toHaveBeenCalled()
  })

  it('倍速面板打开时：正常播放快捷键不触发', () => {
    usePlayerStore.setState({ isSpeedPanelOpen: true })
    mockPlayer.paused = vi.fn().mockReturnValue(true)
    render(<ShortcutsHarness player={mockPlayer} />)
    fireEvent.keyDown(window, { key: ' ' })
    expect(mockPlayer.play).not.toHaveBeenCalled()
  })
})
