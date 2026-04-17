/**
 * DanmakuBar.tsx — 弹幕条（播放器下方独立一行）
 * PLAYER-07: Bilibili 风格弹幕控制栏
 * CHG-22: 接入 comment-core-library 渲染真实弹幕数据
 *   - useDanmaku 获取数据（sessionStorage 30min 缓存）
 *   - CommentManager.load → 渲染飞弹幕
 *   - ResizeObserver → 追踪播放器尺寸
 *   - sendDanmaku → 本地预览 + POST 持久化
 */

'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { usePlayerStore } from '@/stores/playerStore'
import { useDanmaku } from '@/hooks/useDanmaku'
import { apiClient } from '@/lib/api-client'

// ── CCL 类型声明 ──────────────────────────────────────────────────

export interface CCLComment {
  mode: number    // 1=飞行, 4=底部, 5=顶部
  text: string
  stime: number   // ms
  dur: number     // ms
  color: number   // RGB int (r<<16|g<<8|b)
  size: number    // px
}

export interface CCLManager {
  init: (renderer?: string) => void
  start: () => void
  stop: () => void
  clear: () => void
  time: (ms: number) => void
  load: (comments: CCLComment[]) => void
  send: (comment: CCLComment) => void
  setBounds: () => void
}

// CCL 是全局变量库（<script> 风格），require 后挂在 window 上
declare global {
  interface Window {
    CommentManager?: new (el: HTMLElement) => CCLManager
  }
}

// ── 常量 ──────────────────────────────────────────────────────────

const PRESET_COLORS = [
  { hex: '#ffffff', label: '白色' },
  { hex: '#ff6b6b', label: '红色' },
  { hex: '#ffd93d', label: '黄色' },
  { hex: '#6bcb77', label: '绿色' },
  { hex: '#4d96ff', label: '蓝色' },
  { hex: '#c77dff', label: '紫色' },
] as const

export function hexToInt(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return (r << 16) | (g << 8) | b
}

// ── Props ─────────────────────────────────────────────────────────

interface DanmakuBarProps {
  /** 播放器容器 ref，CCL 覆盖层附加于此 */
  stageRef?: React.RefObject<HTMLElement | null>
  /** 当前播放时间（秒），用于弹幕时间轴同步 */
  currentTime?: number
  /** 是否已登录（未登录时输入框和发送按钮 disabled） */
  isLoggedIn?: boolean
  className?: string
}

// ── CCL 辅助：API 弹幕 → CCLComment ─────────────────────────────

function toCCLComment(item: { time: number; type: 0 | 1 | 2; color: string; text: string }, size: number): CCLComment {
  const MODE_MAP: Record<0 | 1 | 2, number> = { 0: 1, 1: 5, 2: 4 }
  return {
    mode: MODE_MAP[item.type],
    text: item.text,
    stime: item.time * 1000,
    dur: 4000,
    color: hexToInt(item.color),
    size,
  }
}

// ── Component ─────────────────────────────────────────────────────

