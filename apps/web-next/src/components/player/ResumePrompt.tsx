'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

interface ResumePromptProps {
  shortId: string
  episode: number
  onResume: (time: number) => void
  onRestart: () => void
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
      className={cn(
        'flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm border shadow-xl backdrop-blur-sm',
        className
      )}
      style={{
        background: 'color-mix(in srgb, var(--bg-surface) 85%, var(--bg-canvas) 15%)',
        color: 'var(--fg-default)',
        borderColor: 'color-mix(in srgb, var(--border-default) 80%, var(--fg-default) 20%)',
      }}
      data-testid="resume-prompt"
    >
      <span>
        上次播放到{' '}
        <strong style={{ color: 'var(--accent-default)' }}>{formatTime(savedTime)}</strong>
      </span>

      <button
        type="button"
        onClick={handleResume}
        className="px-3 py-1 rounded text-xs font-semibold"
        style={{ background: 'var(--accent-default)', color: 'var(--accent-fg)' }}
        data-testid="resume-continue-btn"
      >
        继续（{countdown}s）
      </button>

      <button
        type="button"
        onClick={handleFromStart}
        className="px-3 py-1 rounded text-xs transition-colors hover:bg-[var(--bg-surface-sunken)]"
        style={{ color: 'var(--fg-muted)' }}
        data-testid="resume-restart-btn"
      >
        从头播放
      </button>
    </div>
  )
}
