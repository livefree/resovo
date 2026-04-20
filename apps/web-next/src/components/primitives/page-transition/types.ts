export interface PageTransitionProps {
  /**
   * 用于触发 React reconciliation 的 key，约定传入 pathname（含 locale，不含 search）。
   */
  transitionKey: string
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
