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
 *
 * CHG-355（2026-05-27 / 3 次复发后重构）：loading 不切换组件根（SWR 范式）
 *   - 删除原 `if (loading) return <加载中>` early return（CHG-350/350-FIX/350-FIX-2 3 次失败根因）
 *   - 始终渲染 SplitPane → toolbar → DataTableSearchInput 永挂载，焦点稳定
 *   - usePendingQueue.refetch 不清空 videos，loading 期间旧 v 自然顶住（中/右 pane SWR）
 *   - loading 状态仅影响左 pane listbox 内部：首次空白显示加载文案，否则保持旧列表
 *   - arch-reviewer Opus 红线 R3：中/右 pane 不需 loading 分支（v 取上次值）
 *   - 参考：packages/admin-ui DataTable 真源范式 / search-input.tsx EP-4-HOTFIX 调用方契约
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { SplitPane, KeyboardShortcuts } from '@resovo/admin-ui'
import type { ShortcutBinding } from '@resovo/admin-ui'
import type { VideoQueueRow } from '@resovo/types'
import { ModListRow } from './ModListRow'
import { PendingCenter } from './PendingCenter'
import { RightPane } from './RightPane'
import { PendingQueueToolbar } from './PendingQueueToolbar'
import { KeyboardHelpOverlay } from './KeyboardHelpOverlay'
import type { KeyboardHelpItem } from './KeyboardHelpOverlay'
import { buildAdminPreviewUrl } from '@/lib/admin-preview-url'
import type { FilterPresetQuery } from '@/lib/moderation/use-filter-presets'
import { M } from '@/i18n/messages/zh-CN/moderation'

