/**
 * ScrollRow — 前台卡片尺寸体系横滚布局原语（共享组件，ADR-214 Amendment A1 D-214-A1-6 + A2 D-214-A2-7）
 *
 * **平级 CardGrid**：CardGrid 服务网格（auto-fit 精确定宽 + 居中）；ScrollRow 服务横滚（flex 定宽 + 左对齐起点）。
 * 横滚行布局统一原语——容器 flex + overflow-x + scroll-snap，每个 child 自动包裹为定宽 item。
 * **A2 单一全局卡宽**：消费 CARD-SIZE-SSR 经 `[locale]/layout.tsx` **全局 `:root`** 注入的全局变量
 * `--card-w`（卡定宽）/ `--card-gap`（间距），与网格区同源 → 全站卡片 border-box 宽精确一致；
 * `card-size-fetch` helper 内置 `CARD_SIZE_DEFAULTS` 降级，生产恒有值。
 *
 * **消费方**：详情页 / 播放页「一行相关视频横滚」（CARD-SIZE-A1-DETAIL / -WATCH）。
 *   首页三横滚行迁移消重为可选后续（#8，不进本轮关键路径、避免动 Shelf 回归）。
 *
 * **children 契约**：必须是**同构卡片元素的数组或并列 element**（VideoCard 列表，如 `videos.map(...)`）。
 *   ScrollRow 用 `React.Children.map` 把每个 child 包裹为 `.scroll-row__item`（定宽 + flex-shrink:0 +
 *   scroll-snap-align），消费方无需自己设横滚卡宽。
 *   **禁止顶层 Fragment 包裹多卡**（`<><A/><B/></>` 会被当单个 child 塞进同一 item 致错位/宽度坍叠）——
 *   传数组（map 返回）或并列 element 即可（React.Children.map 自动展平 + 加稳定 key）。
 *
 * **无字面兜底取舍（arch-reviewer MEDIUM）**：变量经全局 `:root` 注入 + helper 降级、生产恒有值；
 *   `.scroll-row__item` 仅加渲染韧性兜底 `var(--card-w, 160px)`（160=A2 全局默认，对齐
 *   CardGrid 防御姿态，消除非注入子树/Storybook/隔离单测下卡宽飘移）——
 *   兜底为渲染韧性、非配置真源（不违 D-214-5）；缺兜底的退化形态仅"卡宽变内容宽、横滚仍可用"。
 *
 * **可达性（arch-reviewer HIGH / WCAG 2.1.1）**：容器 `tabIndex=0` + `role="region"` + 必填 `aria-label`——
 *   隐藏滚动条 + 无 nav 下，键盘/纯鼠标用户经 Tab 聚焦 + 方向键滚动访问首屏外卡片。左右翻页按钮为后续增强（#8）。
 *
 * **非职责**：空槽补足（Shelf MIN_SLOTS 不变量）非本原语职责，由消费方自理（#8 首页迁移勿当回归）。
 */

import React from 'react'
import { cn } from '@/lib/utils'

interface ScrollRowProps {
  /** 同构卡片元素的数组或并列 element（VideoCard 列表）；每个被包裹为定宽 `.scroll-row__item`。禁顶层 Fragment 聚合多卡。 */
  children: React.ReactNode
  /** 横滚区块无障碍标签（role=region landmark，屏幕阅读器定位 + 键盘可达），消费方传本地化文案如「相关视频」 */
  'aria-label': string
  className?: string
  'data-testid'?: string
}

export function ScrollRow({
  children,
  'aria-label': ariaLabel,
  className,
  'data-testid': testId,
}: ScrollRowProps) {
  return (
    <div
      className={cn('scroll-row', className)}
      role="region"
      aria-label={ariaLabel}
      tabIndex={0}
      data-testid={testId}
    >
      {React.Children.map(children, (child) =>
        child == null ? null : <div className="scroll-row__item">{child}</div>,
      )}
    </div>
  )
}
