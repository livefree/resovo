/**
 * CardGrid — 前台卡片尺寸体系网格容器（共享组件，ADR-214 D-214-7）
 *
 * **后继真源**：VideoGrid / BrowseGrid 网格布局的统一替代。sizeClass 封闭枚举读取
 * CARD-SIZE-SSR 注入的 DB 真源变量 `--card-cols-{class}-desktop` / `--card-gap-{class}`，
 * 取代 VideoGrid 的自由 `gridCols: string` 反模式（D-214-7 禁自由 gridCols 数字/串 prop）。
 * 后续 CARD-SIZE-BROWSE-MIGRATE / CARD-SIZE-FEATURED-NORMALIZE 卡迁移消费方至本组件，
 * 届时收敛 `VideoGrid.gridCols` 与 gap 真源分歧（`--card-gap-{class}` vs `--page-inline-gap`，D-214-8 框架）。
 *
 * **仅服务网格档（standard，唯一网格档；compact 经 Amendment A1 D-214-A1-3 废弃）**：
 * scroll 横滚非网格、无列概念，由 ScrollRow 独立处理。
 * 故 sizeClass 类型收紧为 `Exclude<CardSizeClass,'scroll'>`（= 'standard'）——对 D-214-7 字面 `sizeClass: CardSizeClass`
 * 的有意收紧（类型层挡住把 scroll 误传进网格，优于运行时忽略/抛错）。
 *
 * **响应式 + 防溢出契约**见 globals.css `.card-grid--standard`（D-214-7/10 + Amendment A1 D-214-A1-1/2）：
 *   mobile=2 / ≥640px=3 列（计数级联）；≥1024px=size-driven `auto-fill, minmax(min(--card-w-standard,200px),1fr)`
 *   （卡宽恒定最小、列数容器派生）；`> * { min-width:0 }` 防 1fr 轨道被海报/长标题撑破（Codex-R2）。
 *
 * **挂载契约**：须置于注入卡片尺寸 `:root` 变量的子树内（`[locale]/layout.tsx`，CARD-SIZE-SSR）。
 *   非注入子树下桌面列数变量缺失时，globals.css `var(--cg-cols, 2)` 兜底退 2 列、不整条 grid 坍塌。
 *   children 应为同构卡片元素（VideoCard / VideoCard.Skeleton），非通用容器（避免退化为 VideoGrid 式自由网格）。
 *
 * **新增网格档位**（D-214-2，须走 ADR amendment + migration）：同步改 4 处——
 *   ① @resovo/types CardSizeClass 枚举 ② DB seed ③ CARD-SIZE-SSR 注入 ④ globals.css `.card-grid--{class}`。
 */

import { cn } from '@/lib/utils'
import type { CardSizeClass } from '@resovo/types'

/** 网格档位（CardGrid 仅服务网格，排除横滚 scroll；D-214-7 收紧） */
export type GridCardSizeClass = Exclude<CardSizeClass, 'scroll'>

interface CardGridProps {
  /** 卡片尺寸档位（封闭枚举；禁自由 gridCols，D-214-7） */
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
