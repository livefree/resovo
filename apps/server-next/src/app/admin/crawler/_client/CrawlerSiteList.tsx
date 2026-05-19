'use client'

/**
 * CrawlerSiteList.tsx — 采集页站点列表（DataTable v2 骨架）
 *
 * 真源：M-SN-7-redo-01-contract.md §1.3
 *
 * REDO-01-C 范围：
 *   - DataTable v2 mode="client" + 9 列骨架 + toolbar.search + client-mode 分页
 *   - 三态（loading / error / empty）
 *
 * 不在范围（后续子卡）：
 *   - expandedKeys + renderExpandedRow（REDO-01-E 线路 sub-table / REDO-01-F 分类映射）
 *   - 行级操作回调真实接入（REDO-01-D / REDO-01-G）
 *   - selection 列（contract §2.2 裁决 A：删除批量动作）
 */

import { useMemo, useState, type CSSProperties } from 'react'
import {
  AdminInput,
  DataTable,
  EmptyState,
  ErrorState,
  LoadingState,
  type TableQuerySnapshot,
} from '@resovo/admin-ui'
import type { CrawlerSite, CrawlerSiteStat } from '@/lib/crawler/api'
import {
  buildCrawlerSiteColumnsV2,
  type CrawlerSiteColumnsCallbacks,
} from './crawler-site-columns-v2'

const WRAPPER_STYLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  minHeight: '240px',
}

export interface CrawlerSiteListProps {
  readonly sites: readonly CrawlerSite[]
  readonly loading: boolean
  readonly error: Error | null
  readonly siteStats?: ReadonlyMap<string, CrawlerSiteStat>
  readonly onRefresh: () => void
  readonly onRowClick?: (site: CrawlerSite) => void
}

export function CrawlerSiteList({
  sites,
  loading,
  error,
  siteStats,
  onRefresh,
  onRowClick,
}: CrawlerSiteListProps) {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)

  const filteredSites = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    if (!keyword) return sites
    return sites.filter(
      (s) =>
        s.key.toLowerCase().includes(keyword) ||
        s.name.toLowerCase().includes(keyword) ||
        (s.displayName?.toLowerCase().includes(keyword) ?? false),
    )
  }, [sites, search])

  const columnsCallbacks: CrawlerSiteColumnsCallbacks = useMemo(
    () => ({ siteStats }),
    [siteStats],
  )

  const columns = useMemo(
    () => buildCrawlerSiteColumnsV2(columnsCallbacks),
    [columnsCallbacks],
  )

  const query: TableQuerySnapshot = useMemo(
    () => ({
      pagination: { page, pageSize },
      sort: { field: undefined, direction: 'desc' as const },
      filters: new Map(),
      columns: new Map(),
      selection: { selectedKeys: new Set<string>(), mode: 'page' },
    }),
    [page, pageSize],
  )

  if (loading && sites.length === 0) {
    return (
      <div style={WRAPPER_STYLE} data-testid="crawler-site-list-loading">
        <LoadingState variant="skeleton" skeletonRows={6} />
      </div>
    )
  }

  if (error) {
    return (
      <div style={WRAPPER_STYLE} data-testid="crawler-site-list-error">
        <ErrorState error={error} title="加载站点失败" onRetry={onRefresh} />
      </div>
    )
  }

  return (
    <div style={WRAPPER_STYLE} data-testid="crawler-site-list">
      <DataTable<CrawlerSite>
        rows={filteredSites}
        columns={columns}
        rowKey={(r) => r.key}
        mode="client"
        query={query}
        onQueryChange={(patch) => {
          if (patch.pagination) {
            if (patch.pagination.page !== undefined) setPage(patch.pagination.page)
            if (patch.pagination.pageSize !== undefined) {
              setPageSize(patch.pagination.pageSize)
              setPage(1)
            }
          }
        }}
        onRowClick={onRowClick}
        loading={loading}
        toolbar={{
          search: (
            <AdminInput
              size="sm"
              placeholder="搜索站点 key / 名称"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              data-testid="crawler-site-search"
            />
          ),
        }}
        pagination={{ pageSizeOptions: [25, 50, 100] }}
        emptyState={
          <EmptyState
            title={search ? '无匹配站点' : '暂无站点'}
            description={search ? '尝试调整搜索关键词' : '点击「+ 新增站点」创建首个采集源'}
          />
        }
        data-testid="crawler-site-table"
      />
    </div>
  )
}
