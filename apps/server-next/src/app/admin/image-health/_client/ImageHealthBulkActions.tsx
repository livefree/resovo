'use client'

/**
 * ImageHealthBulkActions.tsx — Tab B 治理工作台批量操作条（IMGH-P2-3B / SEQ-20260619-02）
 *
 * DataTable.bulkActions ReactNode 直传（CHG-DESIGN-02 Step 5 一体化，禁 v1 外置 SelectionActionBar）。
 * 仅 selection.size > 0 时渲染。两个动作（0A CONCERN-3 裁定：ADR 不支持 batch apply →
 *   不渲染「批量从候选补图」伪批量〔无死按钮〕，改渲染「打开候选队列」逐个处理入口）：
 *   ① 批量重扫选中 —— ADR-209 D-209-3 rescanSelectedVideos（真实 ids 端点，scoped 重扫）。
 *   ② 打开候选队列 —— 打开首个选中行的治理抽屉（逐个补图入口；选区保留，操作员依次处理）。
 */

import { useState, type CSSProperties } from 'react'
import { useToast } from '@resovo/admin-ui'
import { rescanSelectedVideos } from '@/lib/image-health/api'

const BTN_BASE_STYLE: CSSProperties = {
  height: 'var(--row-h-compact, 24px)',
  padding: '0 var(--button-padding-x)',
  borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--border-default)',
  background: 'var(--bg-surface)',
  color: 'var(--fg-default)',
  fontSize: 'var(--font-size-xs)',
  cursor: 'pointer',
  fontFamily: 'inherit',
}
const BTN_PRIMARY_STYLE: CSSProperties = {
  ...BTN_BASE_STYLE,
  border: '1px solid var(--accent-default)',
  background: 'var(--accent-default)',
  color: 'var(--fg-on-accent)',
  fontWeight: 500,
}
const BTN_DISABLED_STYLE: CSSProperties = { opacity: 0.5, cursor: 'not-allowed' }

export interface ImageHealthBulkActionsProps {
  readonly selectedKeys: ReadonlySet<string>
  /** 批量重扫成功后回调：父级 flash 受影响行 + 清空选区 + 刷新。 */
  readonly onResolved: (videoIds: readonly string[]) => void
  /** 打开候选队列：父级打开首个选中行的治理抽屉（逐个补图入口）。 */
  readonly onOpenQueue: (videoIds: readonly string[]) => void
}

export function ImageHealthBulkActions({ selectedKeys, onResolved, onOpenQueue }: ImageHealthBulkActionsProps) {
  const toast = useToast()
  const [pending, setPending] = useState(false)
  const ids = Array.from(selectedKeys)
  const count = ids.length

  const handleRescan = async () => {
    if (pending || count === 0) return
    setPending(true)
    try {
      const { updatedCount, enqueuedCount } = await rescanSelectedVideos(ids)
      const skipped = count - updatedCount
      toast.push({
        title: '已重扫选中封面',
        description:
          `已重置 ${updatedCount} 行 · 入队 ${enqueuedCount} 行巡检` +
          (skipped > 0 ? ` · ${skipped} 行无可重扫 URL 跳过` : ''),
        level: 'success',
      })
      onResolved(ids)
    } catch (err: unknown) {
      toast.push({
        title: '批量重扫失败',
        description: err instanceof Error ? err.message : '请稍后重试',
        level: 'danger',
      })
    } finally {
      setPending(false)
    }
  }

  return (
    <>
      <button
        type="button"
        style={pending || count === 0 ? { ...BTN_PRIMARY_STYLE, ...BTN_DISABLED_STYLE } : BTN_PRIMARY_STYLE}
        disabled={pending || count === 0}
        onClick={() => void handleRescan()}
        data-action-key="bulk-rescan"
      >
        批量重扫选中（{count}）
      </button>
      <button
        type="button"
        style={count === 0 ? { ...BTN_BASE_STYLE, ...BTN_DISABLED_STYLE } : BTN_BASE_STYLE}
        disabled={count === 0}
        onClick={() => onOpenQueue(ids)}
        data-action-key="bulk-open-queue"
        title="打开首个选中行的治理抽屉；选区保留，可依次逐个补图"
      >
        打开候选队列（{count}）
      </button>
    </>
  )
}
