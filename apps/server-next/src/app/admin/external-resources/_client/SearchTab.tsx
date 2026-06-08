'use client'

/**
 * SearchTab — 豆瓣数据资源统一搜索（ADR-188 D-188-5/6 search）
 *
 * 先查离线 dump（秒回）+ 「在线实时」开关追加 adapter resolver 候选（受全局并发 1 限流，
 * busy 时降级仅 dump + liveError 提示）。结果 DataTable（来源 Pill 区分 offline/online）。
 *
 * 共享原语：DataTable / DataTableSearchInput / Pill / EmptyState / ErrorState（零新组件）。
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  DataTable,
  DataTableSearchInput,
  Pill,
  EmptyState,
  ErrorState,
  useTableQuery,
  type ColumnDescriptor,
  type TableColumn,
  type TableQueryPatch,
} from '@resovo/admin-ui'
import type { ProviderKey } from '@resovo/types'
import { useTableRouterAdapter } from '@/lib/table-router-adapter'
import { searchResources, type SearchHit } from '@/lib/external-resources/api'

const COLUMN_DESCRIPTORS: readonly ColumnDescriptor[] = [
  { id: 'source', header: '来源', defaultVisible: true },
  { id: 'title', header: '标题', defaultVisible: true },
  { id: 'year', header: '年份', defaultVisible: true },
  { id: 'rating', header: '评分', defaultVisible: true },
  { id: 'externalId', header: '外部 ID', defaultVisible: true },
]

const LIVE_TOGGLE_STYLE: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '4px',
  height: '28px',
  padding: '0 12px',
  border: '1px solid var(--border-default)',
  borderRadius: '999px',
  background: 'var(--bg-surface)',
  color: 'var(--fg-muted)',
  fontFamily: 'inherit',
  fontSize: 'var(--font-size-xs)',
  cursor: 'pointer',
}

const LIVE_TOGGLE_ON_STYLE: React.CSSProperties = {
  background: 'var(--admin-accent-soft)',
  border: '1px solid var(--admin-accent-border)',
  color: 'var(--accent-default)',
  fontWeight: 600,
}

const BUSY_BANNER_STYLE: React.CSSProperties = {
  margin: '0 0 12px',
  padding: '8px 12px',
  borderRadius: 'var(--radius-sm)',
  background: 'var(--state-warning-bg, var(--bg-subtle))',
  border: '1px solid var(--state-warning-border, var(--border-default))',
  color: 'var(--state-warning-fg, var(--fg-default))',
  fontSize: 'var(--font-size-xs)',
}

// 搜索结果列：列宽可调 + 列设置；结果由关键词检索决定，不挂列过滤/列排序（server 模式未接线，避免 no-op）。
function buildColumns(): readonly TableColumn<SearchHit>[] {
  return [
    {
      id: 'source', header: '来源', accessor: (r) => r.source,
      width: 80, minWidth: 64, enableResizing: true, enableSorting: false, filterable: false,
      cell: ({ row }) => <Pill variant={row.source === 'online' ? 'info' : 'neutral'}>{row.source === 'online' ? '在线' : '离线'}</Pill>,
    },
    {
      id: 'title', header: '标题', accessor: (r) => r.title,
      minWidth: 220, enableResizing: true, enableSorting: false, filterable: false,
      cell: ({ row }) => <span style={{ color: 'var(--fg-default)' }}>{row.title}</span>,
    },
    {
      id: 'year', header: '年份', accessor: (r) => r.year,
      width: 90, minWidth: 80, enableResizing: true, enableSorting: false, filterable: false,
      cell: ({ row }) => <span style={{ fontVariantNumeric: 'tabular-nums' }}>{row.year ?? '—'}</span>,
    },
    {
      id: 'rating', header: '评分', accessor: (r) => r.rating,
      width: 90, minWidth: 80, enableResizing: true, enableSorting: false, filterable: false,
      cell: ({ row }) => <span style={{ fontVariantNumeric: 'tabular-nums', color: row.rating ? 'var(--state-success-fg)' : 'var(--fg-muted)' }}>{row.rating == null ? '—' : row.rating.toFixed(1)}</span>,
    },
    {
      id: 'externalId', header: '外部 ID', accessor: (r) => r.externalId,
      width: 120, minWidth: 100, enableResizing: true, enableSorting: false, filterable: false,
      cell: ({ row }) => <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--fg-muted)' }}>{row.externalId}</span>,
    },
  ]
}

export function SearchTab({ provider }: { provider: ProviderKey }) {
  const router = useTableRouterAdapter()
  const { snapshot, patch } = useTableQuery({
    tableId: 'ext-search',
    router,
    urlNamespace: 'srch',
    defaults: { pagination: { page: 1, pageSize: 20 } },
    columns: COLUMN_DESCRIPTORS,
  })

  const [q, setQ] = useState('')
  const [live, setLive] = useState(false)
  const [rows, setRows] = useState<SearchHit[]>([])
  const [total, setTotal] = useState(0)
  const [liveError, setLiveError] = useState<string | undefined>()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | undefined>()
  const [retryKey, setRetryKey] = useState(0)

  const columns = useMemo(() => buildColumns(), [])
  const page = snapshot.pagination.page
  const pageSize = snapshot.pagination.pageSize
  const trimmed = q.trim()

  useEffect(() => {
    if (trimmed.length === 0) {
      setRows([])
      setTotal(0)
      setLiveError(undefined)
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(undefined)
    searchResources(provider, { q: trimmed, live, page, limit: pageSize })
      .then((res) => {
        if (cancelled) return
        setRows(res?.rows ?? [])
        setTotal(res?.total ?? 0)
        setLiveError(res?.liveError)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(err instanceof Error ? err : new Error(String(err)))
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [provider, trimmed, live, page, pageSize, retryKey])

  const resetToFirstPage = useCallback(() => {
    if (snapshot.pagination.page !== 1) patch({ pagination: { page: 1, pageSize } })
  }, [patch, snapshot.pagination.page, pageSize])

  const onSearchChange = useCallback((next: string) => {
    setQ(next)
    resetToFirstPage()
  }, [resetToFirstPage])

  const toggleLive = useCallback(() => {
    setLive((v) => !v)
    resetToFirstPage()
  }, [resetToFirstPage])

  const handlePatch = useCallback((next: TableQueryPatch) => patch(next), [patch])

  if (error) {
    return <ErrorState error={error} title="搜索失败" onRetry={() => setRetryKey((k) => k + 1)} />
  }

  const searchNode = (
    <DataTableSearchInput
      value={q}
      onChange={onSearchChange}
      placeholder="搜索资源（标题）"
      aria-label="搜索外部资源"
      data-testid="ext-search-input"
    />
  )

  const liveToggleNode = (
    <button
      type="button"
      onClick={toggleLive}
      aria-pressed={live}
      style={live ? { ...LIVE_TOGGLE_STYLE, ...LIVE_TOGGLE_ON_STYLE } : LIVE_TOGGLE_STYLE}
      data-testid="ext-search-live-toggle"
      title="开启后追加在线实时搜索候选（受限流）"
    >
      在线实时
    </button>
  )

  const emptyNode = trimmed.length === 0
    ? <EmptyState title="输入关键词搜索" description="先查离线 dump（秒回）；开启「在线实时」追加 provider 实时候选" />
    : <EmptyState title="无匹配结果" description="换个关键词，或开启「在线实时」" />

  return (
    <div data-search-tab>
      {liveError === 'busy' && (
        <p style={BUSY_BANNER_STYLE} data-search-live-busy role="status">
          在线搜索繁忙（已有实时请求进行中），本次仅显示离线结果。稍后重试可获取在线候选。
        </p>
      )}
      <DataTable<SearchHit>
        rows={rows}
        columns={columns}
        rowKey={(row) => `${row.source}:${row.externalId}`}
        mode="server"
        query={snapshot}
        onQueryChange={handlePatch}
        totalRows={total}
        loading={loading}
        enableColumnResizing
        emptyState={emptyNode}
        data-testid="ext-search-table"
        toolbar={{ search: searchNode, trailing: liveToggleNode, hideFilterChips: true }}
        pagination={{ pageSizeOptions: [20, 50, 100] }}
      />
    </div>
  )
}
