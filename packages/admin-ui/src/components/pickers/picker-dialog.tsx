'use client'

/**
 * picker-dialog.tsx — VideoPicker 搜索 + 列表 + 操作栏 Dialog
 *
 * 真源：M-SN-SHARED-04-A
 *  - 搜索 debounce 300ms（业界标准）
 *  - AbortSignal abort 上一次 fetcher
 *  - DialogState 5 态状态机（idle/loading/results/empty/error）
 *  - multi 模式 staging selection（dialog 内挑完点确认才回写）
 */

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Modal } from '../overlay/modal'
import { EmptyState } from '../state/empty-state'
import { AdminButton } from '../admin-button/admin-button'
import { AdminInput } from '../admin-input/admin-input'
import { PickerResultRow } from './picker-result-row'
import type {
  DialogState,
  PickerVideoItem,
  VideoPickerFetcher,
  VideoPickerFilter,
} from './video-picker.types'

const SEARCH_DEBOUNCE_MS = 300
const DEFAULT_LIMIT = 20

export interface PickerDialogProps {
  readonly open: boolean
  readonly multiple: boolean
  readonly initialSelection: readonly PickerVideoItem[]
  readonly max?: number
  readonly title: React.ReactNode
  readonly fetcher: VideoPickerFetcher
  readonly filter?: VideoPickerFilter
  readonly onConfirm: (items: readonly PickerVideoItem[]) => void
  readonly onClose: () => void
  readonly 'data-testid'?: string
}

const BODY_STYLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '10px',
  minHeight: '320px',
}

const LIST_STYLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
  maxHeight: '360px',
  overflowY: 'auto',
}

const FOOTER_STYLE: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '12px 20px',
  borderTop: '1px solid var(--border-subtle)',
}

const FOOTER_META: CSSProperties = {
  fontSize: '11px',
  color: 'var(--fg-muted)',
}

const RETRY_BOX: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
  alignItems: 'center',
  padding: '24px 12px',
}