// MODUX-P2-3：审核台快捷键单一真源条目（派生 KeyboardShortcuts bindings + help 列表）
interface ConsoleShortcut {
  readonly spec: string
  readonly displayKey: string
  readonly label: string
  readonly group: string
  /** 批量模式下是否仍生效（false = 批量模式暂停，如 A/R/S/E/P 单条操作） */
  readonly batchSafe: boolean
  readonly handler: (event: KeyboardEvent) => void
}

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
  /** CHG-358：probe / render-check 完成后通知 PendingQueue refetch（左队列 pill 联动）*/
  readonly onSourceHealthChanged?: () => void
  // CHG-350：search + filterChips toolbar 注入
  readonly q: string
  readonly onQChange: (q: string) => void
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
  onSourceHealthChanged,
  q,
  onQChange,
  currentFilters,
  onClearAllFilters,
}: PendingPaneControllerProps): React.ReactElement {
  const [rightOpen, setRightOpen] = useState(true)
  const [helpOpen, setHelpOpen] = useState(false)

  // responsive right pane
  useEffect(() => {
    const update = () => setRightOpen(window.innerWidth >= 1280)
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  const v = videos[activeIdx] ?? null
  // CHG-355 R2：首次加载（无任何旧数据 + 仍在 loading）才展示加载文案；否则保持旧列表 SWR
  const isFirstLoad = loading && videos.length === 0

  // ── 键盘流（MODUX-P2-3 / item 1）：原生 window keydown → 共享 KeyboardShortcuts ──
  //   修复现状隐患：批量模式下 A/R/S 仍触发（旧实现注释自承）→ batchSafe 守卫；扩 E/P/`/`/`?` + help 浮层。
  const goNext = useCallback(() => setActiveIdx((i) => Math.min(i + 1, videos.length - 1)), [setActiveIdx, videos.length])
  const goPrev = useCallback(() => setActiveIdx((i) => Math.max(i - 1, 0)), [setActiveIdx])
  const focusSearch = useCallback((e: KeyboardEvent) => {
    e.preventDefault() // 阻止 '/' 落入刚聚焦的搜索框
    const input = document.querySelector('[data-testid="pending-queue-search-input"]') as HTMLInputElement | null
    input?.focus()
  }, [])
  const editActive = useCallback(() => { if (v) onEditVideo(v.id) }, [v, onEditVideo])
  const previewActive = useCallback(() => {
    if (!v) return
    // P 预览：与 PendingCenter「前台预览」按钮同口径（buildAdminPreviewUrl 单一收口）。
    // window.open 薄封装此处与 PendingCenter 重复 1 次（2 处 < 3 处提取阈值，未抽 lib）。
    window.open(buildAdminPreviewUrl({ type: v.type, slug: v.slug, shortId: v.shortId }), '_blank', 'noopener,noreferrer')
  }, [v])
  const toggleHelp = useCallback(() => setHelpOpen((o) => !o), [])

  // 单一真源：spec + 展示 + 行为 + 批量安全（派生 bindings + help 列表，避免双份漂移）
  const shortcuts = useMemo<readonly ConsoleShortcut[]>(() => [
    { spec: 'j', displayKey: 'J', label: '下一条', group: '导航', batchSafe: true, handler: goNext },
    { spec: 'k', displayKey: 'K', label: '上一条', group: '导航', batchSafe: true, handler: goPrev },
    { spec: '/', displayKey: '/', label: '聚焦搜索框', group: '导航', batchSafe: true, handler: focusSearch },
    { spec: 'a', displayKey: 'A', label: M.actions.approve, group: '审核', batchSafe: false, handler: () => onApprove() },
    { spec: 'r', displayKey: 'R', label: M.actions.reject, group: '审核', batchSafe: false, handler: () => onRejectOpen() },
    { spec: 's', displayKey: 'S', label: M.actions.skip, group: '审核', batchSafe: false, handler: goNext },
    { spec: 'e', displayKey: 'E', label: '编辑视频', group: '审核', batchSafe: false, handler: editActive },
    { spec: 'p', displayKey: 'P', label: '前台预览', group: '审核', batchSafe: false, handler: previewActive },
    { spec: 'shift+?', displayKey: '?', label: '打开/关闭此面板', group: '帮助', batchSafe: true, handler: toggleHelp },
  ], [goNext, goPrev, focusSearch, onApprove, onRejectOpen, editActive, previewActive, toggleHelp])

  const bindings = useMemo<ShortcutBinding[]>(() => {
    const active = helpOpen
      ? shortcuts.filter((s) => s.group === '帮助')          // help 打开时仅留 ? 切换（Modal 自处理 Esc/遮罩）
      : shortcuts.filter((s) => !batchModeOn || s.batchSafe) // 批量模式仅 J/K/`/`/`?` 生效，A/R/S/E/P 暂停
    return active.map((s) => ({ id: s.spec, spec: s.spec, handler: s.handler }))
  }, [shortcuts, batchModeOn, helpOpen])

  const helpItems = useMemo<KeyboardHelpItem[]>(
    () => shortcuts.map((s) => ({ displayKey: s.displayKey, label: s.label, group: s.group, batchPaused: !s.batchSafe })),
    [shortcuts],
  )

  return (
    <>
      {/* MODUX-P2-3：审核台局部键盘流（不混入 AdminShell 全局）+ help 浮层 */}
      <KeyboardShortcuts bindings={bindings} />
      <KeyboardHelpOverlay
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        items={helpItems}
        batchModeOn={batchModeOn}
      />
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
              {/* MODUX-P2-3：「键盘流」升级为 help 浮层入口（呼应 P2-1 page-head 提示位）；? 键并行 */}
              <button
                type="button"
                onClick={() => setHelpOpen(true)}
                title="查看快捷键（?）"
                aria-haspopup="dialog"
                data-testid="moderation-keyboard-help-trigger"
                style={{ display: 'flex', alignItems: 'center', gap: 4, padding: 0, border: 0, background: 'transparent', cursor: 'pointer', fontSize: 'var(--font-size-xxs)', color: 'var(--state-success-fg)' }}
              >
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--state-success-fg)', display: 'inline-block' }} />
                {M.kbdFlowLabel}
              </button>
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
                q={q}
                onQChange={onQChange}
                filters={currentFilters}
                onClearAll={onClearAllFilters}
                resultCount={total}
              />
              <div role="listbox" aria-label={M.aria.consoleQueuePane}>
                {isFirstLoad ? (
                  // R2：首次加载（无旧数据）才显示加载文案；toolbar 在上方保持挂载，焦点不丢
                  <div style={{ padding: 24, textAlign: 'center', color: 'var(--fg-muted)', fontSize: 'var(--font-size-sm-tight)' }}>
                    {M.pending.loading}
                  </div>
                ) : videos.length === 0 ? (
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
                      {/* loading 期间已有旧列表 → footer 显示"刷新中"轻提示；loadingMore 显示加载更多 */}
                      {loadingMore ? M.pending.loadingMore : loading ? M.pending.loading : nextCursor ? (
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
            <PendingCenter v={v} onStaffNoteChange={onStaffNoteChange} onEditVideo={onEditVideo} onSourceHealthChanged={onSourceHealthChanged} />
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
    </>
  )
}
