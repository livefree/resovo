'use client'

/**
 * SourcesClient.tsx — `/admin/sources` 播放线路管理主组件（CHG-SN-5-11-PATCH）
 *
 * 范围：KPI 4 卡 + Segment 4 tabs + DataTable 一体化（toolbar.search + bulkActions +
 *       pagination + row 展开 slot）+ 全局别名面板
 * 端点：apps/api/src/routes/admin/sources-matrix.ts（ADR-117）
 *
 * 原语消费：PageHeader / AdminButton / AdminInput / AdminCard / KpiCard /
 *           LoadingState / ErrorState / DataTable + useToast
 */

import { useState, useEffect, useCallback, useRef, useMemo, type CSSProperties } from 'react'
import Image from 'next/image'
import {
  PageHeader,
  AdminButton,
  AdminInput,
  AdminCard,
  KpiCard,
  LoadingState,
  ErrorState,
  DataTable,
  useToast,
  type TableColumn,
  type TableSortState,
} from '@resovo/admin-ui'
import type { VideoGroupRow, VideoGroupStats, SourceSegment } from '@/lib/sources/types'
import { listVideoGroups, getVideoGroupStats } from '@/lib/sources/api'
import { SignalPill, MatrixExpand } from './SourceMatrixRow'
import { SourceLineAliasPanel } from './SourceLineAliasPanel'

// ── 常量 ─────────────────────────────────────────────────────────

const SEGMENTS: readonly { key: SourceSegment; label: string }[] = [
  { key: 'grouped',    label: '按视频分组' },
  { key: 'dead',       label: '仅失效' },
  { key: 'correction', label: '用户纠错' },
  { key: 'orphan',     label: '孤岛源' },
]

const DEFAULT_PAGE_SIZE = 20

// ── 样式 ─────────────────────────────────────────────────────────

const PAGE_STYLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  minHeight: 0,
  gap: 'var(--section-gap)',
  padding: 'var(--page-padding-y) var(--page-padding-x) 0',
}

const KPI_GRID_STYLE: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(4, 1fr)',
  gap: '12px',
}

const TAB_BAR_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
  borderBottom: '1px solid var(--border-subtle)',
}

function tabStyle(active: boolean): CSSProperties {
  return {
    padding: '8px 16px',
    fontSize: 'var(--font-size-sm)',
    fontWeight: active ? 600 : 400,
    color: active ? 'var(--fg-default)' : 'var(--fg-muted)',
    background: 'none',
    border: 'none',
    borderBottom: active ? '2px solid var(--accent-default)' : '2px solid transparent',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    font: 'inherit',
  }
}

// ── 列定义 ────────────────────────────────────────────────────────