export function PickerDialog({
  open,
  multiple,
  initialSelection,
  max,
  title,
  fetcher,
  filter,
  onConfirm,
  onClose,
  ...rest
}: PickerDialogProps) {
  const [q, setQ] = useState('')
  const [dialogState, setDialogState] = useState<DialogState>({ kind: 'idle' })
  const [staging, setStaging] = useState<readonly PickerVideoItem[]>(initialSelection)
  const [activeIndex, setActiveIndex] = useState(0)
  const abortRef = useRef<AbortController | null>(null)
  const dialogBodyRef = useRef<HTMLDivElement>(null)
  const testid = rest['data-testid']

  // 打开时复位 staging + 聚焦搜索框
  useEffect(() => {
    if (open) {
      setStaging(initialSelection)
      setQ('')
      setDialogState({ kind: 'idle' })
      setActiveIndex(0)
      // setTimeout 0 让 Portal 挂载完成后再 focus
      const t = window.setTimeout(() => {
        const input = dialogBodyRef.current?.querySelector('input')
        input?.focus()
      }, 0)
      return () => window.clearTimeout(t)
    }
    // 关闭时 abort 任何在飞的 fetch
    return () => {
      if (abortRef.current) {
        abortRef.current.abort()
        abortRef.current = null
      }
    }
  }, [open, initialSelection])

  // debounced search
  useEffect(() => {
    if (!open) return
    const handle = window.setTimeout(() => {
      void runFetch(q, undefined)
    }, q ? SEARCH_DEBOUNCE_MS : 0)
    return () => window.clearTimeout(handle)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, q])

  const runFetch = useCallback(
    async (query: string, cursor: string | undefined) => {
      // abort previous
      if (abortRef.current) {
        abortRef.current.abort()
      }
      const ctrl = new AbortController()
      abortRef.current = ctrl
      setDialogState({ kind: 'loading', cursor })
      try {
        const res = await fetcher({ q: query, limit: DEFAULT_LIMIT, cursor, filter, signal: ctrl.signal })
        if (ctrl.signal.aborted) return
        if (res.items.length === 0) {
          setDialogState({ kind: 'empty' })
        } else {
          setDialogState({ kind: 'results', items: res.items, nextCursor: res.nextCursor })
          setActiveIndex(0)
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return
        const message = err instanceof Error ? err.message : '加载失败'
        setDialogState({ kind: 'error', message })
      }
    },
    [fetcher, filter],
  )

  const items = dialogState.kind === 'results' ? dialogState.items : []
  const stagingIds = useMemo(() => new Set(staging.map((s) => s.id)), [staging])

  const toggle = useCallback(
    (item: PickerVideoItem) => {
      if (multiple) {
        setStaging((prev) => {
          const exists = prev.some((p) => p.id === item.id)
          if (exists) return prev.filter((p) => p.id !== item.id)
          if (max != null && prev.length >= max) return prev
          return [...prev, item]
        })
      } else {
        // single：toggle 即确认
        onConfirm([item])
      }
    },
    [multiple, max, onConfirm],
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (items.length === 0) return
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveIndex((i) => Math.min(items.length - 1, i + 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveIndex((i) => Math.max(0, i - 1))
      } else if (e.key === 'Enter' || (multiple && e.shiftKey && e.key === 'Enter')) {
        e.preventDefault()
        if (multiple && e.shiftKey) {
          onConfirm(staging)
          return
        }
        const current = items[activeIndex]
        if (current) {
          if (multiple) {
            toggle(current)
          } else {
            onConfirm([current])
          }
        }
      } else if (multiple && e.key === ' ') {
        e.preventDefault()
        const current = items[activeIndex]
        if (current) toggle(current)
      }
    },
    [items, activeIndex, multiple, staging, toggle, onConfirm],
  )

  const handleConfirmMulti = useCallback(() => {
    onConfirm(staging)
  }, [onConfirm, staging])

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title={title}
      closeOnEscape
      closeOnBackdropClick
      data-testid={testid ? `${testid}-dialog` : undefined}
    >
      <div style={BODY_STYLE} ref={dialogBodyRef} onKeyDown={handleKeyDown}>
        <AdminInput
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="搜索标题 / shortId / 年份…"
          aria-label="搜索视频"
          data-testid={testid ? `${testid}-search` : undefined}
        />
        <div role="listbox" aria-label="搜索结果" style={LIST_STYLE} data-testid={testid ? `${testid}-list` : undefined}>
          {dialogState.kind === 'loading' && (
            <div style={{ padding: '24px 12px', textAlign: 'center', color: 'var(--fg-muted)', fontSize: '12px' }}>
              加载中…
            </div>
          )}
          {dialogState.kind === 'empty' && (
            <div data-testid={testid ? `${testid}-empty` : undefined}>
              <EmptyState
                title="未找到匹配的视频"
                description="请尝试不同关键词或调整外部过滤条件"
              />
            </div>
          )}
          {dialogState.kind === 'error' && (
            <div style={RETRY_BOX} data-testid={testid ? `${testid}-error` : undefined}>
              <span style={{ color: 'var(--state-danger-fg, var(--state-danger))', fontSize: '12px' }}>
                加载失败：{dialogState.message}
              </span>
              <AdminButton size="sm" variant="default" onClick={() => void runFetch(q, undefined)}>
                重试
              </AdminButton>
            </div>
          )}
          {dialogState.kind === 'results' &&
            dialogState.items.map((item, idx) => (
              <PickerResultRow
                key={item.id}
                item={item}
                active={idx === activeIndex}
                selected={stagingIds.has(item.id)}
                multiple={multiple}
                onActivate={() => setActiveIndex(idx)}
                onToggle={() => toggle(item)}
                data-testid={testid ? `${testid}-row-${item.id}` : undefined}
              />
            ))}
        </div>
      </div>
      {multiple && (
        <div style={FOOTER_STYLE}>
          <span style={FOOTER_META}>
            已选 {staging.length}
            {max != null ? ` / ${max}` : ''}
          </span>
          <span style={{ display: 'inline-flex', gap: 8 }}>
            <AdminButton size="sm" variant="default" onClick={onClose} data-testid={testid ? `${testid}-cancel` : undefined}>
              取消
            </AdminButton>
            <AdminButton size="sm" variant="primary" onClick={handleConfirmMulti} data-testid={testid ? `${testid}-confirm` : undefined}>
              确认
            </AdminButton>
          </span>
        </div>
      )}
    </Modal>
  )
}
