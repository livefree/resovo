/**
 * line-health-drawer.types.ts — LineHealthDrawer 共享组件 Props 契约（CHG-SN-4-04 D-14 下沉清单第 2 件）
 *
 * 真源（按优先级）：
 *   1. M-SN-4 plan v1.4 §3 复用矩阵明列 "M-SN-4 下沉" — LineHealthDrawer 证据抽屉
 *   2. 子方案 `docs/designs/backend_design_v2.1/M-SN-4-04-admin-ui-shared-components-plan_20260502.md` §2.2
 *   3. plan v1.4 §3.1 GET `/admin/moderation/:id/line-health/:sourceId` 端点契约
 *   4. `@resovo/types` `SourceHealthEvent` / `DualSignalDisplayState`（CHG-SN-4-03 已就位）
 *
 * 业务语义：
 *   单条线路的健康事件历史（"证据"面板）— 复用 admin-ui Drawer 原语包壳，时间线展示
 *   probe / render check / feedback / circuit_breaker 事件，按 created_at desc 排列，
 *   每条含 origin / http_code / latency_ms / error_detail。
 *
 * 与 Drawer 关系：
 *   本组件**包壳**（compose）admin-ui Drawer 原语（packages/admin-ui/src/components/overlay/drawer.tsx），
 *   在 Drawer 内部渲染：标题（site + line label）→ 当前聚合状态（BarSignal）→ events 时间线 →
 *   分页（可选）。Drawer 自身的开关 / 关闭交互由本契约透传 `open` / `onClose`。
 *
 * 不变约束（packages/admin-ui v1）：
 *   - 颜色仅消费 packages/design-tokens
 *   - 零图标库依赖（事件 origin 图标 / 错误图标由消费方按需注入；本契约不强制图标）
 *   - Edge Runtime 兼容
 *   - 不下沉 i18n（文案 slot 由消费方注入；本契约保留默认中文兜底）
 */

import type { SourceHealthEvent, DualSignalDisplayState } from '@resovo/types'

/**
 * LineHealthDrawer 错误态描述（消费方传入）。
 */
export interface LineHealthDrawerError {
  readonly message: string
  readonly onRetry?: () => void
}

/**
 * LineHealthDrawer 分页配置（可选）。
 */
export interface LineHealthDrawerPagination {
  readonly page: number
  readonly total: number
  readonly limit: number
  readonly onPageChange: (page: number) => void
}

/**
 * LineHealthDrawer Props
 */
export interface LineHealthDrawerProps {
  /** Drawer 开关（受控） */
  readonly open: boolean

  /** 关闭回调；用户点击关闭按钮 / Esc / 遮罩点击触发 */
  readonly onClose: () => void

  /**
   * Drawer 标题；典型形态 `${siteName} · ${lineLabel}`，由消费方拼接。
   * 不下沉 i18n。
   */
  readonly title: string

  /** 当前聚合 probe 状态（用于头部 BarSignal 展示） */
  readonly probeState: DualSignalDisplayState

  /** 当前聚合 render 状态（用于头部 BarSignal 展示） */
  readonly renderState: DualSignalDisplayState

  /** events 列表；空数组 → Empty state */
  readonly events: readonly SourceHealthEvent[]

  /** 加载中（events 拉取中） */
  readonly loading?: boolean

  /** 错误态；非 null 时显示错误占位 + 重试按钮（如有 onRetry） */
  readonly error?: LineHealthDrawerError | null

  /** 分页配置；不传则不渲染分页栏 */
  readonly pagination?: LineHealthDrawerPagination

  /** Empty state 文案（默认 '暂无健康事件记录'）；不下沉 i18n，文案 slot */
  readonly emptyText?: string

  /** Loading 文案（默认 '加载中…'）；不下沉 i18n */
  readonly loadingText?: string

  /** 测试钩子 */
  readonly testId?: string
}
