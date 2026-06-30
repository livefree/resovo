/**
 * SlidingUnderline — 单条下划线随 activeKey 在子项间滑动（left + width transition）。
 * 「指示器层」，不渲染导航项本身——项由调用方在同一定位父容器内渲染，经 ref 注册上报几何。
 */
export interface SlidingUnderlineProps {
  /** 当前激活项 key。null = 无激活（下划线隐藏，不滑动）。 */
  readonly activeKey: string | null
  /** 项几何来源：(key → element) 映射。组件据 activeKey 取对应 element 测 offsetLeft/offsetWidth。 */
  readonly registry: ReadonlyMap<string, HTMLElement | null>
  /** 下划线厚度（px）。默认 2。 */
  readonly thicknessPx?: number
  /** 下划线颜色（CSS 变量名）。默认 'var(--accent-default)'。 */
  readonly color?: string
  /** 贴底偏移（下划线 bottom，CSS 长度，可传 token）。默认 '0'。 */
  readonly offset?: string
  /** 横向内缩（px）。下划线两端相对项宽各内缩此值。默认 0。 */
  readonly insetPx?: number
  /** 横向内缩百分比（相对项宽，二选一、优先于 insetPx）。 */
  readonly insetPercent?: number
  /** data-testid。 */
  readonly testId?: string
}

/** useUnderlineRegistry 返回：registry（传给 SlidingUnderline）+ register（绑到各项 ref）。 */
export interface UnderlineRegistryApi {
  readonly registry: ReadonlyMap<string, HTMLElement | null>
  /** 返回稳定的 per-key ref 回调（同 key 跨渲染同一函数实例，避免 ref 抖动重注册）。 */
  readonly register: (key: string) => (el: HTMLElement | null) => void
}
