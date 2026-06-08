'use client'

/**
 * CollectionsTab — 豆瓣热门资源分类展示（ADR-188 D-188-5 collections）
 *
 * 顶部分类 chips（各合集条目数，点击过滤）+ 条目 DataTable（排名/封面/标题/年份/评分）。
 * summary 为全合集分类计数（不随当前 collection 过滤变化，始终展示全部分类）。
 *
 * 共享原语：DataTable / Thumb / Pill / EmptyState / LoadingState / ErrorState（零新组件）。
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  DataTable,
  Thumb,
  EmptyState,
  ErrorState,
  LoadingState,
  useTableQuery,
  type ColumnDescriptor,
  type TableColumn,
  type TableQueryPatch,
} from '@resovo/admin-ui'
import type { ProviderKey } from '@resovo/types'
import { useTableRouterAdapter } from '@/lib/table-router-adapter'
import {
  fetchCollections,
  COLLECTION_LABELS,
  labelOf,
  calendarWeekday,
  thisWeekDateOf,
  type CollectionItem,
  type CollectionSummaryItem,
} from '@/lib/external-resources/api'

const COLUMN_DESCRIPTORS: readonly ColumnDescriptor[] = [
  { id: 'rank', header: '排名', defaultVisible: true },
  { id: 'cover', header: '封面', defaultVisible: true },
  { id: 'title', header: '标题', defaultVisible: true },
  { id: 'year', header: '年份', defaultVisible: true },
  { id: 'rating', header: '评分', defaultVisible: true },
  { id: 'externalId', header: '外部 ID', defaultVisible: true },
]

const CHIPS_ROW_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: '8px',
  marginBottom: '12px',
}

const CHIP_STYLE: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '4px',
  height: '24px',
  padding: '0 10px',
  border: '1px solid var(--border-default)',
  borderRadius: '999px',
  background: 'var(--bg-surface)',
  color: 'var(--fg-muted)',
  fontFamily: 'inherit',
  fontSize: 'var(--font-size-xs)',
  lineHeight: 1,
  cursor: 'pointer',
}

const CHIP_PRESSED_STYLE: React.CSSProperties = {
  background: 'var(--admin-accent-soft)',
  border: '1px solid var(--admin-accent-border)',
  color: 'var(--accent-default)',
  fontWeight: 600,
}

const CHIP_COUNT_STYLE: React.CSSProperties = {
  fontVariantNumeric: 'tabular-nums',
  opacity: 0.85,
}

const TITLE_CELL_STYLE: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: '2px' }
const ORIGINAL_TITLE_STYLE: React.CSSProperties = { fontSize: 'var(--font-size-xxs)', color: 'var(--fg-muted)' }

// 合集为服务端预排序的策展榜单：列宽可调 + 列设置（隐藏列），但不挂排序（server sort 未接线，
// 避免 no-op）/ 不挂列过滤（合集切换走表上方 chips）。对齐 VideoColumns 列宽范式（width+minWidth+enableResizing）。
function buildColumns(): readonly TableColumn<CollectionItem>[] {
  return [
    {
      id: 'rank', header: '排名', accessor: (r) => r.rank,
      width: 72, minWidth: 56, enableResizing: true, enableSorting: false, filterable: false,
      cell: ({ row }) => <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--fg-muted)' }}>{row.rank + 1}</span>,
    },
    {
      id: 'cover', header: '封面', kind: 'media', accessor: (r) => r.coverUrl,
      width: 72, minWidth: 56, enableResizing: true,
      cell: ({ row }) => <Thumb src={row.coverUrl} size="poster-sm" alt={row.title} />,
    },
    {
      id: 'title', header: '标题', accessor: (r) => r.title,
      minWidth: 220, enableResizing: true, enableSorting: false, filterable: false,
      cell: ({ row }) => (
        <span style={TITLE_CELL_STYLE}>
          <span style={{ color: 'var(--fg-default)' }}>{row.title}</span>
          {row.subtitle && <span style={ORIGINAL_TITLE_STYLE}>{row.subtitle}</span>}
        </span>
      ),
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

export function CollectionsTab({ provider }: { provider: ProviderKey }) {
  const router = useTableRouterAdapter()
  const { snapshot, patch } = useTableQuery({
    tableId: 'ext-collections',
    router,
    urlNamespace: 'col',
    defaults: { pagination: { page: 1, pageSize: 20 } },
    columns: COLUMN_DESCRIPTORS,
  })

  const [collection, setCollection] = useState<string | null>(null)
  const [items, setItems] = useState<CollectionItem[]>([])
  const [summary, setSummary] = useState<CollectionSummaryItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | undefined>()
  const [retryKey, setRetryKey] = useState(0)

  const columns = useMemo(() => buildColumns(), [])
  const page = snapshot.pagination.page
  const pageSize = snapshot.pagination.pageSize

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(undefined)
    fetchCollections(provider, { ...(collection ? { collection } : {}), page, limit: pageSize })
      .then((res) => {
        if (cancelled) return
        setItems(res?.items ?? [])
        setTotal(res?.total ?? 0)
        setSummary(res?.summary ?? [])
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(err instanceof Error ? err : new Error(String(err)))
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [provider, collection, page, pageSize, retryKey])

  const resetToFirstPage = useCallback(() => {
    if (snapshot.pagination.page !== 1) patch({ pagination: { page: 1, pageSize } })
  }, [patch, snapshot.pagination.page, pageSize])

  const selectCollection = useCallback((key: string | null) => {
    setCollection(key)
    resetToFirstPage()
  }, [resetToFirstPage])

  const handlePatch = useCallback((next: TableQueryPatch) => patch(next), [patch])

  if (loading && items.length === 0 && summary.length === 0) {
    return <LoadingState variant="skeleton" />
  }
  if (error) {
    return <ErrorState error={error} title="加载失败" onRetry={() => setRetryKey((k) => k + 1)} />
  }

  return (
    <div data-collections-tab>
      <div style={CHIPS_ROW_STYLE} data-collection-chips role="group" aria-label="合集分类">
        <button
          type="button"
          data-collection-chip="all"
          aria-pressed={collection === null}
          onClick={() => selectCollection(null)}
          style={collection === null ? { ...CHIP_STYLE, ...CHIP_PRESSED_STYLE } : CHIP_STYLE}
        >
          全部分类
        </button>
        {summary.map((s) => {
          const pressed = collection === s.collection
          // 每日放送：标签加本周真实日期（周一 6/8…连续），数量标「N 部」避免误读为日期
          const wd = calendarWeekday(s.collection)
          const label = wd ? `${labelOf(COLLECTION_LABELS, s.collection)} ${thisWeekDateOf(wd)}` : labelOf(COLLECTION_LABELS, s.collection)
          return (
            <button
              key={s.collection}
              type="button"
              data-collection-chip={s.collection}
              aria-pressed={pressed}
              onClick={() => selectCollection(s.collection)}
              style={pressed ? { ...CHIP_STYLE, ...CHIP_PRESSED_STYLE } : CHIP_STYLE}
              title={`${s.domain ? `${s.domain} · ` : ''}${s.category}`}
            >
              {label}
              <span style={CHIP_COUNT_STYLE}>{wd ? `${s.count} 部` : s.count}</span>
            </button>
          )
        })}
      </div>

      <DataTable<CollectionItem>
        rows={items}
        columns={columns}
        rowKey={(row) => `${row.collection}:${row.externalId}`}
        mode="server"
        query={snapshot}
        onQueryChange={handlePatch}
        totalRows={total}
        loading={loading}
        density="poster"
        enableColumnResizing
        emptyState={<EmptyState title="暂无热门资源" description="该分类暂无采集条目" />}
        data-testid="ext-collections-table"
        toolbar={{ hideFilterChips: true }}
        pagination={{ pageSizeOptions: [20, 50, 100] }}
      />
    </div>
  )
}
