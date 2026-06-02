'use client'

/**
 * SourceRowActions.tsx — 播放线路表格行操作列（设计 §6.2 `btn--xs ×3：refresh / zap / more`）
 *
 * 三键（用户裁决 2026-06-02 / SEQ-20260602-02）：
 *   ↻ refresh → batchProbeVideo（重新探测连接）
 *   ⚡ zap     → batchRenderCheckVideo（重验播放 / 试播）
 *   ⋯ more    → AdminDropdown：展开/收起线路 · 重新采集源 · 停用全失效源(danger/条件) · 线路别名管理
 *
 * 反馈：`useToast` 浮层（复用 SourceLinesExpand summary 文案口径 `ok/total · dead 失效 · failed 异常`）；
 *       pending 期禁用全部按钮；异步完成 → `onReload()` 刷新本行 probe/render 聚合信号。
 * 范式对齐 videos/_client/VideoRowActions（共享 AdminDropdown + 行内触发器 + pending 守卫）。
 */

import React, { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { AdminDropdown, useToast, type AdminDropdownItem } from '@resovo/admin-ui'
import type { VideoGroupRow } from '@/lib/sources/types'
import {
  batchProbeVideo,
  batchRenderCheckVideo,
  refetchSources,
  disableDeadSources,
} from '@/lib/sources/api'

// ── types ─────────────────────────────────────────────────────────

export interface SourceRowActionHandlers {
  /** 切换该视频行展开（显示线路矩阵 SourceLinesExpand）；等同点击行 */
  readonly onExpandToggle: (videoId: string) => void
  /** 异步操作完成后刷新表格（重取本行聚合信号）；= SourcesClient 的 retryKey bump */
  readonly onReload: () => void
}

export interface SourceRowActionsProps extends SourceRowActionHandlers {
  readonly row: VideoGroupRow
  readonly expanded: boolean
  /**
   * 当前用户是否 admin（Codex stop-time review）。refresh(batch-probe) / zap(batch-render-check)
   * 端点为 `adminOnly` 守卫，moderator 无权——本页 moderator 可达，故非 admin 时禁用二键
   * （disable + tooltip，对齐 CrawlerSiteExpand / VideoRowActions 既有范式）。
   * more 菜单内 refetch-sources / disable-dead 为 `moderator+admin` 守卫，不受此门控。
   */
  readonly isAdmin: boolean
}

// ── styles ────────────────────────────────────────────────────────

/** icon 按钮样式；disabled（pending 或无权）时降透明 + not-allowed 光标。 */
function iconBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    width: '24px', height: '24px',
    border: '1px solid var(--border-default)',
    borderRadius: 'var(--radius-sm)',
    background: 'var(--bg-surface)',
    color: 'var(--fg-muted)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.45 : 1,
    fontSize: '12px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    lineHeight: 1,
  }
}

const ADMIN_ONLY_TITLE = '该操作需要管理员权限'

// ── helpers ───────────────────────────────────────────────────────

interface BatchSummary { readonly total: number; readonly ok: number; readonly dead: number; readonly failed: number }

/** batch summary → toast 描述（复用 SourceLinesExpand 口径）。okWord：'可访问' / '渲染正常' */
function summaryDesc(s: BatchSummary, okWord: string): string {
  if (s.dead === 0 && s.failed === 0) return `${s.total} 条线路${okWord}`
  return `${s.ok}/${s.total} ${okWord}${s.dead > 0 ? ` · ${s.dead} 失效` : ''}${s.failed > 0 ? ` · ${s.failed} 异常` : ''}`
}

// ── component ─────────────────────────────────────────────────────