export function DanmakuBar({
  stageRef,
  currentTime = 0,
  isLoggedIn = false,
  className,
}: DanmakuBarProps) {
  const [enabled, setEnabled] = useState(true)
  const [opacity, setOpacity] = useState(0.8)
  const [fontSize, setFontSize] = useState(25)
  const [color, setColor] = useState('#ffffff')
  const [inputText, setInputText] = useState('')
  const [cclReady, setCclReady] = useState(false)

  const managerRef = useRef<CCLManager | null>(null)
  const overlayRef = useRef<HTMLDivElement | null>(null)

  // ── 从 playerStore 获取 shortId + 集数 ────────────────────────

  const shortId = usePlayerStore((s) => s.shortId)
  const currentEpisode = usePlayerStore((s) => s.currentEpisode)

  // ── 获取弹幕数据 ───────────────────────────────────────────────

  const { comments } = useDanmaku(shortId, currentEpisode)

  // ── CCL 初始化 ─────────────────────────────────────────────────

  useEffect(() => {
    const stage = stageRef?.current
    if (!stage || typeof window === 'undefined') return

    let manager: CCLManager | null = null
    let overlay: HTMLDivElement | null = null

    try {
      const CM = window.CommentManager
      if (!CM) return  // CCL 未加载，优雅降级

      overlay = document.createElement('div')
      overlay.style.cssText =
        'position:absolute;inset:0;overflow:hidden;pointer-events:none;z-index:15'
      overlay.style.opacity = String(opacity)
      stage.appendChild(overlay)
      overlayRef.current = overlay

      manager = new CM(overlay)
      manager.init('css')
      managerRef.current = manager
      if (enabled) manager.start()
      setCclReady(true)
    } catch {
      // CCL 加载失败，弹幕功能不可用（UI 仍可正常使用）
    }

    return () => {
      manager?.stop()
      manager?.clear()
      overlay?.remove()
      managerRef.current = null
      overlayRef.current = null
      setCclReady(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stageRef])

  // ── ResizeObserver：播放器尺寸变化时更新 CCL 轨道宽度 ─────────

  useEffect(() => {
    const stage = stageRef?.current
    if (!stage) return

    const observer = new ResizeObserver(() => {
      managerRef.current?.setBounds()
    })
    observer.observe(stage)

    return () => observer.disconnect()
  }, [stageRef])

  // ── 弹幕数据加载完成后渲染到 CCL ──────────────────────────────

  useEffect(() => {
    const cm = managerRef.current
    if (!cclReady || !cm) return
    cm.stop()
    cm.clear()
    if (comments.length > 0) {
      cm.load(comments.map((c) => toCCLComment(c, fontSize)))
      if (enabled) cm.start()
    } else if (enabled) {
      cm.start()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comments, cclReady])

  // ── 开关控制 ────────────────────────────────────────────────────

  useEffect(() => {
    const cm = managerRef.current
    if (!cm) return
    if (enabled) {
      cm.start()
    } else {
      cm.stop()
      cm.clear()
    }
  }, [enabled])

  // ── 透明度同步 ──────────────────────────────────────────────────

  useEffect(() => {
    if (overlayRef.current) {
      overlayRef.current.style.opacity = String(opacity)
    }
  }, [opacity])

  // ── 时间轴同步 ──────────────────────────────────────────────────

  useEffect(() => {
    managerRef.current?.time(currentTime * 1000)
  }, [currentTime])

  // ── 发送弹幕 ─────────────────────────────────────────────────────

  const sendDanmaku = useCallback(() => {
    const text = inputText.trim()
    if (!text) return

    const comment: CCLComment = {
      mode: 1,
      text,
      stime: currentTime * 1000,
      dur: 4000,
      color: hexToInt(color),
      size: fontSize,
    }
    managerRef.current?.send(comment)
    setInputText('')

    // 已登录时同步持久化到服务端（fire-and-forget）
    if (isLoggedIn && shortId) {
      void apiClient.postDanmaku(shortId, {
        ep: currentEpisode,
        time: Math.floor(currentTime),
        type: 0,
        color,
        text,
      })
    }
  }, [inputText, currentTime, color, fontSize, isLoggedIn, shortId, currentEpisode])

  // ── Render ────────────────────────────────────────────────────────

  return (
    <div
      className={cn('flex items-center gap-2 px-3 py-2 text-xs flex-wrap', className)}
      style={{ background: 'var(--bg2, var(--secondary))', borderTop: '1px solid var(--border)' }}
      data-testid="danmaku-bar"
    >
      {/* 弹幕开关 */}
      <button
        onClick={() => setEnabled((v) => !v)}
        className={cn(
          'shrink-0 px-2 py-1 rounded font-medium transition-colors',
          enabled
            ? 'text-black'
            : 'text-[var(--muted-foreground)]'
        )}
        style={
          enabled
            ? { background: 'var(--gold, var(--accent, #e8b84b))' }
            : { background: 'var(--secondary)' }
        }
        aria-pressed={enabled}
        data-testid="danmaku-toggle"
      >
        弹幕
      </button>

      {/* 透明度滑条 */}
      <label
        className="flex items-center gap-1 shrink-0"
        style={{ color: 'var(--muted-foreground)' }}
      >
        透明
        <input
          type="range"
          min={0.1}
          max={1}
          step={0.05}
          value={opacity}
          onChange={(e) => setOpacity(Number(e.target.value))}
          className="w-16"
          data-testid="danmaku-opacity-slider"
        />
      </label>

      {/* 字号滑条 */}
      <label
        className="flex items-center gap-1 shrink-0"
        style={{ color: 'var(--muted-foreground)' }}
      >
        字号
        <input
          type="range"
          min={16}
          max={40}
          step={1}
          value={fontSize}
          onChange={(e) => setFontSize(Number(e.target.value))}
          className="w-16"
          data-testid="danmaku-fontsize-slider"
        />
      </label>

      {/* 颜色选择 */}
      <div
        className="flex items-center gap-1 shrink-0"
        data-testid="danmaku-color-picker"
      >
        {PRESET_COLORS.map(({ hex, label }) => (
          <button
            key={hex}
            onClick={() => setColor(hex)}
            title={label}
            aria-label={label}
            aria-pressed={color === hex}
            className="w-4 h-4 rounded-full transition-transform hover:scale-110"
            style={{
              background: hex,
              outline: color === hex ? '2px solid var(--gold, #e8b84b)' : '2px solid transparent',
              outlineOffset: '1px',
            }}
            data-testid={`danmaku-color-${hex.slice(1)}`}
          />
        ))}
      </div>

      {/* 输入框 */}
      <input
        type="text"
        value={inputText}
        onChange={(e) => setInputText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            sendDanmaku()
          }
        }}
        placeholder={isLoggedIn ? '发个弹幕吧…' : '登录后发弹幕'}
        disabled={!isLoggedIn}
        className="flex-1 min-w-0 px-2 py-1 rounded text-xs outline-none disabled:opacity-50"
        style={{
          background: 'var(--bg3, var(--secondary))',
          color: 'var(--foreground)',
          border: '1px solid var(--border)',
        }}
        data-testid="danmaku-input"
      />

      {/* 发送按钮 */}
      <button
        onClick={sendDanmaku}
        disabled={!isLoggedIn || !inputText.trim()}
        className="shrink-0 px-3 py-1 rounded font-medium disabled:opacity-40 transition-opacity text-black"
        style={{ background: 'var(--gold, var(--accent, #e8b84b))' }}
        data-testid="danmaku-send-btn"
      >
        发送
      </button>
    </div>
  )
}
