'use client'

/**
 * crawler-site-columns-v2.tsx — REDO-01-C 站点表 9 列骨架定义
 *
 * 真源：M-SN-7-redo-01-contract.md §1.4
 *
 * 本卡（REDO-01-C）范围：9 列结构 + 占位 cell 渲染（chevron / status dot / type pill / actions placeholder）。
 * 不含：
 *   - 真实行级 {more} dropdown 菜单（REDO-01-D）
 *   - 行级 + 增量 / 全量 按钮 onClick 联动（REDO-01-D）
 *   - 展开 chevron 与 expandedKeys 状态联动（REDO-01-E）
 *
 * 设计原则：cell 内统一使用 CSS 变量；操作列 placeholder data-attr 标记便于 REDO-01-D 锚点定位。
 */

import { type CSSProperties } from 'react'
import { type TableColumn } from '@resovo/admin-ui'
import type { CrawlerSite, CrawlerSiteStat } from '@/lib/crawler/api'

export interface CrawlerSiteColumnsCallbacks {
  /** 行级"+ 增量"按钮 onClick（REDO-01-C 接入占位；REDO-01-D 实装） */
  readonly onRunIncremental?: (siteKey: string) => void
  /** 行级"+ 全量"按钮 onClick（REDO-01-C 接入占位；REDO-01-D 实装） */
  readonly onRunFull?: (siteKey: string) => void
  /** {more} dropdown 触发（REDO-01-D 实装；本卡仅渲染 disabled placeholder） */
  readonly onOpenMore?: (site: CrawlerSite) => void
  /** 行展开状态读（REDO-01-E 实装；本卡 chevron 静态不旋转） */
  readonly expandedKeys?: ReadonlySet<string>
  /** 站点 stats 映射（routeCount + health；来自 GET /admin/crawler/kpi siteStats） */
  readonly siteStats?: ReadonlyMap<string, CrawlerSiteStat>
}

const CHEVRON_STYLE: CSSProperties = {
  display: 'inline-block',
  width: 12,
  height: 12,
  color: 'var(--fg-muted)',
  transition: 'transform 120ms ease',
}

const DOT_STYLE_BASE: CSSProperties = {
  display: 'inline-block',
  width: 8,
  height: 8,
  borderRadius: '50%',
  background: 'var(--fg-muted)',
}

const SITE_NAME_STYLE: CSSProperties = {
  display: 'inline-flex',
  flexDirection: 'column',
  gap: '2px',
}

const SITE_META_STYLE: CSSProperties = {
  fontSize: '10px',
  color: 'var(--fg-muted)',
  fontFamily: 'var(--font-mono, ui-monospace, monospace)',
}

const PILL_TYPE_STYLE: CSSProperties = {
  display: 'inline-block',
  padding: '2px 8px',
  borderRadius: 'var(--radius-pill, 12px)',
  fontSize: 'var(--font-size-xs)',
  background: 'var(--bg-subtle, var(--bg-surface))',
  color: 'var(--fg-default)',
}

const PROGRESS_TRACK_STYLE: CSSProperties = {
  display: 'inline-block',
  width: 40,
  height: 6,
  background: 'var(--bg-subtle, var(--bg-surface))',
  borderRadius: '3px',
  overflow: 'hidden',
  verticalAlign: 'middle',
  marginRight: '6px',
}

const ACTIONS_PLACEHOLDER_STYLE: CSSProperties = {
  display: 'inline-flex',
  gap: '4px',
  fontSize: 'var(--font-size-xs)',
  color: 'var(--fg-muted)',
}

function deriveHealthFromSite(site: CrawlerSite, stat: CrawlerSiteStat | undefined): number {
  if (stat) return stat.health
  if (site.disabled) return 0
  if (site.lastCrawlStatus === 'ok') return 90
  if (site.lastCrawlStatus === 'failed') return 30
  if (site.lastCrawlStatus === 'running') return 70
  return 60
}

function dotStyle(health: number, disabled: boolean): CSSProperties {
  if (disabled) {
    return { ...DOT_STYLE_BASE, background: 'var(--fg-muted)' }
  }
  if (health >= 80) return { ...DOT_STYLE_BASE, background: 'var(--state-success-fg)' }
  if (health >= 40) return { ...DOT_STYLE_BASE, background: 'var(--state-warning-fg)' }
  return { ...DOT_STYLE_BASE, background: 'var(--state-danger-fg, var(--fg-danger))' }
}

