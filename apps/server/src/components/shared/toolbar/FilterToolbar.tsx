/**
 * FilterToolbar.tsx — 通用筛选工具栏（shared/toolbar 层）
 * CHG-320: 四槽布局：search（搜索输入）+ filters（筛选控件）+ actions（操作按钮）+ feedback（状态反馈）
 *
 * 布局：[search] [filters]                              [actions] [feedback]
 */

import type { ReactNode } from 'react'

// ── 类型 ─────────────────────────────────────────────────────────

export interface FilterToolbarProps {
  /** 搜索输入区（左侧第一位） */
  search?: ReactNode
  /** 筛选控件区（select、checkbox 等，紧随搜索区） */
  filters?: ReactNode
  /** 操作按钮区（右对齐） */
  actions?: ReactNode
  /** 状态反馈区（最右侧，如选中数量、加载状态） */
  feedback?: ReactNode
  className?: string
  testId?: string
}

// ── Component ────────────────────────────────────────────────────

export function FilterToolbar({
  search,
  filters,
  actions,
  feedback,
  className,
  testId,
}: FilterToolbarProps) {
  const hasLeft = search != null || filters != null
  const hasRight = actions != null || feedback != null

  return (
    <div
      className={[
        'flex flex-wrap items-center gap-3',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      data-testid={testId ?? 'filter-toolbar'}
    >
      {/* 左区：搜索 + 筛选 */}
      {hasLeft ? (
        <div className="flex flex-1 flex-wrap items-center gap-2">
          {search}
          {filters}
        </div>
      ) : null}

      {/* 右区：操作 + 反馈 */}
      {hasRight ? (
        <div className="ml-auto flex shrink-0 items-center gap-2">
          {actions}
          {feedback}
        </div>
      ) : null}
    </div>
  )
}