function buildColumns(
  expandedKeys: ReadonlySet<string>,
): readonly TableColumn<VideoGroupRow>[] {
  return [
    {
      id: 'video',
      header: '视频',
      accessor: (r) => r.title,
      minWidth: 200,
      cell: ({ row }) => {
        const isExpanded = expandedKeys.has(row.videoId)
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{
              fontSize: '14px',
              color: 'var(--fg-muted)',
              transform: isExpanded ? 'rotate(90deg)' : 'none',
              transition: 'transform 0.15s',
              flexShrink: 0,
              userSelect: 'none',
            }}>›</span>
            {row.coverUrl && (
              <Image
                src={row.coverUrl}
                alt=""
                width={32}
                height={44}
                sizes="32px"
                style={{ objectFit: 'cover', borderRadius: '3px', flexShrink: 0 }}
              />
            )}
            <div style={{ minWidth: 0 }}>
              <div style={{
                fontSize: '13px',
                fontWeight: 500,
                color: 'var(--fg-default)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {row.title}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--fg-muted)', marginTop: '1px' }}>
                {row.type} · {row.year ?? '—'}
              </div>
            </div>
          </div>
        )
      },
    },
    {
      id: 'lineCount',
      header: '线路',
      accessor: (r) => r.lineCount,
      width: 80,
      enableSorting: true,
      cell: ({ row }) => (
        <span>
          <strong>{row.lineCount}</strong>{' '}
          <span style={{ fontSize: '11px', color: 'var(--fg-muted)' }}>条</span>
        </span>
      ),
    },
    {
      id: 'sourceCount',
      header: '集·源',
      accessor: (r) => r.sourceCount,
      width: 90,
      enableSorting: true,
      cell: ({ row }) => (
        <span>
          <strong>{row.sourceCount}</strong>{' '}
          <span style={{ fontSize: '11px', color: 'var(--fg-muted)' }}>个</span>
        </span>
      ),
    },
    {
      id: 'probeStatus',
      header: '探测',
      accessor: (r) => r.probeStatus,
      width: 100,
      cell: ({ row }) => <SignalPill status={row.probeStatus} />,
    },
    {
      id: 'renderStatus',
      header: '播放',
      accessor: (r) => r.renderStatus,
      width: 100,
      cell: ({ row }) => <SignalPill status={row.renderStatus} />,
    },
    {
      id: 'updatedAt',
      header: '更新',
      accessor: (r) => r.updatedAt,
      width: 80,
      enableSorting: true,
      cell: ({ row }) => (
        <span style={{ fontSize: '11px', color: 'var(--fg-muted)' }}>
          {row.updatedAt ? new Date(row.updatedAt).toLocaleDateString('zh-CN') : '—'}
        </span>
      ),
    },
    {
      id: 'actions',
      header: '操作',
      accessor: () => null,
      width: 100,
      overflowVisible: true,
      cell: () => (
        <div style={{ display: 'flex', gap: '4px' }}>
          <button
            type="button"
            title="重验"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '24px', height: '24px',
              border: '1px solid var(--border-default)',
              borderRadius: '4px',
              background: 'var(--bg-surface)',
              color: 'var(--fg-muted)',
              cursor: 'pointer',
              fontSize: '12px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >↻</button>
          <button
            type="button"
            title="快速操作"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '24px', height: '24px',
              border: '1px solid var(--border-default)',
              borderRadius: '4px',
              background: 'var(--bg-surface)',
              color: 'var(--fg-muted)',
              cursor: 'pointer',
              fontSize: '12px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >⚡</button>
          <button
            type="button"
            title="更多"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '24px', height: '24px',
              border: '1px solid var(--border-default)',
              borderRadius: '4px',
              background: 'var(--bg-surface)',
              color: 'var(--fg-muted)',
              cursor: 'pointer',
              fontSize: '12px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >⋯</button>
        </div>
      ),
    },
  ]
}

// ── 主组件 ────────────────────────────────────────────────────────