function progressBarStyle(health: number): CSSProperties {
  const pct = Math.max(0, Math.min(100, health))
  const color =
    pct >= 80
      ? 'var(--state-success-fg)'
      : pct >= 40
        ? 'var(--state-warning-fg)'
        : 'var(--state-danger-fg, var(--fg-danger))'
  return {
    display: 'block',
    width: `${pct}%`,
    height: '100%',
    background: color,
  }
}

function formatRelativeTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  const diffMs = Date.now() - date.getTime()
  const diffMin = Math.round(diffMs / 60_000)
  if (diffMin < 1) return '刚刚'
  if (diffMin < 60) return `${diffMin} 分钟前`
  const diffHour = Math.round(diffMin / 60)
  if (diffHour < 24) return `${diffHour} 小时前`
  const diffDay = Math.round(diffHour / 24)
  return `${diffDay} 天前`
}

export function buildCrawlerSiteColumnsV2(
  callbacks: CrawlerSiteColumnsCallbacks = {},
): readonly TableColumn<CrawlerSite>[] {
  const { expandedKeys, siteStats } = callbacks

  return [
    {
      id: 'chevron',
      header: '',
      accessor: () => null,
      width: 32,
      defaultVisible: true,
      pinned: true,
      cell: ({ row }) => {
        const expanded = expandedKeys?.has(row.key) ?? false
        return (
          <span
            style={{
              ...CHEVRON_STYLE,
              transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
            }}
            data-chevron
            aria-hidden
          >
            ›
          </span>
        )
      },
    },
    {
      id: 'status',
      header: '',
      accessor: (r) => (r.disabled ? 'disabled' : 'enabled'),
      width: 32,
      defaultVisible: true,
      cell: ({ row }) => {
        const stat = siteStats?.get(row.key)
        const health = deriveHealthFromSite(row, stat)
        return (
          <span
            style={dotStyle(health, row.disabled)}
            data-site-status-dot
            data-disabled={row.disabled ? '' : undefined}
            aria-label={`健康度 ${health}`}
          />
        )
      },
    },
    {
      id: 'site',
      header: '站点',
      accessor: (r) => r.name,
      minWidth: 200,
      defaultVisible: true,
      cell: ({ row }) => (
        <span style={SITE_NAME_STYLE} data-site-cell>
          <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>{row.name}</span>
          <span style={SITE_META_STYLE}>
            {row.key} · {row.format}
          </span>
        </span>
      ),
    },
    {
      id: 'type',
      header: '类型',
      accessor: (r) => r.sourceType,
      width: 90,
      defaultVisible: true,
      cell: ({ row }) => <span style={PILL_TYPE_STYLE}>{row.sourceType}</span>,
    },
    {
      id: 'routes',
      header: '线路',
      accessor: (r) => siteStats?.get(r.key)?.routeCount ?? 0,
      width: 80,
      defaultVisible: true,
      cell: ({ row }) => {
        const stat = siteStats?.get(row.key)
        if (!stat || stat.routeCount === 0) return <span style={{ color: 'var(--fg-muted)' }}>—</span>
        return <span data-route-count>{stat.routeCount} 条</span>
      },
    },
    {
      id: 'health',
      header: '健康度',
      accessor: (r) => deriveHealthFromSite(r, siteStats?.get(r.key)),
      width: 110,
      defaultVisible: true,
      cell: ({ row }) => {
        const stat = siteStats?.get(row.key)
        const health = deriveHealthFromSite(row, stat)
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center' }} data-health>
            <span style={PROGRESS_TRACK_STYLE}>
              <span style={progressBarStyle(health)} />
            </span>
            <span style={{ fontSize: 'var(--font-size-xs)' }}>{health}</span>
          </span>
        )
      },
    },
    {
      id: 'weight',
      header: '权重',
      accessor: (r) => r.weight,
      width: 80,
      defaultVisible: true,
      cell: ({ row }) => (
        <span style={{ fontSize: 'var(--font-size-xs)' }} data-weight>
          {row.weight}
        </span>
      ),
    },
    {
      id: 'lastCrawl',
      header: '最近采集',
      accessor: (r) => r.lastCrawledAt ?? '',
      width: 110,
      defaultVisible: true,
      cell: ({ row }) => (
        <span style={{ fontSize: '11px', color: 'var(--fg-muted)' }} data-last-crawl>
          {formatRelativeTime(row.lastCrawledAt)}
        </span>
      ),
    },
    {
      id: 'actions',
      header: '操作',
      accessor: () => null,
      width: 160,
      defaultVisible: true,
      cell: () => (
        <span style={ACTIONS_PLACEHOLDER_STYLE} data-actions-placeholder>
          （REDO-01-D 实装）
        </span>
      ),
    },
  ]
}
