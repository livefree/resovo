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
  Modal,
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
  // CHG-SN-5-13-PATCH-2：删 height:100% / minHeight:0；让 AdminShell main `overflow: auto` 整页滚动
  // 底部 padding-y 撑出 pagination footer 可达
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--section-gap)',
  padding: 'var(--page-padding-y) var(--page-padding-x)',
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
  // CHG-SN-5-13-PATCH-2：删 `font: 'inherit'` shorthand（与 fontWeight longhand 冲突；React 警告）
  return {
    padding: '8px 16px',
    fontSize: 'var(--font-size-sm)',
    fontFamily: 'inherit',
    fontWeight: active ? 600 : 400,
    color: active ? 'var(--fg-default)' : 'var(--fg-muted)',
    background: 'none',
    borderTop: 'none',
    borderLeft: 'none',
    borderRight: 'none',
    borderBottom: active ? '2px solid var(--accent-default)' : '2px solid transparent',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
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
  // CHG-SN-8-FUP-SOURCES-DEAD-BTN：「一键替换最相似 URL」筹备中说明 Modal
  const [replaceTipOpen, setReplaceTipOpen] = useState(false)
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
          <AdminButton
            size="sm"
            variant="primary"
            onClick={() => setReplaceTipOpen(true)}
            data-testid="sources-replace-similar-btn"
          >
            一键替换最相似 URL
          </AdminButton>
        }
      />

      {/* CHG-SN-8-FUP-SOURCES-DEAD-BTN：功能筹备中提示 + 替代路径 */}
      <Modal
        open={replaceTipOpen}
        onClose={() => setReplaceTipOpen(false)}
        title="批量一键替换 URL · 筹备中"
        size="sm"
        data-testid="sources-replace-tip-modal"
      >
        <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--fg-default)', lineHeight: 1.6 }}>
          <p style={{ marginTop: 0 }}>
            该功能的预期行为：扫描全部失效线路 → 在同一视频内寻找与失效 URL <strong>最相似</strong>的活跃 URL → 自动替换。
          </p>
          <p>
            <strong>当前未实装</strong>（涉及 URL 相似度算法 + 批量改写 + audit + 回滚；在 M-SN-N 安排实施 ADR 起草）。
          </p>
          <p style={{ marginBottom: 0 }}>
            <strong>当前替代路径</strong>：
          </p>
          <ul style={{ margin: '6px 0 0 0', paddingLeft: 20 }}>
            <li>在「按视频分组」segment 选某视频 → 展开行 → 「线路矩阵」逐条线路操作（重测 / 替换 / 删除）</li>
            <li>失效线路批量处理 → 行级「全失效」筛选 + 批量删除（如有该 segment）</li>
            <li>若需要算法替换：登记需求至 follow-up CHG-SN-8-FUP-SOURCES-REPLACE-ADR</li>
          </ul>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--border-subtle)' }}>
          <AdminButton
            size="sm"
            variant="primary"
            onClick={() => setReplaceTipOpen(false)}
            data-testid="sources-replace-tip-dismiss"
          >
            我知道了
          </AdminButton>
        </div>
      </Modal>

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

      {/* 主体视图切换（自然高度；main 整页滚动）*/}
      <AdminCard style={{ display: 'flex', flexDirection: 'column' }}>
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
          <div style={{ display: 'flex', flexDirection: 'column' }}>
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

            {/* DataTable 一体化（P1-5）— main 整页滚动模式（body 独立滚动留 M-SN-6 增强）*/}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
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
          </div>
        )}
      </AdminCard>
    </div>
  )
}
