'use client'

/**
 * UserSubmissionsClient.tsx — `/admin/user-submissions` 4 Segment + Card list 主视图
 *
 * 真源：ADR-124 + spec §5.13 + screens-3.jsx:415-454
 * 任务卡：CHG-SN-7-REDO-02-C
 *
 * 形态：
 *   - PageHeader title + subtitle（badges 聚合 4 计数）
 *   - Segment 4 类（消费 admin-ui Segment primitive / PRE-CARD-PRIMITIVE-A 落地）
 *     - 失效源举报（badge=badges.bad_source）
 *     - 求片（badge=badges.wish_list）
 *     - 元数据纠错（badge=badges.metadata_correction）
 *     - 已处理（badge=badges.processed）
 *   - Card list（消费 admin-ui AdminCard surface='plain' / spec §5.13 行形态）
 *
 * 不在范围（D 卡承担）：
 *   - 旧 /admin/submissions* alias 转发（D 卡）
 *   - 旧 SubmissionsListClient.tsx deprecation banner（D 卡）
 */

import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import {
  AdminButton,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  Segment,
  type SegmentItem,
} from '@resovo/admin-ui'
import { listUserSubmissions } from '@/lib/user-submissions/api'
import type {
  UserSubmissionListResp,
  UserSubmissionRow,
} from '@/lib/user-submissions/types'
import { ApiClientError } from '@/lib/api-client'
import { SubmissionCard } from './SubmissionCard'

const PAGE_STYLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--section-gap)',
  padding: 'var(--page-padding-y) var(--page-padding-x) 0',
}

const LIST_STYLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
}

const PAGINATION_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  paddingTop: '8px',
}

type SegmentValue = 'bad_source' | 'wish_list' | 'metadata_correction' | 'processed'

function typeForSegment(seg: SegmentValue): 'bad_source' | 'wish_list' | 'metadata_correction' | 'all' {
  return seg === 'processed' ? 'all' : seg
}

const PAGE_LIMIT = 20

export function UserSubmissionsClient() {
  const [segment, setSegment] = useState<SegmentValue>('bad_source')
  const [page, setPage] = useState(1)
  const [data, setData] = useState<UserSubmissionListResp | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [retryKey, setRetryKey] = useState(0)

  // ── data fetch ───────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    listUserSubmissions({
      page,
      limit: PAGE_LIMIT,
      type: typeForSegment(segment),
      // CHG-SN-7-MISC-USER-SUBMISSIONS-PROCESSED-FILTER：
      // segment='processed' → 后端 status='processed_or_rejected' 一次性筛出（修复分页失真 / 移除客户端 filter）
      status: segment === 'processed' ? 'processed_or_rejected' : 'pending',
    })
      .then((res) => {
        if (cancelled) return
        setData(res)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(err instanceof ApiClientError ? new Error(err.message) : err instanceof Error ? err : new Error('加载失败'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [segment, page, retryKey])

  const refresh = useCallback(() => setRetryKey((k) => k + 1), [])

  const handleSegmentChange = useCallback((next: string) => {
    setSegment(next as SegmentValue)
    setPage(1)
  }, [])

  const handleProcessed = useCallback((id: string) => {
    setData((prev) =>
      prev ? { ...prev, data: prev.data.filter((r) => r.id !== id) } : prev,
    )
  }, [])

  const badges = data?.meta.badges
  const totalPending = badges
    ? badges.bad_source + badges.wish_list + badges.metadata_correction
    : 0

  // Segment items 4 类（带 badge count / spec §5.13）
  const segmentItems: readonly SegmentItem[] = [
    { value: 'bad_source', label: '失效源举报', badge: badges?.bad_source ?? 0 },
    { value: 'wish_list', label: '求片', badge: badges?.wish_list ?? 0 },
    { value: 'metadata_correction', label: '元数据纠错', badge: badges?.metadata_correction ?? 0 },
    { value: 'processed', label: '已处理', badge: badges?.processed ?? 0 },
  ]

  return (
    <div data-user-submissions-client style={PAGE_STYLE}>
      <PageHeader
        title="用户投稿 / 纠错"
        subtitle={
          loading && !data
            ? '加载中…'
            : `${totalPending} 条待处理 · 用户报错的失效源、找不到的视频、错误元数据`
        }
        data-testid="user-submissions-page-header"
      />

      <Segment
        items={segmentItems}
        value={segment}
        onChange={handleSegmentChange}
        aria-label="投稿分类筛选"
        data-testid="user-submissions-segment"
      />

      {loading && !data ? (
        <LoadingState variant="skeleton" skeletonRows={6} />
      ) : error ? (
        <ErrorState error={error} title="加载投稿失败" onRetry={refresh} />
      ) : !data || data.data.length === 0 ? (
        <EmptyState
          title={segment === 'processed' ? '暂无已处理投稿' : '暂无待处理投稿'}
          description={
            segment === 'bad_source'
              ? '当前无用户报告的失效源'
              : segment === 'wish_list'
                ? '当前无用户求片请求'
                : segment === 'metadata_correction'
                  ? '当前无元数据纠错请求'
                  : '历史处理记录为空'
          }
        />
      ) : (
        <>
          <div style={LIST_STYLE} data-submissions-list>
            {data.data.map((row: UserSubmissionRow) => (
              <SubmissionCard key={row.id} row={row} onProcessed={handleProcessed} />
            ))}
          </div>
          {data.meta.total > PAGE_LIMIT && (
            <div style={PAGINATION_STYLE} data-submissions-pagination data-testid="submissions-pagination">
              <AdminButton
                size="sm"
                variant="default"
                disabled={page <= 1 || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                data-testid="submissions-prev-page"
              >
                上一页
              </AdminButton>
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--fg-muted)' }}>
                {page} / {Math.ceil(data.meta.total / PAGE_LIMIT)}
              </span>
              <AdminButton
                size="sm"
                variant="default"
                disabled={page * PAGE_LIMIT >= data.meta.total || loading}
                onClick={() => setPage((p) => p + 1)}
                data-testid="submissions-next-page"
              >
                下一页
              </AdminButton>
            </div>
          )}
        </>
      )}
    </div>
  )
}
