/**
 * TableSettingsTrigger — 表格设置触发器 + portal 浮动面板
 *
 * 复刻 AdminDropdown 的 createPortal + DOMRect + mousedown/Escape 模式。
 * 触发器为固定 ⋮ 按钮，面板右边缘对齐触发器。
 *
 * 参考：src/components/admin/shared/dropdown/AdminDropdown.tsx
 * 规则：docs/rules/ui-rules.md §浮层与 Portal 实现规范
 */

'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { TableSettingsPanel } from './TableSettingsPanel'
import type { ColumnRuntimeSetting } from './types'

interface MenuPosition {
  top: number
  right: number
}

function calcPosition(rect: DOMRect): MenuPosition {
  return {
    top: rect.bottom + window.scrollY + 4,
    right: window.innerWidth - rect.right,
  }
}

interface TableSettingsTriggerProps {
  columns: ColumnRuntimeSetting[]
  onToggle: (
    id: string,
    key: keyof Pick<ColumnRuntimeSetting, 'visible' | 'sortable'>,
    value: boolean,
  ) => void
  onReset: () => void
  /** 当前表格是否支持排序；false 时 TableSettingsPanel 隐藏排序列 */
  hasSorting?: boolean
  'data-testid'?: string
}

export function TableSettingsTrigger({
  columns,
  onToggle,
  onReset,
  hasSorting,
  'data-testid': testId,
}: TableSettingsTriggerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [pos, setPos] = useState<MenuPosition>({ top: 0, right: 0 })
  const triggerRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  // 关闭行为：点击外部（mousedown）+ Escape
  useEffect(() => {
    if (!isOpen) return

    function handleMouseDown(e: MouseEvent) {
      if (triggerRef.current?.contains(e.target as Node)) return
      if (panelRef.current?.contains(e.target as Node)) return
      setIsOpen(false)
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setIsOpen(false)
    }

    document.addEventListener('mousedown', handleMouseDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleMouseDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  function handleTriggerClick() {
    if (!triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    setPos(calcPosition(rect))
    setIsOpen((prev) => !prev)
  }

  const panel = isOpen ? (
    <div
      ref={panelRef}
      style={{
        position: 'absolute',
        top: pos.top,
        right: pos.right,
        zIndex: 50,
        minWidth: '240px',
        maxWidth: '320px',
      }}
      data-testid={testId ? `${testId}-panel` : undefined}
    >
      <TableSettingsPanel
        columns={columns}
        onToggle={onToggle}
        onReset={onReset}
        hasSorting={hasSorting}
        data-testid={testId ? `${testId}-content` : undefined}
      />
    </div>
  ) : null

  return (
    <div
      ref={triggerRef}
      className="relative inline-block"
      data-testid={testId}
      onClick={handleTriggerClick}
    >
      <button
        type="button"
        aria-label="表格设置"
        aria-expanded={isOpen}
        className={[
          'flex h-7 w-5 items-center justify-center rounded text-xs',
          'text-[var(--muted)] hover:bg-[var(--bg3)] hover:text-[var(--text)]',
          isOpen ? 'bg-[var(--bg3)] text-[var(--text)]' : '',
        ].join(' ')}
        data-testid={testId ? `${testId}-btn` : undefined}
      >
        ⋮
      </button>
      {typeof document !== 'undefined' && createPortal(panel, document.body)}
    </div>
  )
}
