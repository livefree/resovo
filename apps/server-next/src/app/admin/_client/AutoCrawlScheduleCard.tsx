'use client'

/**
 * AutoCrawlScheduleCard.tsx — Dashboard 自动采集状态卡（CW1-D）
 *
 * 真源：~/.claude/plans/cheerful-orbiting-hare.md §W1 拆卡 4
 *
 * 3 状态渲染：
 *   - 未启用（globalEnabled=false）→ Pill neutral "未启用"
 *   - 倒计时（globalEnabled=true & autoCrawlNext != null）→ Pill ok "下次自动: MM-DD HH:mm"
 *   - 失败（globalEnabled=true & autoCrawlNext === null）→ Pill warn "调度配置异常"
 *
 * 编辑链接：跳 `/admin/crawler?openDrawer=scheduler` 自动打开 SchedulerConfigDrawer。
 *
 * 数据源：
 *   - getAutoCrawlConfig() → globalEnabled / dailyTime / defaultMode
 *   - getCrawlerSystemStatus() → autoCrawlNext (ISO timestamp)
 */

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import Link from 'next/link'
import { Pill } from '@resovo/admin-ui'
import {
  getAutoCrawlConfig,
  getCrawlerSystemStatus,
  type AutoCrawlConfig,
} from '@/lib/crawler/api'

// ── 样式 ──────────────────────────────────────────────────────────

const CARD_STYLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
  padding: '14px 16px',
  background: 'var(--bg-surface)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-md)',
}

const HEAD_STYLE: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: '8px',
}

const TITLE_STYLE: CSSProperties = {
  fontSize: 'var(--font-size-sm-loose)',
  fontWeight: 600,
  color: 'var(--fg-default)',
  margin: 0,
}

const META_ROW_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  flexWrap: 'wrap',
  fontSize: 'var(--font-size-xs)',
  color: 'var(--fg-muted)',
}

const META_INLINE_STYLE: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '4px',
}

const LINK_STYLE: CSSProperties = {
  fontSize: 'var(--font-size-xs)',
  color: 'var(--accent-default)',
  textDecoration: 'none',
  fontWeight: 500,
}

const LOADING_STYLE: CSSProperties = {
  fontSize: 'var(--font-size-xs)',
  color: 'var(--fg-muted)',
}

// ── helpers ──────────────────────────────────────────────────────

function formatNextAt(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  return `${mm}-${dd} ${hh}:${mi}`
}

function formatCountdown(iso: string, now: number): string {
  const target = new Date(iso).getTime()
  if (Number.isNaN(target)) return ''
  const diffMs = target - now
  if (diffMs <= 0) return '即将触发'
  const diffMin = Math.floor(diffMs / 60_000)
  const hours = Math.floor(diffMin / 60)
  const mins = diffMin % 60
  if (hours > 0) return `剩余 ${hours} 小时 ${mins} 分钟`
  return `剩余 ${mins} 分钟`
}

// ── 视觉状态类型 ────────────────────────────────────────────────

type CardState = 'loading' | 'disabled' | 'countdown' | 'failed' | 'error'

interface CardData {
  readonly state: CardState
  readonly config: AutoCrawlConfig | null
  readonly nextAt: string | null
  readonly errorMessage?: string
}

// ── Component ─────────────────────────────────────────────────────

export interface AutoCrawlScheduleCardProps {
  readonly className?: string
}

export function AutoCrawlScheduleCard({ className }: AutoCrawlScheduleCardProps) {
  const [data, setData] = useState<CardData>({
    state: 'loading',
    config: null,
    nextAt: null,
  })

  const load = useCallback(() => {
    let cancelled = false
    setData((prev) => ({ ...prev, state: 'loading' }))
    const run = async () => {
      try {
        const [config, status] = await Promise.all([
          getAutoCrawlConfig(),
          getCrawlerSystemStatus().catch(() => null),
        ])
        if (cancelled) return
        const nextAt = status?.autoCrawlNext ?? null
        const state: CardState = !config.globalEnabled
          ? 'disabled'
          : nextAt
            ? 'countdown'
            : 'failed'
        setData({ state, config, nextAt })
      } catch (err: unknown) {
        if (cancelled) return
        setData({
          state: 'error',
          config: null,
          nextAt: null,
          errorMessage: err instanceof Error ? err.message : '加载失败',
        })
      }
    }
    void run()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    const cleanup = load()
    return cleanup
  }, [load])

  // 倒计时 1 分钟刷新一次（仅在 countdown 状态）
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (data.state !== 'countdown') return
    const tick = window.setInterval(() => setNow(Date.now()), 60_000)
    return () => window.clearInterval(tick)
  }, [data.state])

  const editHref = '/admin/crawler?openDrawer=scheduler'
  const editLabel = data.state === 'disabled' ? '配置定时' : '编辑设置'

  // ── render ──────────────────────────────────────────────────────
  const body = useMemo(() => {
    if (data.state === 'loading') {
      return <span style={LOADING_STYLE} data-testid="auto-crawl-loading">加载中…</span>
    }
    if (data.state === 'error') {
      return (
        <span style={LOADING_STYLE} data-testid="auto-crawl-error">
          加载失败：{data.errorMessage}
        </span>
      )
    }
    if (data.state === 'disabled') {
      return (
        <div style={META_ROW_STYLE} data-testid="auto-crawl-disabled">
          <Pill variant="neutral">未启用</Pill>
          <span>未配置每日自动采集；可在「编辑设置」中开启</span>
        </div>
      )
    }
    if (data.state === 'failed') {
      return (
        <div style={META_ROW_STYLE} data-testid="auto-crawl-failed">
          <Pill variant="warn">调度配置异常</Pill>
          <span>已启用但无下次触发时间；请检查配置 / 站点</span>
        </div>
      )
    }
    // countdown
    const nextAt = data.nextAt!
    const modeLabel = data.config?.defaultMode === 'full' ? '全量' : '增量'
    // CHG-SN-9-CW1-CW2-HOTFIX-B Step 2：按 scheduleType 切换显示（CW2-C-EP-A 引入两态后
    // 本卡漏改的回归 — 原写死 "每日 ${dailyTime}" 在 interval 模式下无意义）
    const scheduleSummary = data.config?.scheduleType === 'interval'
      ? `· 每 ${data.config.intervalMinutes} 分钟 · 模式 ${modeLabel}`
      : data.config
        ? `· 每日 ${data.config.dailyTime} · 模式 ${modeLabel}`
        : null
    return (
      <div style={META_ROW_STYLE} data-testid="auto-crawl-countdown">
        <Pill variant="ok">{`下次自动: ${formatNextAt(nextAt)}`}</Pill>
        <span style={META_INLINE_STYLE}>
          <span data-testid="auto-crawl-countdown-remaining">{formatCountdown(nextAt, now)}</span>
        </span>
        {scheduleSummary && (
          <span style={META_INLINE_STYLE} data-testid="auto-crawl-schedule-summary">
            {scheduleSummary}
          </span>
        )}
      </div>
    )
  }, [data, now])

  return (
    <div
      style={CARD_STYLE}
      className={className}
      data-testid="auto-crawl-schedule-card"
      data-card-state={data.state}
    >
      <div style={HEAD_STYLE}>
        <h3 style={TITLE_STYLE}>自动采集</h3>
        <Link
          href={editHref}
          style={LINK_STYLE}
          data-testid="auto-crawl-edit-link"
        >
          {editLabel} →
        </Link>
      </div>
      {body}
    </div>
  )
}
