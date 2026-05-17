'use client'

/**
 * TaskLogsDrawer.tsx — task 详情 + 日志 Drawer（CHG-SN-6-18）
 *
 * 消费：
 *   GET /admin/crawler/tasks/:id        — 详情含 siteBreakdown + runContext
 *   GET /admin/crawler/tasks/:id/logs   — 日志列表
 */

import React, { useEffect, useState, type CSSProperties } from 'react'
import {
  Drawer,
  AdminCard,
  AdminButton,
  CodeText,
  EmptyState,
  ErrorState,
  LoadingState,
} from '@resovo/admin-ui'
import {
  getCrawlerTaskDetail,
  listCrawlerTaskLogs,
  type CrawlerTaskDetailDto,
  type CrawlerTaskLog,
  type CrawlerTaskLogLevel,
} from '@/lib/crawler/api'

const BODY_STYLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '14px',
}

const META_GRID_STYLE: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
  gap: '10px',
}

const META_ITEM_STYLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '2px',
}

const META_LABEL_STYLE: CSSProperties = {
  fontSize: 'var(--font-size-xs)',
  color: 'var(--fg-muted)',
}

const META_VALUE_STYLE: CSSProperties = {
  fontSize: 'var(--font-size-sm)',
  color: 'var(--fg-default)',
}

const LOGS_LIST_STYLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
  maxHeight: '50vh',
  overflow: 'auto',
}

const LOG_ROW_STYLE: CSSProperties = {
  display: 'flex',
  gap: '10px',
  alignItems: 'flex-start',
  padding: '6px 8px',
  borderRadius: 'var(--radius-sm, 4px)',
  borderLeft: '3px solid transparent',
}

const LOG_LEVEL_BADGE: Record<CrawlerTaskLogLevel, { bg: string; color: string; border: string }> = {
  info:  { bg: 'var(--state-info-bg)',    color: 'var(--state-info-fg)',    border: 'var(--state-info-fg)' },
  warn:  { bg: 'var(--state-warning-bg)', color: 'var(--state-warning-fg)', border: 'var(--state-warning-fg)' },
  error: { bg: 'var(--state-danger-bg)',  color: 'var(--state-danger-fg)',  border: 'var(--state-danger-fg)' },
}

function formatTime(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('zh-CN', { hour12: false })
}

export interface TaskLogsDrawerProps {
  readonly open: boolean
  readonly taskId: string | null
  readonly onClose: () => void
}