export function SourcesClient() {
  const toast = useToast()
  const [segment, setSegment] = useState<SourceSegment>('grouped')
  const [searchInput, setSearchInput] = useState('')
  const [keyword, setKeyword] = useState<string | undefined>()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [sort, setSort] = useState<TableSortState>({ field: undefined, direction: 'desc' })

  const [stats, setStats] = useState<VideoGroupStats | null>(null)
  const [rows, setRows] = useState<readonly VideoGroupRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | undefined>()
  const [retryKey, setRetryKey] = useState(0)

  const [selectedKeys, setSelectedKeys] = useState<ReadonlySet<string>>(new Set())
  const [expandedKeys, setExpandedKeys] = useState<ReadonlySet<string>>(new Set())

  const [activeTab, setActiveTab] = useState<'matrix' | 'aliases'>('matrix')

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // KPI stats（独立请求，只加载一次）
  useEffect(() => {
    getVideoGroupStats().then(setStats).catch(() => null)
  }, [])

  // 搜索 debounce
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setKeyword(searchInput.trim() || undefined)
      setPage(1)
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [searchInput])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(undefined)
    listVideoGroups({ page, limit: pageSize, keyword, segment })
      .then((res) => {
        if (cancelled) return
        setRows(res.data as VideoGroupRow[])
        setTotal(res.total)
      })
      .catch((e: unknown) => {
        if (cancelled) return
        setError(e instanceof Error ? e : new Error('加载失败'))
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [page, pageSize, keyword, segment, retryKey])

  const refresh = useCallback(() => setRetryKey((k) => k + 1), [])

  function handleSegmentChange(seg: SourceSegment) {
    setSegment(seg)
    setPage(1)
    setSelectedKeys(new Set())
    setExpandedKeys(new Set())
  }

  function handleRowClick(row: VideoGroupRow) {
    setExpandedKeys((prev) => {
      const next = new Set(prev)
      if (next.has(row.videoId)) next.delete(row.videoId)
      else next.add(row.videoId)
      return next
    })
  }

  const columns = useMemo(() => buildColumns(expandedKeys), [expandedKeys])

  const query = useMemo(() => ({
    pagination: { page, pageSize },
    sort,
    filters: new Map(),
    columns: new Map(),
    selection: { selectedKeys, mode: 'page' as const },
  }), [page, pageSize, sort, selectedKeys])

  const toolbarSearch = (
    <AdminInput
      type="search"
      placeholder="搜索视频名称…"
      value={searchInput}
      onChange={(e) => setSearchInput(e.target.value)}
      size="sm"
      aria-label="搜索视频"
    />
  )

  const toolbarTrailing = (
    <AdminButton size="sm" variant="secondary" onClick={refresh}>
      刷新
    </AdminButton>
  )

  const bulkActions = selectedKeys.size > 0 ? (
    <AdminButton size="sm" variant="secondary">批量验证</AdminButton>
  ) : null

  return (
    <div style={PAGE_STYLE}>
      {/* 顶栏 */}
      <PageHeader
        title="播放线路"
        actions={
          <AdminButton size="sm" variant="primary">一键替换最相似 URL</AdminButton>
        }
      />

      {/* KPI 卡片（P1-6：orphan KPI label 统一为"孤岛"，ADR-117 §7）*/}
      <div style={KPI_GRID_STYLE}>
        <KpiCard
          label="总播放源"
          value={stats?.total ?? '—'}
          dataSource={stats ? 'live' : undefined}
        />
        <KpiCard
          label="有效"
          variant="is-ok"
          value={stats?.active ?? '—'}
          dataSource={stats ? 'live' : undefined}
        />
        <KpiCard
          label="失效"
          variant="is-danger"
          value={stats?.dead ?? '—'}
          dataSource={stats ? 'live' : undefined}
        />
        <KpiCard
          label="孤岛"
          variant="is-warn"
          value={stats?.orphan ?? '—'}
          dataSource={stats ? 'live' : undefined}
        />
      </div>

      {/* 主体视图切换 */}
      <AdminCard style={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 }}>
        {/* 顶部 Tab */}
        <div style={{ display: 'flex', gap: '0', borderBottom: '1px solid var(--border-subtle)', padding: '0 16px' }}>
          <button type="button" style={tabStyle(activeTab === 'matrix')} onClick={() => setActiveTab('matrix')}>
            线路矩阵
          </button>
          <button type="button" style={tabStyle(activeTab === 'aliases')} onClick={() => setActiveTab('aliases')}>
            全局别名表
          </button>
        </div>

        {activeTab === 'aliases' ? (
          <div style={{ padding: '16px' }}>
            <SourceLineAliasPanel />
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
            {/* Segment tabs */}
            <div style={{ padding: '12px 16px 0' }}>
              <div style={TAB_BAR_STYLE}>
                {SEGMENTS.map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    style={tabStyle(segment === s.key)}
                    onClick={() => handleSegmentChange(s.key)}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* DataTable 一体化（P1-5）*/}
            {loading && rows.length === 0
              ? <div style={{ padding: '16px' }}><LoadingState variant="skeleton" skeletonRows={8} /></div>
              : error
                ? <div style={{ padding: '16px' }}><ErrorState error={error} onRetry={refresh} /></div>
                : (
                    <DataTable<VideoGroupRow>
                      rows={rows}
                      columns={columns}
                      rowKey={(r) => r.videoId}
                      mode="server"
                      query={query}
                      onQueryChange={(patch) => {
                        if (patch.pagination) {
                          if (patch.pagination.page !== undefined) setPage(patch.pagination.page)
                          if (patch.pagination.pageSize !== undefined) {
                            setPageSize(patch.pagination.pageSize)
                            setPage(1)
                          }
                        }
                        if (patch.sort) setSort(patch.sort)
                        if (patch.selection) setSelectedKeys(patch.selection.selectedKeys)
                      }}
                      totalRows={total}
                      loading={loading}
                      emptyState={
                        <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--fg-muted)' }}>
                          {keyword ? `未找到包含「${keyword}」的视频` : '当前分组暂无数据'}
                        </div>
                      }
                      selection={{ selectedKeys, mode: 'page' }}
                      onSelectionChange={(s) => setSelectedKeys(s.selectedKeys)}
                      onRowClick={handleRowClick}
                      expandedKeys={expandedKeys}
                      renderExpandedRow={(row) => <MatrixExpand videoId={row.videoId} />}
                      toolbar={{
                        search: toolbarSearch,
                        trailing: toolbarTrailing,
                        hideFilterChips: true,
                      }}
                      bulkActions={bulkActions}
                      pagination={{ pageSizeOptions: [20, 50, 100] }}
                      density="poster"
                    />
                  )
            }
          </div>
        )}
      </AdminCard>
    </div>
  )
}
