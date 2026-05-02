'use client'

/**
 * line-health-drawer.tsx — LineHealthDrawer 共享组件实装（CHG-SN-4-04 D-14 第 2 件）
 *
 * 真源：line-health-drawer.types.ts（arch-reviewer Opus 2 轮 PASS 契约）
 *
 * 实装契约（契约一致性硬约束）：
 *   - 包壳 admin-ui Drawer 原语（placement="right"，默认 width=480）
 *   - 头部聚合状态用 BarSignal（probe/render 双柱）
 *   - body 状态切换：error → ErrorState；loading → LoadingState；空 → EmptyState；否则 events list + pagination
 *   - events 排序由调用方负责（contract 不在内部排序）
 *   - 颜色仅消费 design-tokens（CSS 变量）；零硬编码 hex
 *   - 不下沉 i18n：emptyText / loadingText / 头部文案 slot
 *
 * 固定 data attribute：
 *   - data-line-health-drawer 挂在 body 容器
 *   - data-line-health-event 挂在每条 event item
 *   - testId 透传到 Drawer data-testid
 */
import React from 'react'
import type { SourceHealthEvent } from '@resovo/types'
import { Drawer } from '../overlay'
import { BarSignal } from '../cell/bar-signal'
import { EmptyState, LoadingState, ErrorState } from '../state'
import type { LineHealthDrawerProps } from './line-health-drawer.types'

const DEFAULT_EMPTY_TEXT = '暂无健康事件记录'
const DEFAULT_LOADING_TEXT = '加载中…'

const HEADER_AGGREGATE_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  padding: '16px 0',
  borderBottom: '1px solid var(--border-subtle)',
  marginBottom: '12px',
}

const HEADER_LABEL_STYLE: React.CSSProperties = {
  fontSize: '12px',
  color: 'var(--fg-muted)',
}

const EVENT_LIST_STYLE: React.CSSProperties = {
  listStyle: 'none',
  padding: 0,
  margin: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
}

const EVENT_ITEM_STYLE: React.CSSProperties = {
  padding: '10px 12px',
  border: '1px solid var(--border-subtle)',
  borderRadius: 'var(--radius-md)',
  background: 'var(--bg-surface)',
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
}

const EVENT_HEADER_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '8px',
  fontSize: '12px',
}

const EVENT_TIME_STYLE: React.CSSProperties = {
  color: 'var(--fg-muted)',
  fontVariantNumeric: 'tabular-nums',
}

const EVENT_ORIGIN_STYLE: React.CSSProperties = {
  fontWeight: 600,
  color: 'var(--fg-default)',
}

const EVENT_META_STYLE: React.CSSProperties = {
  display: 'flex',
  gap: '12px',
  fontSize: '12px',
  color: 'var(--fg-muted)',
}

const EVENT_ERROR_STYLE: React.CSSProperties = {
  fontSize: '12px',
  color: 'var(--state-error-fg)',
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
}

const PAGINATION_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '8px',
  marginTop: '16px',
  paddingTop: '12px',
  borderTop: '1px solid var(--border-subtle)',
  fontSize: '12px',
  color: 'var(--fg-muted)',
}

const PAGE_BUTTON_STYLE: React.CSSProperties = {
  padding: '4px 10px',
  fontSize: '12px',
  border: '1px solid var(--border-subtle)',
  borderRadius: 'var(--radius-sm)',
  background: 'transparent',
  color: 'var(--fg-default)',
  cursor: 'pointer',
}

export function LineHealthDrawer({
  open,
  onClose,
  title,
  probeState,
  renderState,
  events,
  loading,
  error,
  pagination,
  emptyText,
  loadingText,
  testId,
}: LineHealthDrawerProps): React.ReactElement {
  return (
    <Drawer open={open} placement="right" onClose={onClose} title={title} data-testid={testId}>
      <div data-line-health-drawer>
        <div style={HEADER_AGGREGATE_STYLE}>
          <BarSignal probeState={probeState} renderState={renderState} size="md" />
          <span style={HEADER_LABEL_STYLE}>当前聚合状态</span>
        </div>

        {error
          ? renderError(error)
          : loading
            ? renderLoading(loadingText ?? DEFAULT_LOADING_TEXT)
            : events.length === 0
              ? renderEmpty(emptyText ?? DEFAULT_EMPTY_TEXT)
              : renderEvents(events, pagination)}
      </div>
    </Drawer>
  )
}

function renderError(error: NonNullable<LineHealthDrawerProps['error']>): React.ReactElement {
  return (
    <div data-line-health-error>
      <ErrorState error={new Error(error.message)} onRetry={error.onRetry} />
    </div>
  )
}

function renderLoading(label: string): React.ReactElement {
  return (
    <div data-line-health-loading>
      <LoadingState label={label} />
    </div>
  )
}

function renderEmpty(label: string): React.ReactElement {
  return (
    <div data-line-health-empty>
      <EmptyState title={label} />
    </div>
  )
}

function renderEvents(
  events: readonly SourceHealthEvent[],
  pagination: LineHealthDrawerProps['pagination'],
): React.ReactElement {
  return (
    <>
      <ul style={EVENT_LIST_STYLE} data-line-health-list>
        {events.map((event) => (
          <EventItem key={event.id} event={event} />
        ))}
      </ul>
      {pagination && <PaginationBar pagination={pagination} />}
    </>
  )
}

function EventItem({ event }: { readonly event: SourceHealthEvent }): React.ReactElement {
  return (
    <li
      style={EVENT_ITEM_STYLE}
      data-line-health-event
      data-line-health-event-origin={event.origin}
    >
      <div style={EVENT_HEADER_STYLE}>
        <span style={EVENT_ORIGIN_STYLE}>{event.origin}</span>
        <time style={EVENT_TIME_STYLE} dateTime={event.createdAt}>
          {event.createdAt}
        </time>
      </div>
      {(event.httpCode != null || event.latencyMs != null) && (
        <div style={EVENT_META_STYLE}>
          {event.httpCode != null && <span data-line-health-event-http>HTTP {event.httpCode}</span>}
          {event.latencyMs != null && <span data-line-health-event-latency>{event.latencyMs} ms</span>}
        </div>
      )}
      {event.errorDetail && (
        <div style={EVENT_ERROR_STYLE} data-line-health-event-detail>
          {event.errorDetail}
        </div>
      )}
    </li>
  )
}

function PaginationBar({
  pagination,
}: {
  readonly pagination: NonNullable<LineHealthDrawerProps['pagination']>
}): React.ReactElement {
  const { page, total, limit, onPageChange } = pagination
  const totalPages = Math.max(1, Math.ceil(total / limit))
  const canPrev = page > 1
  const canNext = page < totalPages

  return (
    <div style={PAGINATION_STYLE} data-line-health-pagination>
      <span data-line-health-pagination-summary>
        {page} / {totalPages}（共 {total} 条）
      </span>
      <span style={{ display: 'inline-flex', gap: '6px' }}>
        <button
          type="button"
          data-line-health-pagination-prev
          disabled={!canPrev}
          onClick={() => onPageChange(page - 1)}
          style={PAGE_BUTTON_STYLE}
        >
          上一页
        </button>
        <button
          type="button"
          data-line-health-pagination-next
          disabled={!canNext}
          onClick={() => onPageChange(page + 1)}
          style={PAGE_BUTTON_STYLE}
        >
          下一页
        </button>
      </span>
    </div>
  )
}
