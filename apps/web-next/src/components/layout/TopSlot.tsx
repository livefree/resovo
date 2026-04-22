import type { ReactNode } from 'react'

interface TopSlotProps {
  children: ReactNode
  className?: string
}

/**
 * 顶部内容槽 —— Header 下方、视频网格上方。
 * 首页放 Banner，分类页放筛选栏。
 * view-transition-name 使 Sibling 过渡期间高度/内容动画由 View Transitions API 处理（§11.1-§11.4）。
 */
export function TopSlot({ children, className }: TopSlotProps) {
  return (
    <div
      className={className}
      style={{ viewTransitionName: 'top-slot' } as React.CSSProperties}
    >
      {children}
    </div>
  )
}
