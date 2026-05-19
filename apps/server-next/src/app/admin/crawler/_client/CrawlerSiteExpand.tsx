'use client'

/**
 * CrawlerSiteExpand.tsx — 采集站点行展开：线路 sub-table（REDO-01-E）
 *
 * 真源：M-SN-7-redo-01-contract.md §1.5 + ADR-117 AMENDMENT 2026-05-19
 *
 * REDO-01-E 范围：
 *   - lazy fetch GET /admin/sources/routes/by-site/:siteKey
 *   - 6 列 sub-table：线路名 / 别名 inline-edit / 探测 pill / 播放 pill / 延迟 / 操作占位
 *   - 别名 inline-edit 复用 PUT /admin/source-line-aliases/:siteKey/:sourceName（ADR-117 row 5）
 *   - 3 actions（play/refresh/trash）UI 占位 disabled — REDO-01-E2 实装
 *
 * 不在范围（REDO-01-F）：
 *   - 分类映射 collapsible（ADR-123 / `PUT /admin/crawler/sites/:key/category-mapping`）
 *
 * 不在范围（REDO-01-E2 / Y1）：
 *   - moderator role 时 alias inline-edit 隐藏/禁用 — 后端 PUT 已 admin only，UI 守卫由 E2 / 独立 MISC 卡承担
 */

import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { AdminButton, AdminInput, useToast } from '@resovo/admin-ui'
import { listRoutesBySite, upsertLineAlias } from '@/lib/sources/api'
import type { SourceRouteBySite } from '@/lib/sources/types'
import { ApiClientError } from '@/lib/api-client'

export interface CrawlerSiteExpandProps {
  readonly siteKey: string
  readonly siteName: string
}

const WRAPPER_STYLE: CSSProperties = {
  background: 'var(--bg-surface-elevated)',
  borderBottom: '1px solid var(--border-subtle)',
  padding: '12px 16px',
}

const HEADER_STYLE: CSSProperties = {
  fontSize: '11px',
  color: 'var(--fg-muted)',
  marginBottom: '10px',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
}

const TABLE_STYLE: CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: 'var(--font-size-xs)',
}

const TH_STYLE: CSSProperties = {
  textAlign: 'left',
  fontWeight: 600,
  color: 'var(--fg-muted)',
  padding: '6px 8px',
  borderBottom: '1px solid var(--border-subtle)',
}

const TD_STYLE: CSSProperties = {
  padding: '6px 8px',
  borderBottom: '1px solid var(--border-subtle)',
  verticalAlign: 'middle',
}

const PILL_BASE_STYLE: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '4px',
  padding: '2px 8px',
  borderRadius: 'var(--radius-pill, 12px)',
  fontSize: '11px',
  fontWeight: 500,
}

const PILL_DOT_STYLE: CSSProperties = {
  display: 'inline-block',
  width: 6,
  height: 6,
  borderRadius: '50%',
}

const ACTIONS_CELL_STYLE: CSSProperties = {
  display: 'inline-flex',
  gap: '4px',
}

const PROTOCOL_STYLE: CSSProperties = {
  fontSize: '10px',
  color: 'var(--fg-muted)',
  fontFamily: 'var(--font-mono, ui-monospace, monospace)',
  marginLeft: '8px',
}

type SignalState = SourceRouteBySite['probeStatus']

function pillForSignal(signal: SignalState): { style: CSSProperties; label: string } {
  switch (signal) {
    case 'ok':
      return {
        style: { ...PILL_BASE_STYLE, background: 'var(--state-success-bg)', color: 'var(--state-success-fg)' },
        label: 'OK',
      }
    case 'partial':
      return {
        style: { ...PILL_BASE_STYLE, background: 'var(--state-warning-bg)', color: 'var(--state-warning-fg)' },
        label: '部分',
      }
    case 'dead':
      return {
        style: { ...PILL_BASE_STYLE, background: 'var(--state-danger-bg, var(--state-error-bg))', color: 'var(--state-danger-fg, var(--state-error-fg))' },
        label: '失效',
      }
    case 'pending':
    default:
      return {
        style: { ...PILL_BASE_STYLE, background: 'var(--bg-subtle, var(--bg-surface))', color: 'var(--fg-muted)' },
        label: '未探测',
      }
  }
}

function SignalPill({ signal, testId }: { signal: SignalState; testId?: string }) {
  const { style, label } = pillForSignal(signal)
  const dotStyle: CSSProperties = { ...PILL_DOT_STYLE, background: style.color as string }
  return (
    <span style={style} data-signal={signal} data-testid={testId}>
      <span style={dotStyle} />
      {label}
    </span>
  )
}

