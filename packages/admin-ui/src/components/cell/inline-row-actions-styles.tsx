'use client'

/**
 * inline-row-actions-styles.tsx — 全局 CSS 注入（CHG-DESIGN-12 12B fix#1→#2→#3）
 *
 * 设计原则：
 *   - InlineRowActions 是 packages/admin-ui 公共导出组件，**禁止依赖 admin-shell-styles 私有注入**
 *   - 模块级 flag 防重复注入；多个 InlineRowActions 实例共享同一份 <style> 标签
 *
 * 反"inline opacity 阻止 hover override"教训（fix#1 → fix#2）：
 *   - fix#1 用 inline `style={{ opacity: 0 }}` → inline 优先级 1000 高于普通 CSS 选择器，
 *     消费方 `tr:hover [data-row-actions] { opacity: 1 }` 无法 override
 *   - fix#2 改全局 CSS 注入：组件不写 inline opacity，opacity 由 `[data-row-actions]:not(...)`
 *     选择器（特异度 0,2,1）控制；消费方 `tr:hover ...` 选择器同等优先级可直接 override
 *
 * 反"useEffect 注入时机延迟导致 FOUC"教训（fix#2 → fix#3）：
 *   - fix#2 用 useEffect 注入 → useEffect 在组件 mount **后**才运行（首次 paint 之后）
 *     → 第一帧 actions 默认 opacity 1（CSS 还没注入），违反 reference §6.0「默认隐藏」契约
 *   - fix#3 改**模块顶层 eager inject**：模块 import 时（client-only）立即注入 CSS 到
 *     `document.head`，**早于** React 第一次渲染；首次 paint 时 CSS 已就位，无 FOUC
 *   - SSR 路径：`typeof document === 'undefined'` 守卫跳过；浏览器 hydration 时模块再次
 *     执行触发注入；server-rendered HTML 第一帧仍可能短暂闪现（一帧），但远好于
 *     useEffect 路径的两帧延迟
 *
 * CSS 规则：
 *   - `[data-row-actions]:not([data-always-visible="true"])` 默认 opacity 0 + pointer-events none
 *   - `tr:hover [data-row-actions]:not(...)` / `[role="row"]:hover [data-row-actions]:not(...)`
 *     → opacity 1 + pointer-events auto（reference §6.0 hover 浮现交互）
 *   - `:focus-within` 兜底键盘可访问性（tab 进入后强制可见）
 *   - transition 200ms cubic-bezier 让切换平滑（与 sidebar 一致）
 *
 * 命名空间：所有选择器以 `[data-row-actions]` 后代起步，不污染外层 page 样式。
 */

const STYLE_ID = 'admin-ui-inline-row-actions-styles'

const CSS = `
/* ── InlineRowActions 默认隐藏 + hover 浮现（reference §6.0 + CHG-DESIGN-12 12B fix#2/#3） ─────── */
[data-row-actions]:not([data-always-visible="true"]) {
  opacity: 0;
  pointer-events: none;
  transition: opacity 200ms cubic-bezier(0.4, 0, 0.2, 1);
}

/* hover 行（DataTable / 普通 table 双兼容） + focus-within 键盘可访问性兜底 */
tr:hover [data-row-actions]:not([data-always-visible="true"]),
[role="row"]:hover [data-row-actions]:not([data-always-visible="true"]),
[data-row-actions]:not([data-always-visible="true"]):focus-within {
  opacity: 1;
  pointer-events: auto;
}

/* alwaysVisible="true" 直接 opacity 1，pointer-events 默认（不限制） */
[data-row-actions][data-always-visible="true"] {
  opacity: 1;
}

/* prefers-reduced-motion：去掉 transition */
@media (prefers-reduced-motion: reduce) {
  [data-row-actions]:not([data-always-visible="true"]) {
    transition: none;
  }
}
` as const

/**
 * 模块顶层 eager inject — client-only，模块 import 时立即注入 CSS。
 *
 * **关键 fix#3**：早于 React 第一次渲染，避免 useEffect 注入路径下的两帧 FOUC。
 *
 * 守卫层：
 *   1. `typeof document !== 'undefined'`：SSR 路径跳过（document 不存在）
 *   2. `!document.getElementById(STYLE_ID)`：HMR / 多次模块加载时去重
 *
 * 卸载时不撤回 — 模块级 CSS 残留无副作用，下次挂载可立即生效。
 */
function injectStyles(): void {
  if (typeof document === 'undefined') return
  if (document.getElementById(STYLE_ID)) return
  const el = document.createElement('style')
  el.id = STYLE_ID
  el.textContent = CSS
  document.head.appendChild(el)
}

// 模块加载时立即执行（client-only by typeof document 守卫）
injectStyles()

/**
 * 兼容 React tree 渲染入口（noop 组件）。
 *
 * 实际注入由模块顶层 `injectStyles()` 完成；本组件保留是为了：
 *   1. InlineRowActions 渲染树语义清晰（"我用全局 CSS"）
 *   2. 测试可显式 mount 触发模块加载验证
 *   3. 未来若需要 React state / hook 介入（如 nonce / CSP），有改造点
 */
export function InlineRowActionsStyles(): null {
  // noop：实际注入已在模块顶层完成
  return null
}
