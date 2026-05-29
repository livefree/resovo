'use client'

import React, { useCallback } from 'react'
import { Thumb, SplitPane, AdminButton, AdminCheckbox, useToast } from '@resovo/admin-ui'
import { M } from '@/i18n/messages/zh-CN/moderation'
import { useRejectedQueue } from './useRejectedQueue'

/**
 * RejectedTabContent — 已拒绝队列双栏视图
 *
 * CHG-SN-9-REJECTED-ENHANCE-A（plan §5 P2 / plan §7 拆 -A 分页）：
 *   - 接入 useRejectedQueue hook：page+limit 分页 + activeIdx near-end loadMore + sessionStorage
 *
 * CHG-SN-9-REJECTED-ENHANCE-B / Wave 4 #1（plan §7 拆 -B 视觉对齐）：
 *   - inline BTN_SM + LOAD_MORE_BTN → AdminButton（size=sm / 共享原语占比 ↑）
 *   - 手写双栏 flex → SplitPane（与 PendingPaneController 对齐 / consoleSplitRegion 范式复用）
 *   - 行 checkbox 勾选 + sticky 批量栏 + 批量 reopen（客户端循环 / 不新增 batch-reopen 端点防触发 ADR）
 *   - reopen 成功 → useToast 提示「已跳回待审核」（背景：之前用户不知道 reopen 后视频去了哪里）
 */