export function CrawlerSiteExpand({ siteKey, siteName }: CrawlerSiteExpandProps) {
  const toast = useToast()
  const [rows, setRows] = useState<readonly SourceRouteBySite[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    listRoutesBySite(siteKey)
      .then((data) => setRows(data))
      .catch((err: unknown) => {
        if (err instanceof ApiClientError) setError(err.message)
        else setError('加载线路明细失败')
      })
      .finally(() => setLoading(false))
  }, [siteKey])

  useEffect(() => {
    load()
  }, [load])

  const handleAliasSave = useCallback(
    async (sourceName: string, displayName: string) => {
      try {
        const updated = await upsertLineAlias(siteKey, sourceName, displayName)
        setRows((prev) =>
          prev
            ? prev.map((r) =>
                r.sourceName === sourceName ? { ...r, displayName: updated.displayName } : r,
              )
            : prev,
        )
        toast.push({ title: '别名已更新', description: `${siteKey} / ${sourceName}`, level: 'success' })
      } catch (err: unknown) {
        const message = err instanceof ApiClientError ? err.message : '请稍后重试'
        toast.push({ title: '别名保存失败', description: message, level: 'danger' })
      }
    },
    [siteKey, toast],
  )

  if (loading && !rows) {
    return (
      <div style={WRAPPER_STYLE} data-testid={`crawler-expand-loading-${siteKey}`}>
        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--fg-muted)' }}>加载线路明细中…</div>
      </div>
    )
  }

  if (error) {
    return (
      <div style={WRAPPER_STYLE} data-testid={`crawler-expand-error-${siteKey}`}>
        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--state-danger-fg, var(--fg-danger))' }}>
          {error}
        </div>
        <AdminButton size="sm" variant="default" onClick={load} data-testid={`crawler-expand-retry-${siteKey}`}>
          重试
        </AdminButton>
      </div>
    )
  }

  if (!rows || rows.length === 0) {
    return (
      <div style={WRAPPER_STYLE} data-testid={`crawler-expand-empty-${siteKey}`}>
        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--fg-muted)' }}>
          该站点暂无线路数据
        </div>
      </div>
    )
  }

  return (
    <div style={WRAPPER_STYLE} data-testid={`crawler-expand-${siteKey}`}>
      <div style={HEADER_STYLE}>
        <span>线路明细 — {siteName} · 共 {rows.length} 条</span>
        <span>探测 / 播放 状态按 worst 聚合（aggregateSignal）</span>
      </div>
      <table style={TABLE_STYLE} data-crawler-routes-table>
        <thead>
          <tr>
            <th style={{ ...TH_STYLE, width: '1fr' }}>线路名</th>
            <th style={{ ...TH_STYLE, width: 120 }}>别名</th>
            <th style={{ ...TH_STYLE, width: 70 }}>探测</th>
            <th style={{ ...TH_STYLE, width: 70 }}>播放</th>
            <th style={{ ...TH_STYLE, width: 70 }}>延迟</th>
            <th style={{ ...TH_STYLE, width: 110 }}>操作</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <RouteRow
              key={`${row.sourceSiteKey}::${row.sourceName}`}
              row={row}
              onAliasSave={handleAliasSave}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}

function RouteRow({
  row,
  onAliasSave,
}: {
  readonly row: SourceRouteBySite
  readonly onAliasSave: (sourceName: string, displayName: string) => Promise<void>
}) {
  const [draft, setDraft] = useState<string>(row.displayName ?? '')
  const [saving, setSaving] = useState(false)

  const baseline = row.displayName ?? ''

  const handleBlur = async () => {
    const trimmed = draft.trim()
    if (trimmed === baseline) return // no change
    if (trimmed === '') {
      // 空别名等价于删除；当前 PUT 端点要求 displayName 非空 → 还原 draft
      setDraft(baseline)
      return
    }
    setSaving(true)
    try {
      await onAliasSave(row.sourceName, trimmed)
    } finally {
      setSaving(false)
    }
  }

  return (
    <tr data-source-name={row.sourceName}>
      <td style={TD_STYLE}>
        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--fg-default)' }}>
          {row.sourceName}
        </span>
        <span style={PROTOCOL_STYLE}>{row.sourceCount} 集 · {row.activeCount} 活</span>
      </td>
      <td style={TD_STYLE}>
        <AdminInput
          size="sm"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={handleBlur}
          disabled={saving}
          placeholder="（未设置）"
          aria-label={`${row.sourceName} 别名`}
          data-testid={`crawler-route-alias-${row.sourceName}`}
        />
      </td>
      <td style={TD_STYLE}>
        <SignalPill signal={row.probeStatus} testId={`crawler-route-probe-${row.sourceName}`} />
      </td>
      <td style={TD_STYLE}>
        <SignalPill signal={row.renderStatus} testId={`crawler-route-render-${row.sourceName}`} />
      </td>
      <td style={TD_STYLE}>
        <span data-testid={`crawler-route-latency-${row.sourceName}`}>
          {row.avgLatencyMs != null ? `${row.avgLatencyMs}ms` : '—'}
        </span>
      </td>
      <td style={TD_STYLE}>
        <span style={ACTIONS_CELL_STYLE} data-actions-placeholder title="REDO-01-E2 实装">
          <AdminButton size="sm" variant="default" disabled aria-label={`测试播放 ${row.sourceName}`}>
            ▷
          </AdminButton>
          <AdminButton size="sm" variant="default" disabled aria-label={`重新探测 ${row.sourceName}`}>
            ↻
          </AdminButton>
          <AdminButton size="sm" variant="danger" disabled aria-label={`删除 ${row.sourceName}`}>
            🗑
          </AdminButton>
        </span>
      </td>
    </tr>
  )
}
