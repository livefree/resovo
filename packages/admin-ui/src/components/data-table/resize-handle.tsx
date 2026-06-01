'use client'

/**
 * resize-handle.tsx — DataTable 列宽拖拽分割线（DTR-B / SEQ-20260531-01）
 *
 * 仅在表头列名之间渲染（需求 (2)：body 无竖线）。`role="separator"` + 完整 a11y +
 * 键盘可达。交互通过 Pointer Events 全生命周期实现，drag 期间**不 setState**——
 * 经 `onPreview` 命令式改 `--dt-grid-template`（rAF 节流），仅在 `pointerup` 提交。
 *
 * arch-reviewer C6：handle 五事件（pointerdown/move/up/cancel + keydown + click/dblclick）
 * 全 `stopPropagation`，阻断冒泡到表头列名 toggle 排序（参 data-table-header-row ⋯ 按钮范式）。
 */
import React, { useCallback, useEffect, useRef } from 'react'

const KEY_STEP = 8
const KEY_STEP_LARGE = 32
const RESIZING_BODY_ATTR = 'data-dt-resizing'

export interface ColumnResizeHandleProps {
  readonly colId: string
  /** 当前已提交列宽（px）——aria-valuenow + 键盘步进基准。 */
  readonly width: number
  readonly minWidth: number
  readonly maxWidth?: number
  /** 列名（aria-label 文案；非字符串列回退 colId）。 */
  readonly columnLabel: string
  /** 拖拽预览：命令式改 `--dt-grid-template`（不提交 / 不持久化）。 */
  readonly onPreview: (colId: string, width: number) => void
  /** 提交列宽：pointerup / 键盘步进 / auto-fit 后写入 query.columns。 */
  readonly onCommit: (colId: string, width: number) => void
  /** 回滚预览到已提交值（pointercancel / lostpointercapture）。 */
  readonly onRollback: () => void
  /** 双击 auto-fit：按当前渲染页内容测宽提交。 */
  readonly onAutoFit: (colId: string) => void
}

interface DragState {
  readonly pointerId: number
  readonly startX: number
  readonly startWidth: number
  latest: number
}

export function ColumnResizeHandle({
  colId,
  width,
  minWidth,
  maxWidth,
  columnLabel,
  onPreview,
  onCommit,
  onRollback,
  onAutoFit,
}: ColumnResizeHandleProps): React.ReactElement {
  const dragRef = useRef<DragState | null>(null)
  const rafRef = useRef<number | null>(null)

  const clamp = useCallback(
    (w: number): number => {
      let v = Math.max(minWidth, w)
      if (maxWidth !== undefined && Number.isFinite(maxWidth)) v = Math.min(v, Math.max(maxWidth, minWidth))
      return Math.round(v)
    },
    [minWidth, maxWidth],
  )

  const cancelRaf = useCallback(() => {
    if (rafRef.current !== null && typeof cancelAnimationFrame !== 'undefined') {
      cancelAnimationFrame(rafRef.current)
    }
    rafRef.current = null
  }, [])

  const clearResizingFlag = useCallback(() => {
    if (typeof document !== 'undefined') document.body.removeAttribute(RESIZING_BODY_ATTR)
  }, [])

  const flushPreview = useCallback(() => {
    rafRef.current = null
    const d = dragRef.current
    if (d !== null) onPreview(colId, d.latest)
  }, [colId, onPreview])

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLSpanElement>) => {
      // 仅主键（鼠标左键 / 触摸 / 笔）；右键 / 中键不触发拖拽
      if (e.button !== 0) return
      e.preventDefault()
      e.stopPropagation()
      e.currentTarget.setPointerCapture?.(e.pointerId)
      dragRef.current = { pointerId: e.pointerId, startX: e.clientX, startWidth: width, latest: width }
      if (typeof document !== 'undefined') document.body.setAttribute(RESIZING_BODY_ATTR, 'true')
    },
    [width],
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLSpanElement>) => {
      const d = dragRef.current
      if (d === null || e.pointerId !== d.pointerId) return
      e.stopPropagation()
      d.latest = clamp(d.startWidth + (e.clientX - d.startX))
      if (typeof requestAnimationFrame === 'undefined') {
        onPreview(colId, d.latest) // 无 rAF 环境（jsdom）兜底同步预览
      } else if (rafRef.current === null) {
        rafRef.current = requestAnimationFrame(flushPreview)
      }
    },
    [clamp, colId, onPreview, flushPreview],
  )

  const onPointerUp = useCallback(
    (e: React.PointerEvent<HTMLSpanElement>) => {
      const d = dragRef.current
      if (d === null || e.pointerId !== d.pointerId) return
      e.stopPropagation()
      const final = d.latest
      dragRef.current = null
      cancelRaf()
      clearResizingFlag()
      onCommit(colId, final)
    },
    [colId, onCommit, cancelRaf, clearResizingFlag],
  )

  // pointercancel + lostpointercapture 共用：drag 仍在进行 → 回滚预览
  const onPointerAbort = useCallback(
    (e: React.PointerEvent<HTMLSpanElement>) => {
      const d = dragRef.current
      if (d === null) return // 正常 pointerup 释放 capture 触发的 lostpointercapture：已 null，no-op
      e.stopPropagation()
      dragRef.current = null
      cancelRaf()
      clearResizingFlag()
      onRollback()
    },
    [onRollback, cancelRaf, clearResizingFlag],
  )

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLSpanElement>) => {
      let next: number | null = null
      const step = e.shiftKey ? KEY_STEP_LARGE : KEY_STEP
      switch (e.key) {
        case 'ArrowLeft':
          next = clamp(width - step)
          break
        case 'ArrowRight':
          next = clamp(width + step)
          break
        case 'Home':
          next = clamp(minWidth)
          break
        case 'End':
          // 未定义 maxWidth → no-op（不触发 auto-fit）
          if (maxWidth !== undefined && Number.isFinite(maxWidth)) next = clamp(maxWidth)
          break
        default:
          return // 其它键不拦截
      }
      e.preventDefault()
      e.stopPropagation()
      if (next !== null) onCommit(colId, next)
    },
    [width, minWidth, maxWidth, clamp, colId, onCommit],
  )

  const onDoubleClick = useCallback(
    (e: React.MouseEvent<HTMLSpanElement>) => {
      e.preventDefault()
      e.stopPropagation()
      onAutoFit(colId)
    },
    [colId, onAutoFit],
  )

  // 单击不应触发表头排序（C6）；双击由浏览器拆为两次 click + dblclick，均吞掉
  const onClick = useCallback((e: React.MouseEvent<HTMLSpanElement>) => {
    e.stopPropagation()
  }, [])

  // 卸载清理：取消 pending rAF + 解除 body resizing 标记（防 drag 中途卸载残留）
  useEffect(
    () => () => {
      cancelRaf()
      if (dragRef.current !== null) clearResizingFlag()
    },
    [cancelRaf, clearResizingFlag],
  )

  return (
    <span
      role="separator"
      aria-orientation="vertical"
      aria-label={`调整列宽：${columnLabel}`}
      aria-valuenow={width}
      aria-valuemin={minWidth}
      aria-valuemax={maxWidth}
      tabIndex={0}
      data-dt-resize-handle
      data-col-id={colId}
      data-testid={`dt-resize-handle-${colId}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerAbort}
      onLostPointerCapture={onPointerAbort}
      onKeyDown={onKeyDown}
      onDoubleClick={onDoubleClick}
      onClick={onClick}
    />
  )
}
