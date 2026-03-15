/**
 * tests/unit/components/player/EpisodeOverlay.test.tsx
 * PLAYER-06: EpisodeOverlay 方向键导航、Enter/Esc
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { EpisodeOverlay } from '@/components/player/EpisodeOverlay'
import { usePlayerStore } from '@/stores/playerStore'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))

describe('EpisodeOverlay', () => {
  const onSelect = vi.fn()

  beforeEach(() => {
    usePlayerStore.setState({
      isEpisodePanelOpen: true,
    })
    onSelect.mockClear()
  })

  it('显示选集浮层', () => {
    render(<EpisodeOverlay episodeCount={12} currentEpisode={1} onSelect={onSelect} />)
    expect(screen.getByTestId('episode-overlay')).toBeTruthy()
  })

  it('浮层不显示时返回 null', () => {
    usePlayerStore.setState({ isEpisodePanelOpen: false })
    render(<EpisodeOverlay episodeCount={12} currentEpisode={1} onSelect={onSelect} />)
    expect(screen.queryByTestId('episode-overlay')).toBeNull()
  })

  it('渲染正确数量的集数按钮', () => {
    render(<EpisodeOverlay episodeCount={12} currentEpisode={1} onSelect={onSelect} />)
    const buttons = screen.getAllByTestId(/^overlay-episode-\d+$/)
    expect(buttons).toHaveLength(12)
  })

  it('当前集数按钮有金色高亮样式', () => {
    render(<EpisodeOverlay episodeCount={12} currentEpisode={3} onSelect={onSelect} />)
    const current = screen.getByTestId('overlay-episode-3')
    // 当前集数按钮有金色背景
    expect(current.style.background).toContain('gold')
  })

  it('点击集数按钮调用 onSelect', () => {
    render(<EpisodeOverlay episodeCount={12} currentEpisode={1} onSelect={onSelect} />)
    fireEvent.click(screen.getByTestId('overlay-episode-5'))
    expect(onSelect).toHaveBeenCalledWith(5)
  })

  it('点击背景遮罩关闭浮层', () => {
    const closePanel = vi.fn()
    usePlayerStore.setState({ closePanel } as never)
    render(<EpisodeOverlay episodeCount={12} currentEpisode={1} onSelect={onSelect} />)
    fireEvent.click(screen.getByTestId('episode-overlay-backdrop'))
    expect(closePanel).toHaveBeenCalledWith('episode')
  })

  it('Esc 键关闭浮层', () => {
    const closePanel = vi.fn()
    usePlayerStore.setState({ closePanel } as never)
    render(<EpisodeOverlay episodeCount={12} currentEpisode={1} onSelect={onSelect} />)
    // 触发捕获阶段键盘事件
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(closePanel).toHaveBeenCalledWith('episode')
  })

  it('Enter 键确认当前焦点集数', () => {
    render(<EpisodeOverlay episodeCount={12} currentEpisode={1} onSelect={onSelect} />)
    // 初始焦点在第 1 集（index 0），按 Enter 直接确认
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    expect(onSelect).toHaveBeenCalledWith(1)
  })
})