export function TaskLogsDrawer({ open, taskId, onClose }: TaskLogsDrawerProps) {
  const [detail, setDetail] = useState<CrawlerTaskDetailDto | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<Error | null>(null)

  const [logs, setLogs] = useState<readonly CrawlerTaskLog[]>([])
  const [logsLoading, setLogsLoading] = useState(false)
  const [logsError, setLogsError] = useState<Error | null>(null)

  const [retryKey, setRetryKey] = useState(0)

  useEffect(() => {
    if (!open || !taskId) return
    let cancelled = false
    setDetail(null)
    setDetailLoading(true)
    setDetailError(null)
    getCrawlerTaskDetail(taskId)
      .then((d) => { if (!cancelled) setDetail(d) })
      .catch((err: unknown) => {
        if (!cancelled) setDetailError(err instanceof Error ? err : new Error('详情加载失败'))
      })
      .finally(() => { if (!cancelled) setDetailLoading(false) })
    return () => { cancelled = true }
  }, [open, taskId, retryKey])

  useEffect(() => {
    if (!open || !taskId) return
    let cancelled = false
    setLogs([])
    setLogsLoading(true)
    setLogsError(null)
    listCrawlerTaskLogs(taskId, { limit: 200 })
      .then((rows) => { if (!cancelled) setLogs(rows) })
      .catch((err: unknown) => {
        if (!cancelled) setLogsError(err instanceof Error ? err : new Error('日志加载失败'))
      })
      .finally(() => { if (!cancelled) setLogsLoading(false) })
    return () => { cancelled = true }
  }, [open, taskId, retryKey])

  const refresh = () => setRetryKey((k) => k + 1)

  return (
    <Drawer
      open={open}
      onClose={onClose}
      placement="right"
      width={560}
      title={taskId ? `任务 ${taskId.slice(0, 8)}…` : '任务'}
      data-testid="task-logs-drawer"
    >
      <div style={BODY_STYLE} data-task-logs-body>
        {/* 详情卡 */}
        {detailLoading && !detail ? (
          <LoadingState variant="skeleton" />
        ) : detailError ? (
          <ErrorState error={detailError} title="详情加载失败" onRetry={refresh} />
        ) : detail ? (
          <AdminCard
            surface="elevated"
            padding="md"
            header={{
              title: '任务详情',
              actions: (
                <AdminButton variant="ghost" size="sm" onClick={refresh} data-testid="task-detail-refresh">
                  刷新
                </AdminButton>
              ),
            }}
            data-testid="task-detail-card"
          >
            <div style={META_GRID_STYLE}>
              <div style={META_ITEM_STYLE}>
                <span style={META_LABEL_STYLE}>站点</span>
                <CodeText value={detail.siteKey} />
              </div>
              <div style={META_ITEM_STYLE}>
                <span style={META_LABEL_STYLE}>模式</span>
                <span style={META_VALUE_STYLE} data-task-mode={detail.mode}>
                  {detail.mode === 'incremental' ? '增量' : '全量'}
                </span>
              </div>
              <div style={META_ITEM_STYLE}>
                <span style={META_LABEL_STYLE}>状态</span>
                <span style={META_VALUE_STYLE} data-task-status={detail.status}>{detail.status}</span>
              </div>
              <div style={META_ITEM_STYLE}>
                <span style={META_LABEL_STYLE}>开始</span>
                <span style={META_VALUE_STYLE}>{formatTime(detail.startedAt)}</span>
              </div>
              <div style={META_ITEM_STYLE}>
                <span style={META_LABEL_STYLE}>结束</span>
                <span style={META_VALUE_STYLE}>{formatTime(detail.finishedAt)}</span>
              </div>
              <div style={META_ITEM_STYLE}>
                <span style={META_LABEL_STYLE}>产出条目</span>
                <span style={META_VALUE_STYLE} data-task-item-count>
                  {detail.itemCount ?? '—'}
                </span>
              </div>
            </div>

            <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px dashed var(--border-subtle)' }}>
              <div style={{ ...META_LABEL_STYLE, marginBottom: '6px' }}>站点细分</div>
              <div style={META_GRID_STYLE} data-task-site-breakdown>
                <div style={META_ITEM_STYLE}>
                  <span style={META_LABEL_STYLE}>videos</span>
                  <span style={META_VALUE_STYLE}>{detail.siteBreakdown.videosUpserted}</span>
                </div>
                <div style={META_ITEM_STYLE}>
                  <span style={META_LABEL_STYLE}>sources upserted</span>
                  <span style={META_VALUE_STYLE}>{detail.siteBreakdown.sourcesUpserted}</span>
                </div>
                <div style={META_ITEM_STYLE}>
                  <span style={META_LABEL_STYLE}>sources kept</span>
                  <span style={META_VALUE_STYLE}>{detail.siteBreakdown.sourcesKept}</span>
                </div>
                <div style={META_ITEM_STYLE}>
                  <span style={META_LABEL_STYLE}>sources removed</span>
                  <span style={META_VALUE_STYLE}>{detail.siteBreakdown.sourcesRemoved}</span>
                </div>
                <div style={META_ITEM_STYLE}>
                  <span style={META_LABEL_STYLE}>errors</span>
                  <span style={META_VALUE_STYLE}>{detail.siteBreakdown.errors}</span>
                </div>
              </div>
            </div>

            {detail.runContext ? (
              <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px dashed var(--border-subtle)' }}>
                <div style={{ ...META_LABEL_STYLE, marginBottom: '6px' }}>运行上下文</div>
                <div style={META_GRID_STYLE} data-task-run-context>
                  <div style={META_ITEM_STYLE}>
                    <span style={META_LABEL_STYLE}>crawlMode</span>
                    <CodeText value={detail.runContext.crawlMode} />
                  </div>
                  {detail.runContext.keyword ? (
                    <div style={META_ITEM_STYLE}>
                      <span style={META_LABEL_STYLE}>keyword</span>
                      <CodeText value={detail.runContext.keyword} />
                    </div>
                  ) : null}
                  {detail.runContext.targetVideoId ? (
                    <div style={META_ITEM_STYLE}>
                      <span style={META_LABEL_STYLE}>targetVideoId</span>
                      <CodeText value={detail.runContext.targetVideoId} />
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}

            {detail.message ? (
              <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px dashed var(--border-subtle)' }}>
                <div style={{ ...META_LABEL_STYLE, marginBottom: '6px' }}>错误消息</div>
                <div
                  style={{
                    ...META_VALUE_STYLE,
                    color: 'var(--state-danger-fg)',
                    background: 'var(--state-danger-bg)',
                    padding: '6px 8px',
                    borderRadius: 'var(--radius-sm, 4px)',
                  }}
                  data-task-error-message
                >
                  {detail.message}
                </div>
              </div>
            ) : null}
          </AdminCard>
        ) : null}

        {/* 日志卡 */}
        <AdminCard
          surface="elevated"
          padding="md"
          header={{ title: `日志（${logs.length}）` }}
          data-testid="task-logs-card"
        >
          {logsLoading && logs.length === 0 ? (
            <LoadingState variant="skeleton" />
          ) : logsError ? (
            <ErrorState error={logsError} title="日志加载失败" onRetry={refresh} />
          ) : logs.length === 0 ? (
            <EmptyState title="暂无日志" description="该任务未产生日志记录" />
          ) : (
            <div style={LOGS_LIST_STYLE} role="list" data-testid="task-logs-list">
              {logs.map((log) => {
                const cfg = LOG_LEVEL_BADGE[log.level]
                return (
                  <div
                    key={log.id}
                    role="listitem"
                    style={{ ...LOG_ROW_STYLE, borderLeftColor: cfg.border }}
                    data-log-level={log.level}
                  >
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '1px 6px',
                        borderRadius: 'var(--radius-pill, 12px)',
                        fontSize: 'var(--font-size-xs)',
                        background: cfg.bg,
                        color: cfg.color,
                        flexShrink: 0,
                        minWidth: '40px',
                        textAlign: 'center',
                      }}
                    >
                      {log.level}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <CodeText value={log.stage} muted />
                        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--fg-muted)' }}>
                          {formatTime(log.createdAt)}
                        </span>
                      </div>
                      <div
                        style={{
                          fontSize: 'var(--font-size-xs)',
                          color: 'var(--fg-default)',
                          wordBreak: 'break-word',
                          marginTop: '2px',
                        }}
                        data-log-message
                      >
                        {log.message}
                      </div>
                      {log.details ? (
                        <details style={{ marginTop: '4px' }} data-log-details>
                          <summary style={{ fontSize: 'var(--font-size-xs)', color: 'var(--fg-muted)', cursor: 'pointer' }}>
                            details
                          </summary>
                          <pre
                            style={{
                              fontSize: 'var(--font-size-xs)',
                              background: 'var(--bg-surface-sunken)',
                              padding: '6px 8px',
                              borderRadius: 'var(--radius-sm, 4px)',
                              overflow: 'auto',
                              margin: '4px 0 0',
                              maxHeight: '160px',
                            }}
                          >
                            {JSON.stringify(log.details, null, 2)}
                          </pre>
                        </details>
                      ) : null}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </AdminCard>
      </div>
    </Drawer>
  )
}
