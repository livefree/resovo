'use client'

/**
 * crawler-site-columns-v2.tsx — 站点表 9 列定义（REDO-01-C 骨架 + REDO-01-D 行级操作实装）
 *
 * 真源：M-SN-7-redo-01-contract.md §1.4
 *
 * REDO-01-D 范围（本卡更新）：
 *   - actions 列 cell：`+ 增量` AdminButton + `+ 全量` AdminButton + <CrawlerSiteRowActions /> {more} dropdown
 *   - 6 项 {more} 菜单回调串接（contract §1.4 menu 表）
 *
 * 不含：
 *   - 展开 chevron 与 expandedKeys 状态联动 onClick toggle（REDO-01-E）
 */

import { type CSSProperties } from 'react'
import { AdminButton, type TableColumn } from '@resovo/admin-ui'
import type { CrawlerSite, CrawlerSiteStat } from '@/lib/crawler/api'
import { CrawlerSiteRowActions } from './CrawlerSiteRowActions'

export interface CrawlerSiteColumnsCallbacks {
  /** 行级"+ 增量"按钮 onClick */
  readonly onRunIncremental?: (siteKey: string) => void
  /** 行级"+ 全量"按钮 onClick */
  readonly onRunFull?: (siteKey: string) => void
  /** {more} dropdown 行项 — 编辑站点（打开 CrawlerSiteFormDrawer edit）*/
  readonly onEdit?: (site: CrawlerSite) => void
  /** {more} dropdown 行项 — 启用/禁用切换 */
  readonly onToggleDisable?: (site: CrawlerSite) => void
  /** {more} dropdown 行项 — 复制 key */
  readonly onCopyKey?: (key: string) => void
  /** {more} dropdown 行项 — 标记/取消成人 */
  readonly onMarkAdult?: (site: CrawlerSite) => void
  /** {more} dropdown 行项 — 标记短剧/标记 vod 切换 */
  readonly onMarkShortdrama?: (site: CrawlerSite) => void
  /** 行展开状态读（REDO-01-E 实装：chevron 旋转 + 行点击 toggle） */
  readonly expandedKeys?: ReadonlySet<string>
  /** 行展开 toggle 回调（REDO-01-E）*/
  readonly onToggleExpand?: (siteKey: string) => void
  /** 站点 stats 映射（routeCount + health；来自 GET /admin/crawler/kpi siteStats） */
  readonly siteStats?: ReadonlyMap<string, CrawlerSiteStat>
}

const NOOP_SITE = (_site: CrawlerSite): void => {
  // callbacks 缺省时静默；测试环境若需断言 — 消费方应显式传入
}
const NOOP_KEY = (_key: string): void => {
  // callbacks 缺省时静默
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

// CHG-SN-8-02：last-crawl-status pill + schedule pill 共用基础样式
const PILL_BASE_STYLE: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '4px',
  padding: '2px 8px',
  borderRadius: 'var(--radius-pill, 12px)',
  fontSize: '11px',
  fontWeight: 500,
  lineHeight: 1.4,
}

const LAST_CRAWL_CELL_STYLE: CSSProperties = {
  display: 'inline-flex',
  flexDirection: 'column',
  gap: '2px',
  alignItems: 'flex-start',
}

function lastCrawlStatusPillStyle(status: string | null | undefined): CSSProperties {
  if (status === 'ok') {
    return {
      ...PILL_BASE_STYLE,
      background: 'var(--state-success-bg, var(--state-ok-soft))',
      color: 'var(--state-success-fg, var(--state-ok))',
    }
  }
  if (status === 'failed') {
    return {
      ...PILL_BASE_STYLE,
      background: 'var(--state-danger-bg, var(--state-danger-soft))',
      color: 'var(--state-danger-fg, var(--state-danger))',
    }
  }
  if (status === 'running') {
    return {
      ...PILL_BASE_STYLE,
      background: 'var(--state-info-bg, var(--state-info-soft))',
      color: 'var(--state-info-fg, var(--state-info))',
    }
  }
  // null / unknown
  return {
    ...PILL_BASE_STYLE,
    background: 'var(--bg-subtle, var(--bg-surface))',
    color: 'var(--fg-muted)',
  }
}

function lastCrawlStatusLabel(status: string | null | undefined): string {
  if (status === 'ok') return '成功'
  if (status === 'failed') return '失败'
  if (status === 'running') return '运行中'
  return '未采集'
}

// 注：调度列推迟到 CHG-SN-8-02-B（需 cross-fetch AutoCrawlConfig.perSiteOverrides）

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

