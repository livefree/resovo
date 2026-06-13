/**
 * visually-hidden.ts — sr-only 视觉隐藏样式（admin-ui 唯一真源）
 * 真源：HDR-DEDUP 卡1（arch-reviewer claude-opus-4-8 CONDITIONAL PASS / C2）
 *
 * 用途：元素保留在 DOM 与可访问性树（供屏幕阅读器 / heading 导航），但视觉不可见。
 * 典型场景：页面正文标题降为 sr-only（顶栏面包屑作可见标题），仍维持「一页一个 h1」
 * 的 WCAG heading-order 契约。
 *
 * 不变约束（admin-ui 三不变）：
 *   - 零业务依赖（纯 CSSProperties 常量）
 *   - Edge Runtime 兼容（无运行时副作用）
 *   - 零硬编码颜色（无 color 字段）
 *
 * 采用 clip-rect 方案（与既有 sr-only 先例一致，全目标浏览器有效）；
 * 一致性优先于「更现代」（未切 clip-path）。
 */
import type { CSSProperties } from 'react'

export const VISUALLY_HIDDEN_STYLE: CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
  border: 0,
}
