'use client'

/**
 * PendingPaneController.tsx — 审核台 pending tab 三栏编排（CHG-349 / SPLIT-C）
 *
 * 来源：原 ModerationConsole.tsx pending tab 内 SplitPane + 中部 toolbar + 左队列 + 键盘流抽出
 *
 * 职责：
 *   - SplitPane 三栏渲染（左队列 / 中预览 / 右详情）
 *   - 键盘流 J/K/A/R/S（仅 pending tab + 跳过 input 焦点）
 *   - 内部 rightOpen state + responsive（>= 1280px 默认打开）
 *   - 左队列 loadMore 显示
 *   - 中部 toolbar：counter / progress bar / J/K/A/R/S 按钮
 *
 * 不在职责：
 *   - tab 切换 / segment tabs / toggles（ModerationConsole 保留）
 *   - Modal / Drawer / Toast 等全局组件（ModerationConsole 保留）
 *   - useFilterPresets / usePendingQueue 调用（ModerationConsole 持有 hook，传 props）
 */

import React, { useCallback, useEffect, useState } from 'react'
import { SplitPane } from '@resovo/admin-ui'
import type { VideoQueueRow } from '@resovo/types'
import { ModListRow } from './ModListRow'
import { PendingCenter } from './PendingCenter'
import { RightPane } from './RightPane'
import { PendingQueueToolbar } from './PendingQueueToolbar'
import type { FilterPresetQuery } from '@/lib/moderation/use-filter-presets'
import { M } from '@/i18n/messages/zh-CN/moderation'

const BTN_SM: React.CSSProperties = {
  padding: '5px 10px',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-sm)',
  background: 'var(--bg-surface-row)',
  color: 'var(--fg-default)',
  cursor: 'pointer',
  fontSize: 'var(--font-size-xs)',
}
const BTN_PRIMARY: React.CSSProperties = { ...BTN_SM, background: 'var(--accent-default)', color: 'var(--fg-on-accent)', borderColor: 'var(--accent-default)' }
const BTN_DANGER: React.CSSProperties = { ...BTN_SM, color: 'var(--state-error-fg)', borderColor: 'var(--state-error-border)' }
const KBD: React.CSSProperties = { display: 'inline-block', padding: '1px 5px', border: '1px solid var(--border-default)', borderRadius: 3, fontSize: 'var(--font-size-2xs)', fontFamily: 'monospace', background: 'var(--bg-surface-raised)', color: 'var(--fg-muted)' }

export interface PendingPaneControllerProps {
  readonly videos: readonly VideoQueueRow[]
  readonly total: number
  readonly activeIdx: number
  readonly loading: boolean
  readonly loadingMore: boolean
  readonly nextCursor: string | null
  readonly setActiveIdx: (updater: number | ((prev: number) => number)) => void
  readonly loadMore: () => void
  readonly batchModeOn: boolean
  readonly selectedIds: ReadonlySet<string>
  readonly onToggleSelect: (id: string) => void
  readonly onApprove: () => void
  readonly onRejectOpen: () => void
  readonly onEditVideo: (videoId: string) => void
  readonly onStaffNoteChange: (videoId: string, note: string | null) => void
  // CHG-350：search + filterChips toolbar 注入
  readonly qInput: string
  readonly onQInputChange: (q: string) => void
  readonly currentFilters: FilterPresetQuery
  readonly onClearAllFilters: () => void
}

