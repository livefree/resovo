import type { ReactNode } from 'react'

/** 单个菜单项。Link 渲染（client-side 导航），非按钮动作。 */
export interface DropdownMenuItem {
  /** 稳定唯一键，用于 React key + data-testid 后缀 */
  readonly key: string
  /** 已本地化的可见文本（i18n 由调用方完成，组件不碰 useTranslations） */
  readonly label: string
  /** next/link href（绝对路径，调用方拼好 locale） */
  readonly href: string
  /** 该项是否为当前路由（菜单内高亮，非 trigger 下划线） */
  readonly active?: boolean
  /** 可选 data-testid 完整值；省略则用 `${testIdPrefix}-${key}` */
  readonly testId?: string
}

/** hover-intent 双延时（毫秒）。省略走组件默认值。 */
export interface DropdownHoverIntent {
  /** 指针进入 → 展开延时。默认 120。 */
  readonly openDelayMs?: number
  /** 指针离开 → 收起延时。默认 240（> NavMoreMenu 旧值 200，更稳）。 */
  readonly closeDelayMs?: number
}

/** 回传给 trigger render-prop 的受控状态（trigger 据此渲染 chevron / 视觉态 + 绑定 toggle）。 */
export interface DropdownTriggerState {
  readonly open: boolean
  /**
   * 触屏/键盘 toggle 入口。trigger 必须把它绑到可点击元素的 onClick。
   * （hover-intent 由组件 wrapper 的 onMouseEnter/Leave 处理，trigger 不管。）
   */
  readonly toggle: () => void
}

export interface DropdownMenuProps {
  /**
   * Trigger slot（render-prop）。调用方提供按钮/链接外观（含 active 下划线、chevron）。
   * 组件回传 `{ open, toggle }` 使 trigger 能渲染 chevron 旋转 / 绑定触屏点击；
   * aria-haspopup/expanded/controls 由组件注入到 trigger 外层 wrapper。
   */
  readonly trigger: (state: DropdownTriggerState) => ReactNode
  /** 菜单项列表。数据驱动，组件统一渲染 role=menuitem + Link。 */
  readonly items: readonly DropdownMenuItem[]
  /** 开合回调（trigger 侧 aria / 埋点同步）。 */
  readonly onOpenChange?: (open: boolean) => void
  /** hover-intent 延时覆盖。默认见 DropdownHoverIntent 注释。 */
  readonly hoverIntent?: DropdownHoverIntent
  /** 菜单面板对齐边。默认 'start'（用逻辑属性 inset-inline-start，RTL 安全）。 */
  readonly align?: 'start' | 'end'
  /** 面板最小宽度（px）。默认 180。 */
  readonly minWidthPx?: number
  /** data-testid 前缀，用于 panel（`${prefix}-menu`）/ item（`${prefix}-${key}`）。必填以保证可测。 */
  readonly testIdPrefix: string
  /** 透传 wrapper className（定位上下文用）。 */
  readonly className?: string
}
