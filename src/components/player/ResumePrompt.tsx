/**
 * ResumePrompt.tsx — 断点续播提示条
 * ADR-012: 检测到上次进度 > 30s 时显示，8s 后自动继续
 * CHG-20: 去除 video.js 依赖，改为回调驱动
 */

'use client'

import { useEffect, useState } from 'react'

interface ResumePromptProps {
  shortId: string
  episode: number
  /** 用户选择续播时调用，参数为跳转秒数 */
  onResume: (time: number) => void
  /** 用户选择从头播放时调用 */
  onRestart: () => void
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

export function ResumePrompt({ shortId, episode, onResume, onRestart }: ResumePromptProps) {
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
      className="absolute bottom-16 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm"
      style={{ background: 'rgba(0,0,0,0.85)', color: 'white' }}
      data-testid="resume-prompt"
    >
      <span>
        上次播放到 <strong style={{ color: 'var(--gold)' }}>{formatTime(savedTime)}</strong>
      </span>

      <button
        onClick={handleResume}
        className="px-3 py-1 rounded text-xs font-semibold"
        style={{ background: 'var(--gold)', color: 'black' }}
        data-testid="resume-continue-btn"
      >
        继续（{countdown}s）
      </button>

      <button
        onClick={handleFromStart}
        className="px-3 py-1 rounded text-xs text-white/70 hover:text-white transition-colors"
        data-testid="resume-restart-btn"
      >
        从头播放
      </button>
    </div>
  )
}