export function SourceRowActions({ row, expanded, isAdmin, onExpandToggle, onReload }: SourceRowActionsProps) {
  const router = useRouter()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)

  // 通用异步执行：pending 守卫（禁用全部按钮）+ 收起菜单；task 内部各自 try/catch toast。
  const run = useCallback(async (task: () => Promise<void>) => {
    setPending(true)
    setOpen(false)
    try {
      await task()
    } finally {
      setPending(false)
    }
  }, [])

  const handleProbe = useCallback(() => run(async () => {
    try {
      const res = await batchProbeVideo(row.videoId)
      const issue = res.summary.dead > 0 || res.summary.failed > 0
      toast.push({ title: '重新探测完成', description: summaryDesc(res.summary, '可访问'), level: issue ? 'warn' : 'success' })
      onReload()
    } catch {
      toast.push({ title: '重新探测失败', description: `「${row.title}」探测请求未成功`, level: 'danger' })
    }
  }), [run, row.videoId, row.title, toast, onReload])

  const handleRenderCheck = useCallback(() => run(async () => {
    try {
      const res = await batchRenderCheckVideo(row.videoId)
      const issue = res.summary.dead > 0 || res.summary.failed > 0
      toast.push({ title: '重验播放完成', description: summaryDesc(res.summary, '渲染正常'), level: issue ? 'warn' : 'success' })
      onReload()
    } catch {
      toast.push({ title: '重验播放失败', description: `「${row.title}」试播请求未成功`, level: 'danger' })
    }
  }), [run, row.videoId, row.title, toast, onReload])

  const handleRefetch = useCallback(() => run(async () => {
    try {
      await refetchSources(row.videoId)
      toast.push({ title: '重新采集源', description: `已触发「${row.title}」的源重新采集`, level: 'success' })
      onReload()
    } catch {
      toast.push({ title: '重新采集失败', description: `「${row.title}」采集请求未成功`, level: 'danger' })
    }
  }), [run, row.videoId, row.title, toast, onReload])

  const handleDisableDead = useCallback(() => run(async () => {
    try {
      const res = await disableDeadSources(row.videoId)
      toast.push({
        title: '停用全失效源',
        description: res.disabled > 0 ? `已停用 ${res.disabled} 个失效源` : '没有需要停用的失效源',
        level: res.disabled > 0 ? 'success' : 'info',
      })
      onReload()
    } catch {
      toast.push({ title: '停用失败', description: `「${row.title}」停用请求未成功`, level: 'danger' })
    }
  }), [run, row.videoId, row.title, toast, onReload])

  // 条件菜单项：有失效源（连接 or 试播）才显示「停用全失效源」（无失效时无意义）
  const hasDeadSources = (row.connectFailCount ?? 0) + (row.renderFailCount ?? 0) > 0

  const items: AdminDropdownItem[] = [
    { key: 'toggle-expand', label: expanded ? '收起线路' : '展开线路矩阵', onClick: () => { setOpen(false); onExpandToggle(row.videoId) } },
    { key: 'refetch', label: '重新采集源', separator: true, onClick: handleRefetch },
  ]
  if (hasDeadSources) {
    items.push({ key: 'disable-dead', label: '停用全失效源', danger: true, onClick: handleDisableDead })
  }
  items.push({ key: 'aliases', label: '线路别名管理', separator: true, onClick: () => { setOpen(false); router.push('/admin/source-line-aliases') } })

  // 容器层 stopPropagation：三键与下拉触发器均不冒泡到行（避免触发 onRowClick 展开/收起）。
  // refresh/zap 为 adminOnly 端点 → 非 admin 禁用（Codex stop-time review）；more 菜单不门控。
  const probeDisabled = pending || !isAdmin
  return (
    <div style={{ display: 'flex', gap: '4px' }} onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        title={isAdmin ? '重新探测连接' : ADMIN_ONLY_TITLE}
        aria-label={`${row.title} 重新探测连接`}
        data-testid="source-row-probe"
        disabled={probeDisabled}
        style={iconBtnStyle(probeDisabled)}
        onClick={handleProbe}
      >↻</button>
      <button
        type="button"
        title={isAdmin ? '重验播放（试播）' : ADMIN_ONLY_TITLE}
        aria-label={`${row.title} 重验播放`}
        data-testid="source-row-render-check"
        disabled={probeDisabled}
        style={iconBtnStyle(probeDisabled)}
        onClick={handleRenderCheck}
      >⚡</button>
      <AdminDropdown
        open={open}
        trigger={
          <button
            type="button"
            title="更多操作"
            aria-label={`${row.title} 更多操作`}
            data-testid="source-row-more"
            disabled={pending}
            style={iconBtnStyle(pending)}
            onClick={() => setOpen((o) => !o)}
          >⋯</button>
        }
        items={items}
        onOpenChange={setOpen}
        align="right"
        data-testid="source-row-actions-dropdown"
      />
    </div>
  )
}
