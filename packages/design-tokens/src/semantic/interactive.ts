/**
 * 交互反馈语义槽位（CHG-UX-01 / SEQ-20260504-01）
 *
 * 与现有 surface/border/accent 的关系：
 *   - hoverSoft：弱透明叠加，跟随消费方 currentColor — ghost/icon button 在任何容器
 *     （topbar / surface-raised / surface-elevated）上都保持可见反差，且语义跟色
 *     （fg-default 元素 hover 出灰叠加；state-error fg 元素 hover 出红叠加）
 *   - hoverStrong：复用 --bg-surface-row（var 引用，主题切换自动跟随），保持
 *     现有 nav/menu/row 的视觉一致
 *   - pressSoft：active 反馈（mousedown / touchstart），强度 ≈ 2× hoverSoft
 *   - focusRingColor：focus-visible 焦点环颜色（指向 --border-focus）
 *   - focusRingWidth / Offset：focus-visible 焦点环尺寸
 *
 * 与 button.ts hover 状态契约的关系：
 *   - button.ts 是「按钮变体的完整状态包」（5 状态 × 4 variant × 3 size），
 *     消费方需通过 button-class / props 整体接入
 *   - interactive 槽位是「轻量交互叠加」，用于已有自定义样式的元素仅追加
 *     hover/focus/active 叠加层（admin-ui 全局规则消费）
 *
 * dark 与 light 的差异：
 *   - hoverSoft / pressSoft 的百分比 dark 略高（8% / 16% vs 6% / 12%），
 *     补偿 dark 模式下低对比度环境的视觉权重
 *   - hoverStrong / focusRingColor 通过 var() 引用上层槽位，主题切换时自动跟随
 */
export const interactive = {
  light: {
    hoverSoft: 'color-mix(in oklch, currentColor 6%, transparent)',
    hoverStrong: 'var(--bg-surface-row)',
    pressSoft: 'color-mix(in oklch, currentColor 12%, transparent)',
    focusRingColor: 'var(--border-focus)',
    focusRingWidth: '2px',
    focusRingOffset: '2px',
  },
  dark: {
    hoverSoft: 'color-mix(in oklch, currentColor 8%, transparent)',
    hoverStrong: 'var(--bg-surface-row)',
    pressSoft: 'color-mix(in oklch, currentColor 16%, transparent)',
    focusRingColor: 'var(--border-focus)',
    focusRingWidth: '2px',
    focusRingOffset: '2px',
  },
} as const

export type InteractiveTheme = keyof typeof interactive
export type InteractiveSlot = keyof typeof interactive.light