export function PendingPaneController({
  videos,
  total,
  activeIdx,
  loading,
  loadingMore,
  nextCursor,
  setActiveIdx,
  loadMore,
  batchModeOn,
  selectedIds,
  onToggleSelect,
  onApprove,
  onRejectOpen,
  onEditVideo,
  onStaffNoteChange,
  qInput,
  onQInputChange,
  currentFilters,
  onClearAllFilters,
}: PendingPaneControllerProps): React.ReactElement {
  const [rightOpen, setRightOpen] = useState(true)

  // responsive right pane
  useEffect(() => {
    const update = () => setRightOpen(window.innerWidth >= 1280)
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  // 键盘流 J/K/A/R/S（pending tab 专属；批量模式开启时由 caller 不渲染或可继续 — 设计保持简单：批量模式下仍允许 J/K 浏览,但 A/R/S 不触发 - 当前实现保留旧行为不区分）
  const handleKey = useCallback((e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
    if (e.metaKey || e.ctrlKey) return
    if (e.key === 'j' || e.key === 'J') setActiveIdx(i => Math.min(i + 1, videos.length - 1))
    else if (e.key === 'k' || e.key === 'K') setActiveIdx(i => Math.max(i - 1, 0))
    else if (e.key === 'a' || e.key === 'A') onApprove()
    else if (e.key === 'r' || e.key === 'R') onRejectOpen()
    else if (e.key === 's' || e.key === 'S') setActiveIdx(i => Math.min(i + 1, videos.length - 1))
  }, [videos.length, setActiveIdx, onApprove, onRejectOpen])

  useEffect(() => {
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [handleKey])

  const v = videos[activeIdx] ?? null

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--fg-muted)', fontSize: 'var(--font-size-sm-tight)' }}>
        {M.pending.loading}
      </div>
    )
  }

  return (
    <SplitPane
      height="100%"
      gap={12}
      role="region"
      aria-label={M.aria.consoleSplitRegion}
      data-testid="moderation-split"
      panes={[
        {
          width: 280,
          minWidth: 200,
          header: (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--fg-muted)' }}>{M.totalCount(total, 0)}</span>
              <span style={{ flex: 1 }} />
              <span style={{ fontSize: 'var(--font-size-xxs)', color: 'var(--state-success-fg)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--state-success-fg)', display: 'inline-block' }} />
                {M.kbdFlowLabel}
              </span>
            </div>
          ),
          noPadding: true,
          role: 'complementary',
          'aria-label': M.aria.consoleQueuePane,
          children: (
            // CHG-350 BUG-FIX：toolbar 移出 listbox，作为 pane body 直接子级 +
            //   sticky positioning 让其贴 pane body 顶部，列表滚动时保持可见
            <>
              <PendingQueueToolbar
                q={qInput}
                onQChange={onQInputChange}
                filters={currentFilters}
                onClearAll={onClearAllFilters}
                resultCount={total}
              />
              <div role="listbox" aria-label={M.aria.consoleQueuePane}>
                {videos.length === 0 ? (
                  <div style={{ padding: 24, textAlign: 'center', color: 'var(--fg-muted)', fontSize: 'var(--font-size-sm-tight)' }}>
                    {M.pending.empty}
                  </div>
                ) : (
                  <>
                    {videos.map((it, i) => (
                      <ModListRow
                        key={it.id}
                        it={it}
                        active={i === activeIdx}
                        onClick={() => setActiveIdx(i)}
                        selectionMode={batchModeOn}
                        selected={selectedIds.has(it.id)}
                        onToggleSelect={() => onToggleSelect(it.id)}
                      />
                    ))}
                    <div style={{ padding: 14, textAlign: 'center', color: 'var(--fg-muted)', fontSize: 'var(--font-size-xxs)' }}>
                      {loadingMore ? M.pending.loadingMore : nextCursor ? (
                        <button style={{ ...BTN_SM, fontSize: 'var(--font-size-xxs)' }} onClick={loadMore}>{M.pending.loadingMore}</button>
                      ) : M.pending.noMore}
                    </div>
                  </>
                )}
              </div>
            </>
          ),
        },
        {
          width: '1fr',
          minWidth: 400,
          header: v ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' as const }}>
              <span style={KBD}>J</span>
              <span style={KBD}>K</span>
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--fg-muted)' }}>{M.counter(activeIdx + 1, total)}</span>
              <div style={{ flex: 1, height: 4, background: 'var(--bg-surface-raised)', borderRadius: 2, minWidth: 40 }}>
                <div style={{ height: '100%', width: `${Math.min(100, ((activeIdx + 1) / Math.max(1, total)) * 100)}%`, background: 'var(--accent-default)', borderRadius: 2 }} />
              </div>
              <button style={BTN_DANGER} onClick={onRejectOpen} aria-label={M.aria.consoleRejectVideo}>
                ✕ {M.actions.reject} <span style={KBD}>R</span>
              </button>
              <button style={BTN_SM} onClick={() => setActiveIdx(i => Math.min(i + 1, videos.length - 1))} aria-label={M.aria.consoleSkipVideo}>
                {M.actions.skip} <span style={KBD}>S</span>
              </button>
              <button style={BTN_PRIMARY} onClick={onApprove} aria-label={M.aria.consoleApproveVideo}>
                ✓ {M.actions.approve} <span style={KBD}>A</span>
              </button>
              <button style={BTN_SM} onClick={() => setRightOpen(o => !o)} aria-expanded={rightOpen}>
                {rightOpen ? '›' : '‹'} {M.actions.detail}
              </button>
            </div>
          ) : <span />,
          role: 'main',
          'aria-label': M.aria.consolePreviewPane,
          children: v ? (
            <PendingCenter v={v} onStaffNoteChange={onStaffNoteChange} onEditVideo={onEditVideo} />
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--fg-muted)', fontSize: 'var(--font-size-sm-tight)' }}>
              {M.pending.empty}
            </div>
          ),
        },
        {
          width: 300,
          minWidth: 260,
          hidden: !rightOpen,
          role: 'complementary',
          'aria-label': M.aria.consoleDetailPane,
          children: v ? <RightPane v={v} /> : null,
        },
      ]}
    />
  )
}
