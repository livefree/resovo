'use client'

/**
 * SourcesClient.tsx — `/admin/sources` 播放线路管理主组件（CHG-SN-5-11）
 *
 * 范围：KPI 4 卡 + Segment 4 tabs + 可展开视频分组表格 + 全局别名面板
 * 端点：apps/api/src/routes/admin/sources-matrix.ts（CHG-SN-5-11）
 *
 * 原语消费：PageHeader / AdminButton / AdminCard / AdminInput / KpiCard /
 *           LoadingState / ErrorState / EmptyState / useToast
 */

import { useState, useEffect, useCallback, type CSSProperties } from 'react'
import {
  PageHeader,
  AdminButton,
  AdminCard,
  AdminInput,
  KpiCard,
  LoadingState,
  ErrorState,
  EmptyState,
} from '@resovo/admin-ui'
import type { VideoGroupRow, VideoGroupStats, SourceSegment } from '@/lib/sources/types'
import { listVideoGroups, getVideoGroupStats } from '@/lib/sources/api'
import { SourceMatrixRow } from './SourceMatrixRow'
import { SourceLineAliasPanel } from './SourceLineAliasPanel'

// ── 常量 ─────────────────────────────────────────────────────────

const SEGMENTS: readonly { key: SourceSegment; label: string }[] = [
  { key: 'grouped',    label: '按视频分组' },
  { key: 'dead',       label: '仅失效' },
  { key: 'correction', label: '用户纠错' },
  { key: 'orphan',     label: '孤岛源' },
]

const PAGE_LIMIT = 20

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

const TABLE_HEADER_STYLE: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '40px minmax(200px, 1fr) 80px 90px 100px 100px 80px 100px',
  alignItems: 'center',
  height: '36px',
  borderBottom: '2px solid var(--border-default)',
  background: 'var(--bg-surface-elevated)',
  position: 'sticky',
  top: 0,
  zIndex: 1,
}

const TH_STYLE: CSSProperties = {
  padding: '0 12px',
  fontSize: '11px',
  fontWeight: 600,
  color: 'var(--fg-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}

const PAGER_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '12px 0',
  fontSize: 'var(--font-size-sm)',
  color: 'var(--fg-muted)',
}

// ── 主组件 ────────────────────────────────────────────────────────