const ACTIONS_CELL_STYLE: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '4px',
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
  const {
    expandedKeys,
    onToggleExpand,
    siteStats,
    onRunIncremental,
    onRunFull,
    onEdit = NOOP_SITE,
    onToggleDisable = NOOP_SITE,
    onCopyKey = NOOP_KEY,
    onMarkAdult = NOOP_SITE,
    onMarkShortdrama = NOOP_SITE,
  } = callbacks

  return [
    // EP-3-F（2026-05-24）：AMD2 D-150-AMD2-2 kind='action'
    //   chevron 列是行展开按钮（非数据 / chrome 交互）/ type 层强制 never
    //   其它 7 列 client mode 默认 data kind / AMD2 默认前端 100% 过滤+排序 ✓
    {
      id: 'chevron',
      kind: 'action',
      header: '',
      accessor: () => null,
      width: 32,
      defaultVisible: true,
      pinned: true,
      cell: ({ row }) => {
        const expanded = expandedKeys?.has(row.key) ?? false
        return (
          <button
            type="button"
            style={{
              background: 'transparent',
              border: 'none',
              padding: '4px',
              cursor: onToggleExpand ? 'pointer' : 'default',
              ...CHEVRON_STYLE,
              transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
            }}
            onClick={(e) => {
              e.stopPropagation()
              onToggleExpand?.(row.key)
            }}
            data-chevron
            data-expanded={expanded ? '' : undefined}
            aria-label={expanded ? `折叠 ${row.name}` : `展开 ${row.name}`}
            data-testid={`crawler-row-expand-${row.key}`}
          >
            ›
          </button>
        )
      },
    },
    {
      id: 'status',
      header: '',
      accessor: (r) => (r.disabled ? 'disabled' : 'enabled'),
      width: 32,
      defaultVisible: true,
      enableSorting: true,
      columnMenu: { canSort: true, canHide: false },  // status dot 始终显示
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
      pinned: true,
      enableSorting: true,
      enableResizing: true,
      columnMenu: { canSort: true, canHide: false },  // site 列锁定不可隐藏
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
      enableSorting: true,
      enableResizing: true,
      columnMenu: { canSort: true, canHide: true },
      cell: ({ row }) => <span style={PILL_TYPE_STYLE}>{row.sourceType}</span>,
    },
    {
      id: 'routes',
      header: '线路',
      accessor: (r) => siteStats?.get(r.key)?.routeCount ?? 0,
      width: 80,
      defaultVisible: true,
      enableSorting: true,
      enableResizing: true,
      columnMenu: { canSort: true, canHide: true },
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
      enableSorting: true,
      enableResizing: true,
      columnMenu: { canSort: true, canHide: true },
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
      enableSorting: true,
      enableResizing: true,
      columnMenu: { canSort: true, canHide: true },
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
      width: 130,
      defaultVisible: true,
      enableSorting: true,
      enableResizing: true,
      columnMenu: { canSort: true, canHide: true },
      // CHG-SN-8-02：原来只有相对时间，补 status pill 显式表达上次采集成功/失败/运行中
      cell: ({ row }) => (
        <span style={LAST_CRAWL_CELL_STYLE} data-last-crawl>
          <span
            style={lastCrawlStatusPillStyle(row.lastCrawlStatus)}
            data-last-crawl-status={row.lastCrawlStatus ?? 'none'}
          >
            {lastCrawlStatusLabel(row.lastCrawlStatus)}
          </span>
          <span style={{ fontSize: '11px', color: 'var(--fg-muted)' }} data-last-crawl-time>
            {formatRelativeTime(row.lastCrawledAt)}
          </span>
        </span>
      ),
    },
    // EP-3-F：AMD2 kind='action' 替代 columnMenu canSort/canHide false 双字段
    {
      id: 'actions',
      kind: 'action',
      header: '操作',
      accessor: () => null,
      width: 200,
      defaultVisible: true,
      pinned: true,  // 操作列锁定右侧 / 不可隐藏
      cell: ({ row }) => (
        <span style={ACTIONS_CELL_STYLE} data-actions-cell onClick={(e) => e.stopPropagation()}>
          <AdminButton
            size="sm"
            variant="default"
            onClick={() => onRunIncremental?.(row.key)}
            disabled={row.disabled || !onRunIncremental}
            data-testid={`crawler-row-run-incremental-${row.key}`}
          >
            + 增量
          </AdminButton>
          <AdminButton
            size="sm"
            variant="default"
            onClick={() => onRunFull?.(row.key)}
            disabled={row.disabled || !onRunFull}
            data-testid={`crawler-row-run-full-${row.key}`}
          >
            + 全量
          </AdminButton>
          <CrawlerSiteRowActions
            site={row}
            onEdit={onEdit}
            onToggleDisable={onToggleDisable}
            onCopyKey={onCopyKey}
            onMarkAdult={onMarkAdult}
            onMarkShortdrama={onMarkShortdrama}
          />
        </span>
      ),
    },
  ]
}
