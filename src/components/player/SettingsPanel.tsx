/**
 * SettingsPanel.tsx — 播放器设置面板
 * 字幕样式 + 自动播放下一集 + 断点续播
 * 设置持久化到 localStorage（key: resovo-player-settings）
 */

'use client'

import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'

// ── 设置类型 ──────────────────────────────────────────────────────

export interface PlayerSettings {
  subtitleColor: string
  subtitleBg: string
  subtitleBgOpacity: number
  autoPlayNext: boolean
  resumePlayback: boolean
}

const DEFAULT_SETTINGS: PlayerSettings = {
  subtitleColor: '#ffffff',
  subtitleBg: '#000000',
  subtitleBgOpacity: 0.7,
  autoPlayNext: true,
  resumePlayback: true,
}

const STORAGE_KEY = 'resovo-player-settings'

export function loadPlayerSettings(): PlayerSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_SETTINGS
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } as PlayerSettings
  } catch {
    return DEFAULT_SETTINGS
  }
}

function savePlayerSettings(settings: PlayerSettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch {
    // localStorage 不可用时静默失败
  }
}

// ── 组件 ──────────────────────────────────────────────────────────

interface SettingsPanelProps {
  className?: string
}

export function SettingsPanel({ className }: SettingsPanelProps) {
  const [settings, setSettings] = useState<PlayerSettings>(DEFAULT_SETTINGS)

  // 从 localStorage 加载
  useEffect(() => {
    setSettings(loadPlayerSettings())
  }, [])

  function updateSetting<K extends keyof PlayerSettings>(key: K, value: PlayerSettings[K]) {
    const next = { ...settings, [key]: value }
    setSettings(next)
    savePlayerSettings(next)
  }

  return (
    <div
      className={cn('rounded-lg overflow-hidden w-64', className)}
      style={{ background: 'rgba(0,0,0,0.85)' }}
      data-testid="settings-panel"
    >
      <div className="px-4 py-2 text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.5)' }}>
        播放器设置
      </div>

      {/* 自动播放下一集 */}
      <label
        className="flex items-center justify-between px-4 py-2.5 cursor-pointer hover:bg-white/5"
        data-testid="setting-auto-play-next"
      >
        <span className="text-sm text-white">自动播放下一集</span>
        <input
          type="checkbox"
          checked={settings.autoPlayNext}
          onChange={(e) => updateSetting('autoPlayNext', e.target.checked)}
          className="w-4 h-4 cursor-pointer"
          style={{ accentColor: 'var(--gold)' }}
          data-testid="auto-play-next-checkbox"
        />
      </label>

      {/* 断点续播 */}
      <label
        className="flex items-center justify-between px-4 py-2.5 cursor-pointer hover:bg-white/5"
        data-testid="setting-resume-playback"
      >
        <span className="text-sm text-white">断点续播</span>
        <input
          type="checkbox"
          checked={settings.resumePlayback}
          onChange={(e) => updateSetting('resumePlayback', e.target.checked)}
          className="w-4 h-4 cursor-pointer"
          style={{ accentColor: 'var(--gold)' }}
          data-testid="resume-playback-checkbox"
        />
      </label>

      {/* 字幕颜色 */}
      <div className="px-4 py-2 flex items-center justify-between">
        <span className="text-sm text-white">字幕颜色</span>
        <input
          type="color"
          value={settings.subtitleColor}
          onChange={(e) => updateSetting('subtitleColor', e.target.value)}
          className="w-8 h-6 cursor-pointer rounded border-0"
          data-testid="subtitle-color-picker"
          aria-label="Subtitle color"
        />
      </div>

      {/* 字幕背景色 */}
      <div className="px-4 py-2 flex items-center justify-between">
        <span className="text-sm text-white">字幕背景</span>
        <input
          type="color"
          value={settings.subtitleBg}
          onChange={(e) => updateSetting('subtitleBg', e.target.value)}
          className="w-8 h-6 cursor-pointer rounded border-0"
          data-testid="subtitle-bg-picker"
          aria-label="Subtitle background color"
        />
      </div>

      {/* 背景透明度 */}
      <div className="px-4 pb-3 space-y-1">
        <div className="flex justify-between text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
          <span>字幕背景透明度</span>
          <span>{Math.round(settings.subtitleBgOpacity * 100)}%</span>
        </div>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={settings.subtitleBgOpacity}
          onChange={(e) => updateSetting('subtitleBgOpacity', Number(e.target.value))}
          className="w-full h-1 cursor-pointer appearance-none rounded"
          style={{ accentColor: 'var(--gold)' }}
          data-testid="subtitle-opacity-slider"
          aria-label="Subtitle background opacity"
        />
      </div>
    </div>
  )
}