export function SourcesClient() {
  const [segment, setSegment] = useState<SourceSegment>('grouped')
  const [keyword, setKeyword] = useState('')
  const [page, setPage] = useState(1)

  const [stats, setStats] = useState<VideoGroupStats | null>(null)
  const [rows, setRows] = useState<VideoGroupRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(new Set())

  const [activeTab, setActiveTab] = useState<'matrix' | 'aliases'>('matrix')

  // KPI stats（独立请求，只加载一次）
  useEffect(() => {
    getVideoGroupStats().then(setStats).catch(() => null)
  }, [])

  const loadRows = useCallback(() => {
    setLoading(true)
    setError(null)
    listVideoGroups({ page, limit: PAGE_LIMIT, keyword: keyword || undefined, segment })
      .then((res) => {
        setRows(res.data as VideoGroupRow[])
        setTotal(res.total)
      })
      .catch((e: unknown) => setError(e instanceof Error ? e : new Error('加载失败')))
      .finally(() => setLoading(false))
  }, [page, keyword, segment])

  useEffect(() => {
    loadRows()
  }, [loadRows])

  // segment 切换重置页码
  function handleSegmentChange(seg: SourceSegment) {
    setSegment(seg)
    setPage(1)
    setSelectedIds(new Set())
  }

  // 搜索 — 防抖效果由调用时机控制（回车 / 清空立即触发）
  function handleKeywordKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      setPage(1)
      setSelectedIds(new Set())
    }
  }

  function handleSelect(id: string, checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  function handleSelectAll(checked: boolean) {
    setSelectedIds(checked ? new Set(rows.map((r) => r.videoId)) : new Set())
  }

  const totalPages = Math.ceil(total / PAGE_LIMIT)

  return (
    <div style={PAGE_STYLE}>
      {/* 顶栏 */}
      <PageHeader
        title="播放线路"
        actions={
          <div style={{ display: 'flex', gap: '8px' }}>
            <AdminButton size="sm" variant="secondary">批量验证</AdminButton>
            <AdminButton size="sm" variant="primary">一键替换最相似 URL</AdminButton>
          </div>
        }
      />

      {/* KPI 卡片 */}
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
          label="孤岛 / 用户纠错"
          variant="is-warn"
          value={stats?.orphan ?? '—'}
          dataSource={stats ? 'live' : undefined}
        />
      </div>

      {/* 主体视图切换 */}
      <AdminCard style={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 }}>
        {/* 顶部 Tab */}
        <div style={{ display: 'flex', gap: '0', borderBottom: '1px solid var(--border-subtle)', padding: '0 16px' }}>
          <button
            type="button"
            style={tabStyle(activeTab === 'matrix')}
            onClick={() => setActiveTab('matrix')}
          >
            线路矩阵
          </button>
          <button
            type="button"
            style={tabStyle(activeTab === 'aliases')}
            onClick={() => setActiveTab('aliases')}
          >
            全局别名表
          </button>
        </div>

        {activeTab === 'aliases' ? (
          <div style={{ padding: '16px' }}>
            <SourceLineAliasPanel />
          </div>
        ) : (
          <>
            {/* Segment tabs */}
            <div style={{ padding: '12px 16px 0', display: 'flex', flexDirection: 'column', gap: '12px' }}>
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
              {/* 搜索栏 */}
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <AdminInput
                  type="search"
                  placeholder="搜索视频名称…"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  onKeyDown={handleKeywordKeyDown}
                  style={{ width: '260px' }}
                  size="sm"
                />
                {keyword && (
                  <AdminButton
                    size="sm"
                    variant="ghost"
                    onClick={() => { setKeyword(''); setPage(1) }}
                  >
                    清除
                  </AdminButton>
                )}
                <span style={{ fontSize: '12px', color: 'var(--fg-muted)', marginLeft: 'auto' }}>
                  共 {total} 条
                </span>
              </div>
            </div>

            {/* 表格区 */}
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '0 16px' }}>
              {/* 表头 */}
              <div style={TABLE_HEADER_STYLE}>
                <div style={{ ...TH_STYLE, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <input
                    type="checkbox"
                    checked={rows.length > 0 && selectedIds.size === rows.length}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    aria-label="全选"
                  />
                </div>
                <div style={TH_STYLE}>视频</div>
                <div style={TH_STYLE}>线路</div>
                <div style={TH_STYLE}>集·源</div>
                <div style={TH_STYLE}>探测</div>
                <div style={TH_STYLE}>播放</div>
                <div style={TH_STYLE}>更新</div>
                <div style={TH_STYLE}>操作</div>
              </div>

              {/* 内容区 */}
              {loading ? (
                <LoadingState variant="skeleton" skeletonRows={8} />
              ) : error ? (
                <ErrorState error={error} onRetry={loadRows} />
              ) : rows.length === 0 ? (
                <EmptyState
                  title="无匹配数据"
                  description={keyword ? `未找到包含「${keyword}」的视频` : '当前分组暂无数据'}
                />
              ) : (
                rows.map((row) => (
                  <SourceMatrixRow
                    key={row.videoId}
                    row={row}
                    selected={selectedIds.has(row.videoId)}
                    onSelect={handleSelect}
                  />
                ))
              )}
            </div>

            {/* 分页 */}
            {!loading && rows.length > 0 && (
              <div style={{ ...PAGER_STYLE, padding: '12px 16px' }}>
                <span>第 {page} / {totalPages} 页，共 {total} 条</span>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <AdminButton
                    size="sm"
                    variant="ghost"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    上一页
                  </AdminButton>
                  <AdminButton
                    size="sm"
                    variant="ghost"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  >
                    下一页
                  </AdminButton>
                </div>
              </div>
            )}
          </>
        )}
      </AdminCard>
    </div>
  )
}
