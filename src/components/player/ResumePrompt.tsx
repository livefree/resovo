/**
 * ResumePrompt.tsx — 断点续播提示条
 * ADR-012: 检测到上次进度 > 30s 时显示，8s 后自动继续
 * CHG-20: 去除 video.js 依赖，改为回调驱动
 */

'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

interface ResumePromptProps {
  shortId: string
  episode: number
  /** 用户选择续播时调用，参数为跳转秒数 */
  onResume: (time: number) => void
  /** 用户选择从头播放时调用 */
  onRestart: () => void
  /** 外层容器扩展样式（由 PlayerShell 决定定位） */
  className?: string
}

function getProgressKey(shortId: string, episode: number): string {
  return `rv-progress-${shortId}-${episode === 0 ? 'movie' : episode}`
}

export function loadProgress(shortId: string, episode: number): number {
  try {
    const raw = localStorage.getItem(getProgressKey(shortId, episode))
    return raw ? Number(raw) : 0
  } catch {
    return 0
  }
}

export function saveProgress(shortId: string, episode: number, time: number) {
  try {
    localStorage.setItem(getProgressKey(shortId, episode), String(Math.floor(time)))
  } catch {
    // 静默失败
  }
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

export function ResumePrompt({ shortId, episode, onResume, onRestart, className }: ResumePromptProps) {
  const [savedTime, setSavedTime] = useState<number>(0)
  const [visible, setVisible] = useState(false)
  const [countdown, setCountdown] = useState(8)

  useEffect(() => {
    const time = loadProgress(shortId, episode)
    if (time > 30) {
      setSavedTime(time)
      setVisible(true)
      setCountdown(8)
    }
  }, [shortId, episode])

  useEffect(() => {
    if (!visible) return
    if (countdown <= 0) {
      handleResume()
      return
    }
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, countdown])

  function handleResume() {
    setVisible(false)
    onResume(savedTime)
  }

  function handleFromStart() {
    setVisible(false)
    onRestart()
  }

  if (!visible) return null

  return (
    <div
      className={cn('flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm border shadow-xl backdrop-blur-sm', className)}
      style={{
        background: 'color-mix(in srgb, var(--card) 85%, var(--background) 15%)',
        color: 'var(--foreground)',
        borderColor: 'color-mix(in srgb, var(--border) 80%, var(--foreground) 20%)',
      }}
      data-testid="resume-prompt"
    >
      <span>
        上次播放到 <strong style={{ color: 'var(--accent)' }}>{formatTime(savedTime)}</strong>
      </span>

      <button
        type="button"
        onClick={handleResume}
        className="px-3 py-1 rounded text-xs font-semibold"
        style={{ background: 'var(--accent)', color: 'var(--accent-foreground)' }}
        data-testid="resume-continue-btn"
      >
        继续（{countdown}s）
      </button>

      <button
        type="button"
        onClick={handleFromStart}
        className="px-3 py-1 rounded text-xs transition-colors hover:bg-[var(--secondary)]"
        style={{ color: 'var(--muted-foreground)' }}
        data-testid="resume-restart-btn"
      >
        从头播放
      </button>
    </div>
  )
}
