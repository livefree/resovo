'use client'

import React, { useCallback } from 'react'
import { Thumb } from '@resovo/admin-ui'
import { M } from '@/i18n/messages/zh-CN/moderation'
import { useRejectedQueue } from './useRejectedQueue'

// ── Styles ────────────────────────────────────────────────────────
// CHG-SN-9-REJECTED-ENHANCE-A 范围内不动 BTN_SM → AdminButton 迁移
// （留 -B 子卡 / 同 SEQ-FOLLOWUP-MIGRATE 长尾策略）。

const BTN_SM: React.CSSProperties = {
  padding: '5px 10px',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-sm)',
  background: 'var(--bg-surface-elevated)',
  color: 'var(--fg-default)',
  cursor: 'pointer',
  fontSize: 'var(--font-size-xs)',
}

const LOAD_MORE_BTN: React.CSSProperties = {
  width: '100%',
  padding: '8px',
  borderTopWidth: '1px',
  borderTopStyle: 'solid',
  borderTopColor: 'var(--border-subtle)',
  borderRightWidth: 0,
  borderBottomWidth: 0,
  borderLeftWidth: 0,
  background: 'var(--bg-surface-elevated)',
  color: 'var(--accent-default)',
  cursor: 'pointer',
  fontSize: 'var(--font-size-xs)',
}

// ── Main component ────────────────────────────────────────────────

/**
 * RejectedTabContent — 已拒绝队列双栏视图（左 list + 中 detail）
 *
 * CHG-SN-9-REJECTED-ENHANCE-A（plan §5 P2 / plan §7 拆 -A 分页）：
 *   - 接入 useRejectedQueue hook：page+limit 分页 + activeIdx near-end loadMore + sessionStorage 持久化
 *   - 显示已加载 / 总数提示（listHeaderWithTotal）+ 列表底部 "加载更多" / "已显示全部" 提示
 *   - 删除内联 useEffect/fetchRejectedVideos 逻辑（移到 hook）
 *
 * 留待 CHG-SN-9-REJECTED-ENHANCE-B follow-up：
 *   - BTN_SM → AdminButton 迁移（与 MOD-BUTTON-MIGRATE SEQ-FOLLOWUP-MIGRATE 同长尾）
 *   - 复用 admin-ui SplitPane / 视觉与 pending tab 对齐
 *   - 批量 reopen + 跳转回 pending 提示
 */
export function RejectedTabContent(): React.ReactElement {
  const {
    videos,
    total,
    hasMore,
    activeIdx,
    loading,
    loadingMore,
    error,
    setActiveIdx,
    loadMore,
    reopenAt,
    setError,
  } = useRejectedQueue(true)

  const v = videos[activeIdx] ?? null

  const handleReopen = useCallback(async () => {
    setError(null)
    try {
      await reopenAt()
    } catch {
      // hook 内 setError 已写 / 此处吞错防 unhandled rejection
    }
  }, [reopenAt, setError])

  if (loading) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, color: 'var(--fg-muted)', fontSize: 'var(--font-size-sm-tight)' }}>{M.rejected.loading}</div>
  }

  if (error && videos.length === 0) {
    return <div style={{ padding: 16, color: 'var(--state-error-fg)', fontSize: 'var(--font-size-sm-tight)' }}>{error}</div>
  }

  return (
    <div style={{ display: 'flex', gap: 12, flex: 1, minHeight: 0 }}>
      {/* Left list */}
      <div style={{ width: 280, flexShrink: 0, background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: 'var(--toolbar-padding-y) var(--toolbar-padding-x)', flexShrink: 0, borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--fg-muted)' }}>
            {total > videos.length
              ? M.rejected.listHeaderWithTotal(videos.length, total)
              : M.rejected.listHeader(videos.length)}
          </span>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }} data-testid="rejected-list">
          {videos.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--fg-muted)', fontSize: 'var(--font-size-sm-tight)' }}>{M.rejected.empty}</div>
          ) : (
            <>
              {videos.map((it, i) => (
                <div key={it.id} onClick={() => setActiveIdx(i)} style={{ display: 'flex', gap: 10, padding: 'var(--list-row-padding-y) var(--list-row-padding-x)', borderBottom: '1px solid var(--border-subtle)', background: i === activeIdx ? 'var(--admin-accent-soft)' : 'transparent', borderLeft: `2px solid ${i === activeIdx ? 'var(--accent-default)' : 'transparent'}`, cursor: 'pointer', opacity: 0.85 }}>
                  <Thumb
                    src={it.cover_url}
                    size="poster-sm"
                    decorative={false}
                    alt={it.title}
                    fallback={<span style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--fg-muted)' }}>{it.type}</span>}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 'var(--font-size-sm-tight)', fontWeight: 600, color: i === activeIdx ? 'var(--accent-default)' : 'var(--fg-default)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.title}</div>
                    <div style={{ fontSize: 'var(--font-size-xxs)', color: 'var(--fg-muted)', marginTop: 2 }}>{it.type} · {it.year ?? '—'}</div>
                    <span style={{ fontSize: 'var(--font-size-2xs)', padding: '1px 6px', borderRadius: 999, background: 'var(--state-error-bg)', color: 'var(--state-error-fg)', display: 'inline-block', marginTop: 4 }}>已拒绝</span>
                  </div>
                </div>
              ))}
              {/* 列表底部加载更多 / 全部已加载提示（CHG-SN-9-REJECTED-ENHANCE-A 分页） */}
              {hasMore ? (
                <button
                  type="button"
                  data-testid="rejected-load-more"
                  style={{ ...LOAD_MORE_BTN, opacity: loadingMore ? 0.6 : 1 }}
                  onClick={loadMore}
                  disabled={loadingMore}
                >
                  {loadingMore ? M.rejected.loadingMore : M.rejected.loadMore}
                </button>
              ) : (
                <div style={{ padding: 12, textAlign: 'center', color: 'var(--fg-subtle)', fontSize: 'var(--font-size-xxs)', borderTop: '1px solid var(--border-subtle)' }}>
                  {M.rejected.allLoaded}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Center detail */}
      <div style={{ flex: 1, minWidth: 0, background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {v ? (
          <>
            <div style={{ padding: 'var(--toolbar-padding-y) var(--toolbar-padding-x)', flexShrink: 0, borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--state-error-fg)' }}>{M.rejected.title}</span>
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--fg-muted)' }}>{v.title}</span>
              <span style={{ flex: 1 }} />
              <button
                style={{ ...BTN_SM, opacity: loadingMore ? 0.6 : 1 }}
                onClick={handleReopen}
                aria-label={M.aria.rejectedReopen}
              >
                {M.rejected.reopen}
              </button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, padding: 14 }}>
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
                <button style={BTN_SM} onClick={handleReopen} aria-label={M.aria.rejectedReopen}>
                  {M.rejected.reopen}
                </button>
              </div>
            </div>
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--fg-muted)', fontSize: 'var(--font-size-sm-tight)' }}>
            {M.rejected.empty}
          </div>
        )}
      </div>
    </div>
  )
}