export function RejectedTabContent(): React.ReactElement {
  const toast = useToast()
  const {
    videos,
    total,
    hasMore,
    activeIdx,
    loading,
    loadingMore,
    error,
    selectedIds,
    batchPending,
    setActiveIdx,
    loadMore,
    reopenAt,
    setError,
    toggleSelect,
    clearSelection,
    batchReopen,
  } = useRejectedQueue(true)

  const v = videos[activeIdx] ?? null
  const selectedCount = selectedIds.size

  const handleReopen = useCallback(async () => {
    setError(null)
    try {
      await reopenAt()
      toast.push({
        title: M.rejected.toast.reopened,
        description: M.rejected.toast.reopenedDesc,
        level: 'success',
      })
    } catch {
      // hook 内 setError 已写 / 此处吞错防 unhandled rejection
    }
  }, [reopenAt, setError, toast])

  const handleBatchReopen = useCallback(async () => {
    if (selectedCount === 0) return
    const result = await batchReopen()
    if (result.success.length > 0 && result.failed.length === 0) {
      toast.push({
        title: M.rejected.toast.batchReopened(result.success.length),
        description: M.rejected.toast.reopenedDesc,
        level: 'success',
      })
    } else if (result.success.length > 0 && result.failed.length > 0) {
      toast.push({
        title: M.rejected.toast.batchPartialFailed(result.success.length, result.failed.length),
        description: M.rejected.toast.reopenedDesc,
        level: 'warn',
      })
    } else if (result.failed.length > 0) {
      toast.push({
        title: M.rejected.toast.batchAllFailed(result.failed.length),
        level: 'danger',
      })
    }
  }, [batchReopen, selectedCount, toast])

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, color: 'var(--fg-muted)', fontSize: 'var(--font-size-sm-tight)' }}>
        {M.rejected.loading}
      </div>
    )
  }

  if (error && videos.length === 0) {
    return (
      <div style={{ padding: 16, color: 'var(--state-error-fg)', fontSize: 'var(--font-size-sm-tight)' }}>
        {error}
      </div>
    )
  }

  return (
    <>
      <SplitPane
        height="100%"
        gap={12}
        role="region"
        aria-label={M.aria.consoleSplitRegion}
        data-testid="rejected-split"
        panes={[
          {
            width: 280,
            minWidth: 220,
            header: (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--fg-muted)' }}>
                  {total > videos.length
                    ? M.rejected.listHeaderWithTotal(videos.length, total)
                    : M.rejected.listHeader(videos.length)}
                </span>
              </div>
            ),
            noPadding: true,
            role: 'complementary',
            'aria-label': M.aria.consoleQueuePane,
            children: (
              <div data-testid="rejected-list">
                {videos.length === 0 ? (
                  <div style={{ padding: 24, textAlign: 'center', color: 'var(--fg-muted)', fontSize: 'var(--font-size-sm-tight)' }}>
                    {M.rejected.empty}
                  </div>
                ) : (
                  <>
                    {videos.map((it, i) => {
                      const selected = selectedIds.has(it.id)
                      return (
                        <div
                          key={it.id}
                          onClick={() => setActiveIdx(i)}
                          style={{
                            display: 'flex',
                            gap: 10,
                            padding: 'var(--list-row-padding-y) var(--list-row-padding-x)',
                            borderBottom: '1px solid var(--border-subtle)',
                            background: i === activeIdx ? 'var(--admin-accent-soft)' : 'transparent',
                            borderLeft: `2px solid ${i === activeIdx ? 'var(--accent-default)' : 'transparent'}`,
                            cursor: 'pointer',
                            opacity: 0.85,
                            alignItems: 'flex-start',
                          }}
                        >
                          <div
                            // 阻止外层行点击（setActiveIdx）抢占 checkbox 的 onChange；
                            // toggle 仅由 AdminCheckbox.onChange 触发，避免 click + change 双触发抵消
                            onClick={(e) => e.stopPropagation()}
                            style={{ display: 'flex', alignItems: 'center', paddingTop: 4 }}
                          >
                            <AdminCheckbox
                              checked={selected}
                              onChange={() => toggleSelect(it.id)}
                              aria-label={M.rejected.toggleSelectAria}
                              data-testid={`rejected-row-checkbox-${it.id}`}
                            />
                          </div>
                          <Thumb
                            src={it.cover_url}
                            size="poster-sm"
                            decorative={false}
                            alt={it.title}
                            fallback={<span style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--fg-muted)' }}>{it.type}</span>}
                          />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 'var(--font-size-sm-tight)', fontWeight: 600, color: i === activeIdx ? 'var(--accent-default)' : 'var(--fg-default)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {it.title}
                            </div>
                            <div style={{ fontSize: 'var(--font-size-xxs)', color: 'var(--fg-muted)', marginTop: 2 }}>
                              {it.type} · {it.year ?? '—'}
                            </div>
                            <span style={{ fontSize: 'var(--font-size-2xs)', padding: '1px 6px', borderRadius: 999, background: 'var(--state-error-bg)', color: 'var(--state-error-fg)', display: 'inline-block', marginTop: 4 }}>
                              已拒绝
                            </span>
                          </div>
                        </div>
                      )
                    })}
                    {/* 列表底部加载更多 / 全部已加载 */}
                    {hasMore ? (
                      <div style={{ padding: '8px 12px', borderTop: '1px solid var(--border-subtle)' }}>
                        <AdminButton
                          variant="ghost"
                          size="sm"
                          loading={loadingMore}
                          onClick={loadMore}
                          data-testid="rejected-load-more"
                          style={{ width: '100%' }}
                        >
                          {loadingMore ? M.rejected.loadingMore : M.rejected.loadMore}
                        </AdminButton>
                      </div>
                    ) : (
                      <div style={{ padding: 12, textAlign: 'center', color: 'var(--fg-subtle)', fontSize: 'var(--font-size-xxs)', borderTop: '1px solid var(--border-subtle)' }}>
                        {M.rejected.allLoaded}
                      </div>
                    )}
                  </>
                )}
              </div>
            ),
          },
          {
            width: '1fr',
            minWidth: 400,
            noPadding: true,
            role: 'main',
            'aria-label': M.aria.consoleDetailPane,
            header: v ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--state-error-fg)' }}>{M.rejected.title}</span>
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--fg-muted)' }}>{v.title}</span>
                <span style={{ flex: 1 }} />
                <AdminButton
                  size="sm"
                  onClick={handleReopen}
                  aria-label={M.aria.rejectedReopen}
                  data-testid="rejected-reopen-btn"
                >
                  {M.rejected.reopen}
                </AdminButton>
              </div>
            ) : undefined,
            children: v ? (
              <div style={{ padding: 14 }}>
                {error && (
                  <div style={{ marginBottom: 12, padding: '8px var(--toolbar-padding-x)', background: 'var(--state-error-bg)', border: '1px solid var(--state-error-border)', borderRadius: 6, fontSize: 'var(--font-size-xs)', color: 'var(--state-error-fg)' }}>
                    {error}
                  </div>
                )}

                {/* Rejection info */}
                <div style={{ padding: '10px 14px', background: 'var(--state-error-bg)', border: '1px solid var(--state-error-border)', borderRadius: 6, marginBottom: 14, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <span style={{ color: 'var(--state-error-fg)', fontSize: 'var(--font-size-lg)', marginTop: 2 }}>✕</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, color: 'var(--state-error-fg)' }}>{M.rejected.rejectedLabel}</div>
                    <div style={{ color: 'var(--fg-muted)', marginTop: 4, fontSize: 'var(--font-size-xs)' }}>
                      {v.review_label_key ?? M.rejected.noLabel}
                    </div>
                    <div style={{ color: 'var(--fg-subtle)', marginTop: 4, fontSize: 'var(--font-size-xxs)' }}>
                      更新时间：{v.updated_at ?? v.created_at}
                    </div>
                  </div>
                </div>

                {/* Video info */}
                <div style={{ display: 'flex', gap: 14, marginBottom: 14 }}>
                  <Thumb
                    src={v.cover_url}
                    size="poster-lg"
                    decorative={false}
                    alt={v.title}
                    fallback={<span style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--fg-muted)' }}>{v.type}</span>}
                  />
                  <div style={{ flex: 1 }}>
                    <h3 style={{ margin: 0, fontSize: 'var(--font-size-base)', fontWeight: 700, color: 'var(--fg-muted)' }}>{v.title}</h3>
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--fg-muted)', marginTop: 4 }}>{v.type} · {v.year ?? '—'}</div>
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--fg-muted)', marginTop: 4 }}>
                      visibility: {v.visibility_status} · source_check: {v.source_check_status ?? '—'}
                    </div>
                    <div style={{ fontSize: 'var(--font-size-xxs)', color: 'var(--fg-muted)', marginTop: 4 }}>
                      ID: <code style={{ fontFamily: 'monospace' }}>{v.id}</code>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div style={{ marginTop: 14, padding: 'var(--panel-padding-y) var(--panel-padding-x)', background: 'var(--bg-surface-raised)', borderRadius: 6 }}>
                  <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, marginBottom: 8 }}>可执行操作</div>
                  <AdminButton size="sm" onClick={handleReopen} aria-label={M.aria.rejectedReopen}>
                    {M.rejected.reopen}
                  </AdminButton>
                </div>
              </div>
            ) : (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--fg-muted)', fontSize: 'var(--font-size-sm-tight)', minHeight: 240 }}>
                {M.rejected.empty}
              </div>
            ),
          },
        ]}
      />
      {/* 批量操作栏：sticky 底部 / 仅勾选 > 0 时显示 */}
      {selectedCount > 0 && (
        <div
          data-testid="rejected-bulk-bar"
          style={{
            position: 'sticky',
            bottom: 0,
            marginTop: 12,
            padding: '10px 14px',
            background: 'var(--bg-surface-elevated)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            boxShadow: '0 -2px 8px rgba(0,0,0,0.05)',
          }}
        >
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--fg-default)', fontWeight: 600 }}>
            {M.rejected.bulkSelectedHint(selectedCount)}
          </span>
          <span style={{ flex: 1 }} />
          <AdminButton
            size="sm"
            variant="ghost"
            onClick={clearSelection}
            data-testid="rejected-bulk-clear"
          >
            {M.rejected.clearSelection}
          </AdminButton>
          <AdminButton
            size="sm"
            variant="primary"
            loading={batchPending}
            onClick={handleBatchReopen}
            data-testid="rejected-bulk-reopen"
          >
            {M.rejected.bulkReopen(selectedCount)}
          </AdminButton>
        </div>
      )}
    </>
  )
}
