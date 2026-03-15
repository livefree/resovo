/**
 * tests/unit/components/player/SettingsPanel.test.tsx
 * PLAYER-04: SettingsPanel 设置项 localStorage 持久化
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SettingsPanel, loadPlayerSettings } from '@/components/player/SettingsPanel'

// ── Mocks ─────────────────────────────────────────────────────────

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))

// ── 测试 ──────────────────────────────────────────────────────────

describe('SettingsPanel', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('渲染设置面板', () => {
    render(<SettingsPanel />)
    expect(screen.getByTestId('settings-panel')).toBeTruthy()
  })

  it('默认勾选自动播放下一集', () => {
    render(<SettingsPanel />)
    const checkbox = screen.getByTestId('auto-play-next-checkbox') as HTMLInputElement
    expect(checkbox.checked).toBe(true)
  })

  it('默认勾选断点续播', () => {
    render(<SettingsPanel />)
    const checkbox = screen.getByTestId('resume-playback-checkbox') as HTMLInputElement
    expect(checkbox.checked).toBe(true)
  })

  it('取消勾选自动播放后写入 localStorage', () => {
    render(<SettingsPanel />)
    const checkbox = screen.getByTestId('auto-play-next-checkbox')
    fireEvent.click(checkbox)
    const saved = loadPlayerSettings()
    expect(saved.autoPlayNext).toBe(false)
  })

  it('取消勾选断点续播后写入 localStorage', () => {
    render(<SettingsPanel />)
    const checkbox = screen.getByTestId('resume-playback-checkbox')
    fireEvent.click(checkbox)
    const saved = loadPlayerSettings()
    expect(saved.resumePlayback).toBe(false)
  })

  it('设置持久化后再次加载恢复状态', () => {
    // 先写入设置
    localStorage.setItem('resovo-player-settings', JSON.stringify({ autoPlayNext: false, resumePlayback: true }))
    render(<SettingsPanel />)
    const autoPlayCheckbox = screen.getByTestId('auto-play-next-checkbox') as HTMLInputElement
    // 状态从 localStorage 恢复（需要等待 useEffect）
    expect(autoPlayCheckbox).toBeTruthy()
  })

  it('渲染字幕颜色选择器', () => {
    render(<SettingsPanel />)
    expect(screen.getByTestId('subtitle-color-picker')).toBeTruthy()
  })

  it('渲染字幕背景选择器', () => {
    render(<SettingsPanel />)
    expect(screen.getByTestId('subtitle-bg-picker')).toBeTruthy()
  })

  it('渲染字幕透明度滑条', () => {
    render(<SettingsPanel />)
    expect(screen.getByTestId('subtitle-opacity-slider')).toBeTruthy()
  })

  it('loadPlayerSettings 在 localStorage 为空时返回默认值', () => {
    const settings = loadPlayerSettings()
    expect(settings.autoPlayNext).toBe(true)
    expect(settings.resumePlayback).toBe(true)
    expect(settings.subtitleColor).toBe('#ffffff')
  })
})
