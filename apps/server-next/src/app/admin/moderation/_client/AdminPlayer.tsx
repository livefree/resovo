'use client'

/**
 * AdminPlayer.tsx — 审核台极简播放器（FIX-D）
 *
 * 极简范围：播放/暂停/进度/源切换/错误降级占位。
 * 不接入 GlobalPlayerHost；独立 admin-only 播放器。
 *
 * feedback 上报（D-17）：
 *   首次播放成功（onPlay）→ POST /v1/feedback/playback {success:true}（fire-and-forget，每 sourceId 仅一次）
 *   错误上报：DEBT-FIX-D-ERROR（player-core 未暴露外部 onError 回调；FIX-CLOSE 时评估是否扩展 PlayerProps）
 *
 * 颜色：仅消费 packages/design-tokens CSS 变量，零硬编码
 */
import React, { useRef } from 'react'
import { Player } from '@resovo/player-core'
import { apiClient } from '@/lib/api-client'

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
  // 每个 sourceId 仅上报一次，src 变更时自动重置
  const reportedRef = useRef<string | null>(null)

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
      />
    </div>
  )
}
