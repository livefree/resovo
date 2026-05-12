/**
 * state-fg-on-soft.ts — theme-aware text colors for use on state alpha-soft backgrounds.
 *
 * 真源：CHG-SN-5-PRE-01-E-2-followup-4（Codex stop-time review round 10 / 2026-05-12）
 *
 * **设计意图**：state.ts 的 `bg`（14% alpha-soft 软底）+ `fg`（colors.{kind}.base mid 色文字）
 * 组合在两个 theme 下 contrast 不对称——
 *   - dark theme：base mid 色 text on dark page 加 14% 软底 → contrast ~5 AA pass
 *   - light theme：base mid 色 text on white page 加 14% 软底 → contrast ~2-4 AA fail
 *
 * 本模块给"在 alpha-soft 软底上"的 text 颜色提供 **theme-aware** 选择：
 *   - light theme：用 `.dark` 变体（颜色偏深 oklch 44%-52%）— 深字 on 浅软底
 *   - dark theme：用 `.light` 变体（颜色偏浅 oklch 88%-90%）— 浅字 on 深软底
 *
 * **不破坏 ADR-111 / CHG-UI-04**：state.ts 仍保持 sharedSlots 严格 `{bg, fg, border}` 三 slot +
 * light/dark 完全等价；本模块独立 export，与 state 模块平级，buildSemanticVars 给独立 prefix。
 *
 * **CSS variables**（由 build.ts 自动生成 :root + [data-theme="dark"] 两块 override）：
 *   - `--state-fg-on-soft-success`
 *   - `--state-fg-on-soft-warning`
 *   - `--state-fg-on-soft-error`
 *   - `--state-fg-on-soft-info`
 *
 * **典型消费方**：admin-ui RejectModal "确认拒绝" / StaffNoteBar "保存" PRIMARY_BUTTON
 * （bg=--state-error-bg + color=--state-fg-on-soft-error + border=--state-error-border）
 * 两 theme 下 contrast 均 AA AAA pass。
 */

import { colors } from '../primitives/color.js'

const lightVariants = {
  success: colors.success.dark,
  warning: colors.warning.dark,
  error: colors.error.dark,
  info: colors.info.dark,
} as const

const darkVariants = {
  success: colors.success.light,
  warning: colors.warning.light,
  error: colors.error.light,
  info: colors.info.light,
} as const

export const stateFgOnSoft = {
  light: lightVariants,
  dark: darkVariants,
} as const

export type StateFgOnSoftKind = keyof typeof stateFgOnSoft.light
export type StateFgOnSoftTheme = keyof typeof stateFgOnSoft
