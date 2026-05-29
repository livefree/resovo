'use client'

/**
 * AdminPlayer.tsx — 审核台极简播放器（FIX-D / CHG-SN-9-PLAYER-ERROR-CONSUMER-A）
 *
 * 极简范围：播放/暂停/进度/源切换/错误降级占位。
 * 不接入 GlobalPlayerHost；独立 admin-only 播放器。
 *
 * feedback 上报（D-17 + DEBT-FIX-D-ERROR 闭环 / Wave 4 #2）：
 *   - 首次播放成功（onPlay）→ POST /v1/feedback/playback {success:true}（fire-and-forget / per-sourceId 去抖）
 *   - 播放失败（onError）→ POST /v1/feedback/playback {success:false, errorCode: event.code}（per-sourceId 去抖防 fatal 循环刷流量）
 *
 * 颜色：仅消费 packages/design-tokens CSS 变量，零硬编码
 */
import React, { useRef } from 'react'
import { Player, type PlayerProps } from '@resovo/player-core'
import { apiClient } from '@/lib/api-client'

// PlayerErrorEvent 是 player-core 内部类型 / 顶层 index.ts 未 re-export（避免动 player-core 公共 API 触发 Opus 强制项）
// 通过 PlayerProps['onError'] 函数签名反推参数类型 / 与 onError public API 同源 / 升级 player-core 时自动跟随
type PlayerErrorPayload = Parameters<NonNullable<PlayerProps['onError']>>[0]

// ── Props ─────────────────────────────────────────────────────────────────────

export interface AdminPlayerProps {
  readonly videoId: string
  /** 选中线路第一活跃集 source_url；null = 无线路选中，展示占位 */
  readonly sourceUrl: string | null
  /** 选中线路第一活跃集 video_sources.id；用于 feedback 去抖键 */
  readonly sourceId: string | null
  readonly title?: string
  readonly testId?: string
}

// ── Placeholder ───────────────────────────────────────────────────────────────

const PLACEHOLDER_STYLE: React.CSSProperties = {
  background: 'var(--player-full-bg)',
  borderRadius: 6,
  aspectRatio: '16/9',
  position: 'relative',
  overflow: 'hidden',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}

const ICON_WRAP_STYLE: React.CSSProperties = {
  width: 48, height: 48, borderRadius: '50%',
  background: 'var(--player-full-progress-track)',
  border: '1px solid var(--player-full-buffer-fill)',
  display: 'grid', placeItems: 'center',
}

const HINT_STYLE: React.CSSProperties = {
  position: 'absolute', bottom: 8,
  fontSize: 'var(--font-size-2xs)', color: 'white',
  background: 'var(--player-mini-overlay)',
  padding: '2px 8px', borderRadius: 4, margin: 0,
}

// ── AdminPlayer ───────────────────────────────────────────────────────────────

export function AdminPlayer({
  videoId,
  sourceUrl,
  sourceId,
  title,
  testId,
}: AdminPlayerProps): React.ReactElement {
  // per-session, last-active-sourceId 去抖：A→B→A 切换会再次上报（反映"该 source 被再次验证"，非严格 Set 语义）
  const reportedRef = useRef<string | null>(null)
  // 失败上报独立 ref：与成功上报互斥 —— 防 fatal 反复触发刷流量 / 后端 redis fail count 干扰；
  // 同 sourceId 上报成功后再 onError 仍允许上报（成功→失败语义切换是有用信号 / reportedRef 不阻塞 errorReportedRef）
  const errorReportedRef = useRef<string | null>(null)

  const handlePlay = () => {
    if (!sourceId || reportedRef.current === sourceId) return
    reportedRef.current = sourceId
    void apiClient.post('/feedback/playback', {
      videoId,
      sourceId,
      success: true,
    }).catch(() => {
      // fire-and-forget；失败不阻断播放
    })
  }

  const handleError = (event: PlayerErrorPayload) => {
    if (!sourceId || errorReportedRef.current === sourceId) return
    errorReportedRef.current = sourceId
    void apiClient.post('/feedback/playback', {
      videoId,
      sourceId,
      success: false,
      errorCode: event.code,
    }).catch(() => {
      // fire-and-forget；上报失败不阻断 player-core 默认错误 overlay 渲染
    })
  }

  if (!sourceUrl) {
    return (
      <div
        data-admin-player
        data-state="idle"
        data-testid={testId}
        style={PLACEHOLDER_STYLE}
        role="region"
        aria-label="播放器 — 请从下方线路列表选择一条线路"
      >
        <div style={ICON_WRAP_STYLE}>
          <span style={{ color: 'white', fontSize: 'var(--font-size-lg)' }} aria-hidden="true">▶</span>
        </div>
        <p style={HINT_STYLE}>选择线路以播放</p>
      </div>
    )
  }

  return (
    <div
      data-admin-player
      data-state="ready"
      data-testid={testId}
      style={{ borderRadius: 6, overflow: 'hidden', aspectRatio: '16/9' }}
    >
      <Player
        src={sourceUrl}
        title={title}
        autoplay
        onPlay={handlePlay}
        onError={handleError}
      />
    </div>
  )
}
