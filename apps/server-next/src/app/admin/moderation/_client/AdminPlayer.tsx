'use client'

/**
 * AdminPlayer.tsx — 审核台极简播放器（FIX-D / CHG-SN-9-PLAYER-ERROR-CONSUMER-A + RETRY-CONTROL-EP / Y-166-6）
 *
 * 极简范围：播放/暂停/进度/源切换/错误降级占位 + 手动重试此线路。
 * 不接入 GlobalPlayerHost；独立 admin-only 播放器。
 *
 * 真实播放反馈直更 source health（ADR-198：admin 可信单点，绕众包多 IP 门槛 / 替原前台公开 /feedback/playback）：
 *   - 首次播放成功（onPlay）→ POST /admin/videos/:videoId/sources/:sourceId/playback-verify {success:true}
 *     （fire-and-forget / per-sourceId 去抖）→ 成功后 onVerified?.() 刷新左队列聚合 pill（D-198-9）
 *   - 播放失败（onError）→ POST .../playback-verify {success:false, errorCode: event.code}
 *     （per-sourceId 去抖防 fatal 循环刷流量）→ 服务端记 admin_playback 定向 recheck 信号，不直接置 dead（D-198-2）
 *   - videoId/sourceId 入**路径**（端点路径参数），body 仅 {success[, errorCode]}
 *
 * 手动重试此线路（ADR-166 §6.4 / Y-166-6 / Wave 4 #4-EP）：
 *   - "重试此线路"按钮 → sourceLoadVersion++ → Player key bump 触发 remount 重载 source
 *   - **不**用 controls.retry：controls 生命周期仅 onError 同 tick / 用户事件路径调 controls.retry 会被 active 守卫拦截
 *   - errorReportedRef 在用户点击重试时清空（同 sourceId 重新允许失败上报 / "用户主动验证后失败" 是新信号）
 *
 * 颜色：仅消费 packages/design-tokens CSS 变量，零硬编码
 */
import React, { useCallback, useRef, useState } from 'react'
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
  /** ADR-198 D-198-9：真实播放**成功**直更 source health 后回调，驱动消费方刷新（如左队列聚合 pill）。
   *  失败为异步 worker 定向 recheck（UI 同步无变化）故不触发。 */
  readonly onVerified?: () => void
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
  // WAVE4-VALIDATION-FIX-3 P3：'white' → CSS token / 同 player-core PlayerOverlays / 既有 var(--player-full-controls-fg) 是 player overlay fg 语义 token
  fontSize: 'var(--font-size-2xs)', color: 'var(--player-full-controls-fg)',
  background: 'var(--player-mini-overlay)',
  padding: '2px 8px', borderRadius: 4, margin: 0,
}

// ── AdminPlayer ───────────────────────────────────────────────────────────────

// ── Retry button style ────────────────────────────────────────────────────────

const RETRY_BTN_STYLE: React.CSSProperties = {
  position: 'absolute',
  top: 8,
  right: 8,
  zIndex: 10,
  padding: '4px 10px',
  background: 'var(--bg-surface-elevated)',
  color: 'var(--fg-default)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-sm)',
  cursor: 'pointer',
  fontSize: 'var(--font-size-xs)',
  opacity: 0.85,
}

export function AdminPlayer({
  videoId,
  sourceUrl,
  sourceId,
  title,
  testId,
  onVerified,
}: AdminPlayerProps): React.ReactElement {
  // per-session, last-active-sourceId 去抖：A→B→A 切换会再次上报（反映"该 source 被再次验证"，非严格 Set 语义）
  const reportedRef = useRef<string | null>(null)
  // 失败上报独立 ref：与成功上报互斥 —— 防 fatal 反复触发刷流量 / 后端 redis fail count 干扰；
  // 同 sourceId 上报成功后再 onError 仍允许上报（成功→失败语义切换是有用信号 / reportedRef 不阻塞 errorReportedRef）
  const errorReportedRef = useRef<string | null>(null)

  // ADR-166 Y-166-6 / Wave 4 #4-EP：手动重试此线路 / Player key 含 version 触发 remount
  const [sourceLoadVersion, setSourceLoadVersion] = useState(0)

  const handleRetry = useCallback(() => {
    // 清 errorReportedRef 让"用户主动验证后失败"被视为新信号 / 允许 onError 再次上报
    errorReportedRef.current = null
    setSourceLoadVersion(v => v + 1)
  }, [])

  const handlePlay = () => {
    if (!sourceId || reportedRef.current === sourceId) return
    reportedRef.current = sourceId
    // ADR-198：admin 真实播放成功直更 source health（绕众包门槛）→ 成功后刷新左队列聚合 pill
    void apiClient.post(`/admin/videos/${videoId}/sources/${sourceId}/playback-verify`, {
      success: true,
    }).then(() => {
      onVerified?.()
    }).catch(() => {
      // fire-and-forget；失败不阻断播放（onVerified 不触发，避免误刷）
    })
  }

  const handleError = (event: PlayerErrorPayload) => {
    if (!sourceId || errorReportedRef.current === sourceId) return
    errorReportedRef.current = sourceId
    // ADR-198：失败不直接置 dead（D-198-2），服务端记 admin_playback 定向 recheck 信号（异步收敛，不触发 onVerified）
    void apiClient.post(`/admin/videos/${videoId}/sources/${sourceId}/playback-verify`, {
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
          {/* WAVE4-VALIDATION-FIX-3 P3：'white' → player overlay fg 语义 token */}
          <span style={{ color: 'var(--player-full-controls-fg)', fontSize: 'var(--font-size-lg)' }} aria-hidden="true">▶</span>
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
      style={{ position: 'relative', borderRadius: 6, overflow: 'hidden', aspectRatio: '16/9' }}
    >
      <button
        type="button"
        onClick={handleRetry}
        style={RETRY_BTN_STYLE}
        aria-label="重试此线路"
        data-testid="admin-player-retry-btn"
      >
        ↻ 重试此线路
      </button>
      <Player
        // Y-166-6：key 含 sourceLoadVersion / 点击重试 → version++ → key 变化 → Player remount 重载 source
        // sourceId 变化（用户切线）自然 remount / 与重试解耦但 key 双因子
        key={`${sourceId ?? 'none'}-${sourceLoadVersion}`}
        src={sourceUrl}
        title={title}
        autoplay
        onPlay={handlePlay}
        onError={handleError}
      />
    </div>
  )
}
