'use client'

/**
 * MessageCenterClient.tsx — `/admin/messages` 消息中心（全量历史 + 检索 + 过滤，ADR-196 D-196-4 / NTLG-P2-c-A-2）
 *
 * 范围：消费 A-1 扩展后的 GET /admin/notifications（cursor/q/level/since/until/readState + meta.nextCursor）。
 *
 * cursor-stack 适配 DataTable（用户裁定 2026-06-09）：DataTable 渲染表格保 admin UI 一致性 +
 *   隐藏内置 page pager（pagination hidden）+ 外置 AdminInput/AdminSelect 过滤驱动 server 取数 +
 *   cursor-stack prev/next（禁随机跳页，cursor 对 live 数据正确无跳行/重复）。
 *
 * 设计模式：Mode A 整页滚动（ADR-103 AMENDMENT 默认）。内联中文（同 audit 页范式）。
 */

import { useState, useEffect, useMemo, useCallback, type CSSProperties } from 'react'
import { useRouter } from 'next/navigation'
import {
  DataTable,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  AdminButton,
  AdminInput,
  AdminSelect,
} from '@resovo/admin-ui'
import type { AdminNotificationItem } from '@resovo/types'
import { listMessages } from '@/lib/messages/api'
import { buildMessageColumns } from './MessageColumns'

const PAGE_SIZE = 20

const PAGE_STYLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--section-gap)',
  padding: 'var(--page-padding-y) var(--page-padding-x) 0',
}
const FILTER_BAR_STYLE: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 'var(--space-3)',
  alignItems: 'center',
}
const PAGER_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  gap: 'var(--space-3)',
  padding: 'var(--space-2) 0',
}
const PAGER_TEXT_STYLE: CSSProperties = {
  color: 'var(--fg-muted)',
  fontSize: 'var(--font-size-xs)',
}

const LEVEL_OPTIONS = [
  { value: 'info', label: '信息' },
  { value: 'warn', label: '警告' },
  { value: 'danger', label: '严重' },
] as const
const READ_STATE_OPTIONS = [
  { value: 'unread', label: '未读' },
  { value: 'read', label: '已读' },
] as const

type LevelValue = 'info' | 'warn' | 'danger'
type ReadStateValue = 'read' | 'unread'

export function MessageCenterClient() {
  const router = useRouter()

  // 列表状态
  const [rows, setRows] = useState<readonly AdminNotificationItem[]>([])
  const [total, setTotal] = useState(0)
  const [readAt, setReadAt] = useState<string | null>(null)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [retryKey, setRetryKey] = useState(0)

  // 过滤状态（appliedQ 在 search 提交时应用，避免逐键取数）
  const [qInput, setQInput] = useState('')
  const [appliedQ, setAppliedQ] = useState('')
  const [level, setLevel] = useState<LevelValue | null>(null)
  const [readState, setReadState] = useState<ReadStateValue | null>(null)

  // cursor-stack：cursorStack[i]=第 i+1 页游标（首页 undefined）；当前页 = 末元素
  const [cursorStack, setCursorStack] = useState<(string | undefined)[]>([undefined])

  // 任意过滤变更 → 复位到首页（cursor 失效）
  const resetToFirstPage = useCallback(() => setCursorStack([undefined]), [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    const currentCursor = cursorStack[cursorStack.length - 1]
    listMessages({
      limit: PAGE_SIZE,
      ...(currentCursor != null && { cursor: currentCursor }),
      ...(appliedQ && { q: appliedQ }),
      ...(level != null && { level }),
      ...(readState != null && { readState }),
    })
      .then((res) => {
        if (cancelled) return
        setRows(res.data)
        setTotal(res.meta.total)
        setReadAt(res.meta.readAt)
        setNextCursor(res.meta.nextCursor)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(err instanceof Error ? err : new Error('加载失败'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [cursorStack, appliedQ, level, readState, retryKey])

  const refresh = useCallback(() => setRetryKey((k) => k + 1), [])

  const columns = useMemo(() => buildMessageColumns(readAt), [readAt])

  const handleRowClick = useCallback(
    (row: AdminNotificationItem) => {
      if (row.href) router.push(row.href)
    },
    [router],
  )

  const query = useMemo(
    () => ({
      pagination: { page: cursorStack.length, pageSize: PAGE_SIZE },
      sort: { field: 'createdAt', direction: 'desc' as const },
      filters: new Map(),
      columns: new Map(),
      selection: { selectedKeys: new Set<string>(), mode: 'page' as const },
    }),
    [cursorStack.length],
  )

  const pageNum = cursorStack.length
  const canPrev = cursorStack.length > 1
  const canNext = nextCursor != null

  return (
    <div data-message-center style={PAGE_STYLE}>
      <PageHeader
        title="消息中心"
        titleVisuallyHidden
        subtitle={`${total} 条记录`}
        actions={
          <AdminButton variant="default" size="sm" onClick={refresh} data-testid="messages-refresh">
            刷新
          </AdminButton>
        }
        data-testid="messages-page-header"
      />

      <form
        style={FILTER_BAR_STYLE}
        onSubmit={(e) => {
          e.preventDefault()
          setAppliedQ(qInput.trim())
          resetToFirstPage()
        }}
        data-testid="messages-filter-bar"
      >
        <AdminInput
          type="search"
          size="sm"
          value={qInput}
          onChange={(e) => setQInput(e.target.value)}
          placeholder="搜索标题（回车）…"
          data-testid="messages-search"
        />
        <AdminSelect
          value={level}
          onChange={(v) => {
            setLevel(v as LevelValue | null)
            resetToFirstPage()
          }}
          options={LEVEL_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
          placeholder="全部级别"
          data-testid="messages-level"
        />
        <AdminSelect
          value={readState}
          onChange={(v) => {
            setReadState(v as ReadStateValue | null)
            resetToFirstPage()
          }}
          options={READ_STATE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
          placeholder="全部状态"
          data-testid="messages-readstate"
        />
      </form>

      {loading && rows.length === 0 ? (
        <LoadingState variant="skeleton" />
      ) : error ? (
        <ErrorState error={error} title="加载失败" onRetry={refresh} />
      ) : (
        <>
          <DataTable<AdminNotificationItem>
            rows={rows}
            columns={columns}
            rowKey={(r) => r.id}
            mode="server"
            query={query}
            onQueryChange={() => {
              /* 分页/排序/过滤由外置控件 + cursor-stack 驱动；DataTable 内置 pager 隐藏（pagination.hidden） */
            }}
            totalRows={total}
            loading={loading}
            onRowClick={handleRowClick}
            emptyState={<EmptyState title="暂无消息" description="调整筛选条件后重试" />}
            data-testid="messages-table"
            pagination={{ hidden: true }}
          />
          <div style={PAGER_STYLE} data-testid="messages-pager">
            <span style={PAGER_TEXT_STYLE}>
              共 {total} 条 · 第 {pageNum} 页
            </span>
            <AdminButton
              variant="ghost"
              size="sm"
              disabled={!canPrev || loading}
              onClick={() => setCursorStack((s) => (s.length > 1 ? s.slice(0, -1) : s))}
              data-testid="messages-prev"
            >
              上一页
            </AdminButton>
            <AdminButton
              variant="ghost"
              size="sm"
              disabled={!canNext || loading}
              onClick={() => {
                if (nextCursor != null) setCursorStack((s) => [...s, nextCursor])
              }}
              data-testid="messages-next"
            >
              下一页
            </AdminButton>
          </div>
        </>
      )}
    </div>
  )
}
