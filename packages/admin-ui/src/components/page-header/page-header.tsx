'use client'

/**
 * page-header.tsx — 页面顶栏通用原语
 * 真源：reference §5（CHG-SN-5-PRE-03-A / SEQ-20260506-02 / M-SN-5.5）
 *
 * 用途：所有 admin 列表 / 看板 / 设置页的 page__head 统一壳，承载
 * title / subtitle / actions 三 slot。消费方传入 ReactNode；颜色 / 间距 /
 * 字号全部来自 design-tokens var()，零硬编码颜色。
 *
 * 不变约束：
 *   - 零业务视图消费（本卡范围 packages/admin-ui，禁止 import 任何 server-next 类型）
 *   - 不引入 BrandProvider / ThemeProvider（继承外层 Context）
 *   - Edge Runtime 兼容（无 fetch / Cookie / localStorage 顶层调用）
 *
 * 视觉契约（reference §4.2 / §5）：
 *   - 容器：display:flex, justify-content:space-between, align-items:flex-start, gap:16px, flex-shrink:0
 *   - title：var(--font-size-lg), 700, var(--fg-default), line-height 1.3, margin 0
 *   - subtitle：var(--font-size-xs), var(--fg-muted), margin-top 4px
 *   - actions：flex, gap 8px, align-items:center, flex-shrink 0
 */

import React from 'react'
import { VISUALLY_HIDDEN_STYLE } from './visually-hidden'

export interface PageHeaderProps {
  /** 主标题。string 渲染成 <h{headingLevel}>；ReactNode 直接渲染 */
  readonly title: React.ReactNode
  /** 副标题（一句话说明 / 计数）；string 包到 <p>，ReactNode 直接渲染 */
  readonly subtitle?: React.ReactNode
  /** 右侧操作区（按钮组 / 切换 / 全屏入口等） */
  readonly actions?: React.ReactNode
  /**
   * 标题语义级别（仅 string 类型 title 时生效）。默认 1。
   * 一页应只有一个 headingLevel=1 的 PageHeader（WCAG heading-order）；
   * 嵌套子区块请显式传 2-6。
   */
  readonly headingLevel?: 1 | 2 | 3 | 4 | 5 | 6
  /**
   * 视觉隐藏主标题（保留 a11y）。默认 false。
   * - **仅对 string title（`<h{headingLevel}>` 分支）生效**：标题仍渲染于 DOM 与
   *   可访问性树（维持「一页一个 h{headingLevel}」WCAG heading-order），但套用
   *   sr-only 样式（VISUALLY_HIDDEN_STYLE）使其视觉不可见。用于「顶栏面包屑已作
   *   可见标题，h1 仅供屏幕阅读器 / heading 导航」的页面。
   * - **ReactNode title 不受此 prop 影响**（保持可见渲染；ReactNode 容器非语义标题，
   *   且常承载交互内容如快捷筛选 / 动态问候，不应隐藏）。
   * - **不影响 subtitle / actions**（照常正常可见渲染）。
   */
  readonly titleVisuallyHidden?: boolean
  /**
   * 容器标签。默认 `'header'`（语义元素，对齐 reference §5 既有消费方）。
   * 嵌套区块或主区域内子页头建议传 `'section'` / `'div'`（避免 nested header）。
   */
  readonly as?: 'div' | 'header' | 'section'
  /**
   * 容器 ARIA role（默认 **不设**，由 `as` 元素的隐式语义承载）。
   * 仅当 PageHeader 作为页面唯一顶栏地标时建议显式传 `'banner'`；
   * 嵌入 `<main>` 等区域内则不应传 `'banner'`（违反 WAI-ARIA "一文档最多一个 banner"）。
   */
  readonly role?: string
  /** 容器 a11y 标签（默认无） */
  readonly 'aria-label'?: string
  /** 容器测试 id */
  readonly 'data-testid'?: string
}

const ROOT_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: '16px',
  flexShrink: 0,
}

const MAIN_STYLE: React.CSSProperties = {
  minWidth: 0,
  flex: '1 1 auto',
}

const TITLE_STYLE: React.CSSProperties = {
  margin: 0,
  fontSize: 'var(--font-size-lg)',
  fontWeight: 700,
  color: 'var(--fg-default)',
  lineHeight: 1.3,
}

const SUBTITLE_STYLE: React.CSSProperties = {
  margin: '4px 0 0',
  fontSize: 'var(--font-size-xs)',
  color: 'var(--fg-muted)',
}

const ACTIONS_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  flexShrink: 0,
}

export function PageHeader({
  title,
  subtitle,
  actions,
  headingLevel = 1,
  titleVisuallyHidden = false,
  as: As = 'header',
  role,
  'aria-label': ariaLabel,
  'data-testid': testId,
}: PageHeaderProps): React.ReactElement {
  const HeadingTag = (`h${headingLevel}` as unknown) as keyof React.JSX.IntrinsicElements
  // C3：titleVisuallyHidden 仅作用于 string title（heading 分支）；ReactNode title 不受影响
  const headingStyle = titleVisuallyHidden ? { ...TITLE_STYLE, ...VISUALLY_HIDDEN_STYLE } : TITLE_STYLE
  return (
    <As
      data-page-header
      role={role}
      aria-label={ariaLabel}
      data-testid={testId}
      style={ROOT_STYLE}
    >
      <div data-page-header-main style={MAIN_STYLE}>
        {typeof title === 'string'
          ? <HeadingTag style={headingStyle} data-page-header-title>{title}</HeadingTag>
          : <div style={TITLE_STYLE} data-page-header-title>{title}</div>}
        {subtitle !== undefined && subtitle !== null && (
          typeof subtitle === 'string'
            ? <p style={SUBTITLE_STYLE} data-page-header-subtitle>{subtitle}</p>
            : <div style={SUBTITLE_STYLE} data-page-header-subtitle>{subtitle}</div>
        )}
      </div>
      {actions !== undefined && actions !== null && (
        <div data-page-header-actions style={ACTIONS_STYLE}>{actions}</div>
      )}
    </As>
  )
}
