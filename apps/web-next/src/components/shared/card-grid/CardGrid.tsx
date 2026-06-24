/**
 * CardGrid — 前台卡片尺寸体系网格容器（共享组件，ADR-214 D-214-7 + Amendment A2）
 *
 * **后继真源**：VideoGrid / BrowseGrid 网格布局的统一替代，取代 VideoGrid 的自由
 * `gridCols: string` 反模式（D-214-7 禁自由 gridCols 数字/串 prop）。
 *
 * **单一全局卡宽（Amendment A2 D-214-A2-1/2，推翻 A1 分档）**：全站卡片视觉精确一致——
 *   网格消费 CARD-SIZE-SSR 注入的全局 `--card-w` / `--card-gap`，
 *   轨道 `repeat(auto-fill, min(var(--card-w),100%))` 精确定宽（border-box 宽恒 = W），
 *   `justify-content: center` 居中留白（D-214-A2-2/3）。列数由容器宽 / W 派生，无显式列数概念。
 *
 * **响应式 + 防溢出契约**见 globals.css `.card-grid`（D-214-A2-2）：
 *   `min(var(--card-w),100%)` 保证窄于卡宽的容器（手机）不溢出；`> * { min-width:0 }` 防轨道被
 *   海报/长标题撑破（Codex-R2）。手机列数由 W 决定（W=160 → 2 列，D-214-A2-4）。
 *
 * **挂载契约**：须置于注入卡片尺寸 `:root` 变量的子树内（`[locale]/layout.tsx`，CARD-SIZE-SSR）。
 *   非注入子树下 `--card-w` 缺失时，globals.css `var(--card-w, 160px)` 兜底、不整条 grid 坍塌。
 *   children 应为同构卡片元素（VideoCard / VideoCard.Skeleton），非通用容器。
 *
 * **sizeClass 形状保留**（D-214-A2-6）：A2 收敛单值 `'global'`，保留 prop 形状以复用配置范式 +
 *   端点 `:sizeClass` param 不变；className `card-grid--global` 为语义锚点（核心网格规则落 `.card-grid` 基类）。
 */

import { cn } from '@/lib/utils'
import type { CardSizeClass } from '@resovo/types'

/** 网格档位（A2 收敛单值 'global'；保留类型形状，D-214-A2-6） */
export type GridCardSizeClass = Exclude<CardSizeClass, 'scroll'>

interface CardGridProps {
  /** 卡片尺寸档位（封闭枚举，A2 单值 'global'；禁自由 gridCols，D-214-7/A2-6） */
  sizeClass: GridCardSizeClass
  children: React.ReactNode
  className?: string
  'data-testid'?: string
}

export function CardGrid({ sizeClass, children, className, 'data-testid': testId }: CardGridProps) {
  return (
    <div className={cn('card-grid', `card-grid--${sizeClass}`, className)} data-testid={testId}>
      {children}
    </div>
  )
}
