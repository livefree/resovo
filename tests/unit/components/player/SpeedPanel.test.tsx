/**
 * tests/unit/components/player/SpeedPanel.test.tsx
 * PLAYER-04: SpeedPanel 4预设、数字键映射、←→拦截
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SpeedPanel } from '@/components/player/SpeedPanel'
import { usePlayerStore } from '@/stores/playerStore'

// ── Mocks ─────────────────────────────────────────────────────────

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))

const mockPlayer = {
  playbackRate: vi.fn(),
}

// ── 测试 ──────────────────────────────────────────────────────────

describe('SpeedPanel', () => {
  beforeEach(() => {
    usePlayerStore.setState({
      playbackSpeed: 1.0,
      isSpeedPanelOpen: true,
    })
    vi.clearAllMocks()
  })

  it('渲染 4 个预设按钮', () => {
    render(<SpeedPanel player={null} />)
    expect(screen.getByTestId('speed-preset-0.5')).toBeTruthy()
    expect(screen.getByTestId('speed-preset-1')).toBeTruthy()
    expect(screen.getByTestId('speed-preset-1.5')).toBeTruthy()
    expect(screen.getByTestId('speed-preset-2')).toBeTruthy()
  })

  it('点击预设按钮更新倍速', () => {
    const setPlaybackSpeed = vi.fn()
    usePlayerStore.setState({ setPlaybackSpeed } as never)
    render(<SpeedPanel player={mockPlayer as never} />)
    fireEvent.click(screen.getByTestId('speed-preset-1.5'))
    expect(setPlaybackSpeed).toHaveBeenCalledWith(1.5)
    expect(mockPlayer.playbackRate).toHaveBeenCalledWith(1.5)
  })

  it('当前倍速对应的预设按钮有金色高亮样式', () => {
    usePlayerStore.setState({ playbackSpeed: 1.0 })
    render(<SpeedPanel player={null} />)
    const active = screen.getByTestId('speed-preset-1')
    // 激活样式有 font-semibold
    expect(active.className).toContain('font-semibold')
  })

  it('渲染自定义滑条', () => {
    render(<SpeedPanel player={null} />)
    expect(screen.getByTestId('speed-slider')).toBeTruthy()
  })

  it('数字键 1 选择 0.5x 预设', () => {
    const setPlaybackSpeed = vi.fn()
    usePlayerStore.setState({ setPlaybackSpeed, isSpeedPanelOpen: true } as never)
    render(<SpeedPanel player={mockPlayer as never} />)
    // 模拟键盘事件（捕获阶段）
    const event = new KeyboardEvent('keydown', { key: '2', bubbles: true, cancelable: true })
    // stopPropagation spy
    const stopPropSpy = vi.spyOn(event, 'stopPropagation')
    window.dispatchEvent(event)
    expect(stopPropSpy).toHaveBeenCalled()
    expect(setPlaybackSpeed).toHaveBeenCalledWith(1.0) // key '2' → 1.0x
  })

  it('← → 键事件被拦截（stopPropagation）', () => {
    usePlayerStore.setState({ playbackSpeed: 1.0, isSpeedPanelOpen: true })
    render(<SpeedPanel player={mockPlayer as never} />)
    const event = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true })
    const stopPropSpy = vi.spyOn(event, 'stopPropagation')
    window.dispatchEvent(event)
    expect(stopPropSpy).toHaveBeenCalled()
  })
})
