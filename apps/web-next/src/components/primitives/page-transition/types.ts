/**
 * 页面切换动效变体。
 * - 'default'：View Transitions API crossfade（全页面快照过渡）
 * - 'sibling'：同层平移 —— CSS fade-in 160ms，PC 端 stagger；用于首页 ↔ 分类页切换（§9.1）
 */
export type PageTransitionVariant = 'default' | 'sibling'

export interface PageTransitionProps {
  /**
   * 用于触发 React reconciliation 的 key，约定传入 pathname（含 locale，不含 search）。
   */
  transitionKey: string
  /**
   * 动效变体，默认 'default'。
   */
  variant?: PageTransitionVariant
  /**
   * 动画时长 CSS 变量名，默认 '--transition-page'。
   */
  durationVar?: `--${string}`
  /**
   * 缓动函数 CSS 变量名，默认 '--ease-page'。
   */
  easingVar?: `--${string}`
  /**
   * 禁用动画（即使浏览器支持），用于演示页 A/B 对比。
   */
  disabled?: boolean
  children: React.ReactNode
}

export interface PageTransitionHandle {
  skip: () => void
  isTransitioning: () => boolean
}
