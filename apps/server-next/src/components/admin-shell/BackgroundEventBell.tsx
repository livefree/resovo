'use client'
/**
 * BackgroundEventBell.tsx — admin Shell topbar 后台事件铃铛（ADR-152 / CW1-E-EP step 8a）
 *
 * 职责：
 *   - 渲染一个铃铛图标按钮（position: fixed，叠于 topbar 右侧区域）
 *   - 点击展开 Popover：上方"即将发生（upcoming）"/ 下方"近期完成/失败（finished + active）"
 *   - 消费 useAdminBackgroundEvents hook（60s polling + mutate invalidate）
 *   - degraded=true 时铃铛加 ⚠ 角标
 *
 * 集成方式（v1 / ADR-152 N1-152-A follow-up）：
 *   - 以 position: fixed 独立于 AdminShell TopbarIcons 5 槽之外，叠加在 topbar 区域
 *   - 不修改 packages/admin-ui TopbarIcons Props（Opus 评审约束）
 *   - N1-152-5 follow-up 中提取到 packages/admin-ui/src/shell/event-bell.tsx 共享
 *
 * 颜色：零硬编码，全部使用 CSS 变量
 * 分层约束：仅消费 lib hook + 不直接调 apiClient（通过 hook）
 */

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { useRouter } from 'next/navigation'
import type { AdminBackgroundEvent, AdminBackgroundEventUpcoming, AdminBackgroundEventActive, AdminBackgroundEventFinished } from '@resovo/types'

// ── 样式常量（CSS 变量 / 零硬编码） ──────────────────────────────────────────

const BELL_WRAPPER_STYLE: CSSProperties = {
  position: 'fixed',
  top: 0,
  // 叠于 topbar 右侧 icons 区域左侧（[theme][tasks][notifications][settings] 4 × ~40px = ~160px + padding 16px）
  right: 'calc(4 * (32px + var(--space-2, 8px)) + var(--space-4, 16px))',
  height: 'var(--topbar-h, 52px)',
  display: 'flex',
  alignItems: 'center',
  zIndex: 90,
}

const BELL_BTN_STYLE: CSSProperties = {
  position: 'relative',
  width: '32px',
  height: '32px',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'transparent',
  border: 0,
  borderRadius: 'var(--radius-sm)',
  cursor: 'pointer',
  color: 'var(--fg-muted)',
  fontFamily: 'inherit',
}

const DEGRADED_DOT_STYLE: CSSProperties = {
  position: 'absolute',
  top: '4px',
  right: '4px',
  width: '8px',
  height: '8px',
  borderRadius: '50%',
  background: 'var(--color-warn-default, orange)',
  fontSize: '6px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}

const UNREAD_DOT_STYLE: CSSProperties = {
  position: 'absolute',
  top: '4px',
  right: '4px',
  width: '8px',
  height: '8px',
  borderRadius: '50%',
  background: 'var(--color-info-default, cornflowerblue)',
}

const POPOVER_STYLE: CSSProperties = {
  position: 'fixed',
  top: 'var(--topbar-h, 52px)',
  right: 'calc(3 * (32px + var(--space-2, 8px)) + var(--space-4, 16px))',
  width: '360px',
  maxHeight: '480px',
  background: 'var(--bg-surface)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-md)',
  boxShadow: 'var(--shadow-md)',
  zIndex: 200,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
}

const POPOVER_HEADER_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: 'var(--space-3) var(--space-4)',
  borderBottom: '1px solid var(--border-subtle)',
  flexShrink: 0,
}

const POPOVER_TITLE_STYLE: CSSProperties = {
  fontSize: 'var(--font-size-sm)',
  fontWeight: 600,
  color: 'var(--fg-default)',
  margin: 0,
}

const SECTION_HEADER_STYLE: CSSProperties = {
  padding: 'var(--space-2) var(--space-4)',
  fontSize: 'var(--font-size-xs)',
  fontWeight: 600,
  color: 'var(--fg-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  background: 'var(--bg-surface-row)',
  borderBottom: '1px solid var(--border-subtle)',
}

const POPOVER_LIST_STYLE: CSSProperties = {
  flex: 1,
  overflowY: 'auto',
}

const EVENT_ROW_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: 'var(--space-3)',
  padding: 'var(--space-3) var(--space-4)',
  borderBottom: '1px solid var(--border-subtle)',
  cursor: 'default',
}

const EVENT_ROW_LINK_STYLE: CSSProperties = {
  ...EVENT_ROW_STYLE,
  cursor: 'pointer',
}

const EMPTY_STYLE: CSSProperties = {
  padding: 'var(--space-6) var(--space-4)',
  textAlign: 'center',
  fontSize: 'var(--font-size-sm)',
  color: 'var(--fg-muted)',
}

const CLOSE_BTN_STYLE: CSSProperties = {
  background: 'transparent',
  border: 0,
  cursor: 'pointer',
  color: 'var(--fg-muted)',
  fontSize: 'var(--font-size-sm)',
  padding: 'var(--space-1)',
  borderRadius: 'var(--radius-sm)',
  fontFamily: 'inherit',
}

// ── level 颜色映射 ─────────────────────────────────────────────────────────
const LEVEL_DOT: Record<string, CSSProperties> = {
  info: { width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0, marginTop: '5px', background: 'var(--color-info-default, cornflowerblue)' },
  warn: { width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0, marginTop: '5px', background: 'var(--color-warn-default, orange)' },
  danger: { width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0, marginTop: '5px', background: 'var(--color-danger-default, red)' },
}

// ── 工具函数 ──────────────────────────────────────────────────────────────

function formatRelativeTime(isoStr: string): string {
  const diffMs = Date.now() - new Date(isoStr).getTime()
  const absDiff = Math.abs(diffMs)
  if (absDiff < 60_000) return diffMs < 0 ? '即将' : '刚刚'
  const mins = Math.round(absDiff / 60_000)
  if (mins < 60) return diffMs < 0 ? `${mins} 分钟后` : `${mins} 分钟前`
  const hrs = Math.round(absDiff / 3_600_000)
  if (hrs < 24) return diffMs < 0 ? `${hrs} 小时后` : `${hrs} 小时前`
  const days = Math.round(absDiff / 86_400_000)
  return diffMs < 0 ? `${days} 天后` : `${days} 天前`
}

function getTimeField(event: AdminBackgroundEvent): string {
  if (event.lane === 'upcoming') return event.scheduledAt
  if (event.lane === 'active') return event.startedAt
  return event.finishedAt
}

// ── 子组件 ────────────────────────────────────────────────────────────────

interface EventRowProps {
  readonly event: AdminBackgroundEvent
  readonly onNavigate: (href: string) => void
}

function EventRow({ event, onNavigate }: EventRowProps) {
  const timeField = getTimeField(event)
  const dotStyle = LEVEL_DOT[event.level] ?? LEVEL_DOT.info
  const hasLink = event.href !== undefined

  return (
    <div
      style={hasLink ? EVENT_ROW_LINK_STYLE : EVENT_ROW_STYLE}
      role={hasLink ? 'button' : undefined}
      tabIndex={hasLink ? 0 : undefined}
      onClick={() => { if (event.href) onNavigate(event.href) }}
      onKeyDown={(e) => { if (e.key === 'Enter' && event.href) onNavigate(event.href) }}
    >
      <div style={dotStyle} aria-hidden />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--fg-default)', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {event.title}
        </div>
        {event.description && (
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--fg-muted)', marginTop: '2px' }}>
            {event.description}
          </div>
        )}
      </div>
      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--fg-muted)', flexShrink: 0, whiteSpace: 'nowrap' }}>
        {formatRelativeTime(timeField)}
      </div>
    </div>
  )
}

// ── 主组件 ────────────────────────────────────────────────────────────────

export interface BackgroundEventBellProps {
  readonly events: readonly AdminBackgroundEvent[]
  readonly degraded: boolean
}

export function BackgroundEventBell({ events, degraded }: BackgroundEventBellProps) {
  const [open, setOpen] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  // 点击外部关闭
  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      const target = e.target as Node
      if (popoverRef.current?.contains(target) || btnRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  // Esc 关闭
  useEffect(() => {
    if (!open) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open])

  const handleNavigate = useCallback((href: string) => {
    setOpen(false)
    router.push(href)
  }, [router])

  const upcomingEvents = events.filter((e): e is AdminBackgroundEventUpcoming => e.lane === 'upcoming')
  const activeEvents = events.filter((e): e is AdminBackgroundEventActive => e.lane === 'active')
  const finishedEvents = events.filter((e): e is AdminBackgroundEventFinished => e.lane === 'finished')
  const hasUnread = events.length > 0

  return (
    <>
      {/* 铃铛按钮（position: fixed 叠于 topbar 右侧区域） */}
      <div style={BELL_WRAPPER_STYLE} data-background-event-bell>
        <button
          ref={btnRef}
          type="button"
          aria-label="后台事件"
          aria-haspopup="true"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          style={BELL_BTN_STYLE}
        >
          {/* 铃铛 SVG icon */}
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
            <path d="M8 1a5 5 0 0 1 5 5v3l1.5 1.5H1.5L3 9V6a5 5 0 0 1 5-5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
            <path d="M6.5 13a1.5 1.5 0 0 0 3 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          {degraded && (
            <span style={DEGRADED_DOT_STYLE} aria-label="服务降级" title="后台事件服务降级，数据可能不完整">⚠</span>
          )}
          {!degraded && hasUnread && !open && (
            <span style={UNREAD_DOT_STYLE} aria-label="有后台事件" />
          )}
        </button>
      </div>

      {/* Popover */}
      {open && (
        <div
          ref={popoverRef}
          role="dialog"
          aria-label="后台事件"
          style={POPOVER_STYLE}
          data-background-event-popover
        >
          <div style={POPOVER_HEADER_STYLE}>
            <h2 style={POPOVER_TITLE_STYLE}>后台事件</h2>
            <button
              type="button"
              aria-label="关闭"
              onClick={() => setOpen(false)}
              style={CLOSE_BTN_STYLE}
            >
              ✕
            </button>
          </div>

          <div style={POPOVER_LIST_STYLE}>
            {/* 上方：即将发生（upcoming） */}
            {(upcomingEvents.length > 0 || activeEvents.length > 0) && (
              <>
                <div style={SECTION_HEADER_STYLE}>即将 / 进行中</div>
                {upcomingEvents.map((e) => (
                  <EventRow key={e.id} event={e} onNavigate={handleNavigate} />
                ))}
                {activeEvents.map((e) => (
                  <EventRow key={e.id} event={e} onNavigate={handleNavigate} />
                ))}
              </>
            )}

            {/* 下方：近期完成/失败 */}
            {finishedEvents.length > 0 && (
              <>
                <div style={SECTION_HEADER_STYLE}>近期完成 / 失败</div>
                {finishedEvents.map((e) => (
                  <EventRow key={e.id} event={e} onNavigate={handleNavigate} />
                ))}
              </>
            )}

            {/* 空状态 */}
            {events.length === 0 && (
              <div style={EMPTY_STYLE}>
                暂无后台事件
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
