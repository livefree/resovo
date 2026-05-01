'use client'

/**
 * inline-row-actions-styles.tsx — 全局 CSS 注入（CHG-DESIGN-12 12B fix#2）
 *
 * 设计原则（参 dt-styles.tsx 范式 + CHG-DESIGN-12 12B fix#1 教训）：
 *   - InlineRowActions 是 packages/admin-ui 公共导出组件，**禁止依赖 admin-shell-styles 私有注入**
 *   - 本文件由 InlineRowActions 内部渲染 <InlineRowActionsStyles /> 一次性注入；模块级 flag
 *     防重复注入，多个 InlineRowActions 实例共享同一份 <style> 标签
 *
 * 反 inline opacity 阻止 hover override 教训（fix#1 → fix#2）：
 *   - fix#1 用 inline `style={{ opacity: 0 }}` → inline 优先级 1000 高于普通 CSS 选择器，
 *     消费方 `tr:hover [data-row-actions] { opacity: 1 }` 无法 override（除非 `!important`）
 *   - fix#2 改全局 CSS 注入模式：组件不写 inline opacity，opacity 由 `[data-row-actions]:not(...)`
 *     选择器（特异度 0,2,1）控制；消费方 `tr:hover ...` 选择器（特异度 0,1,1 + tr:hover 加成）
 *     同等或更高，可直接 override
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
import { useEffect } from 'react'

const STYLE_ID = 'admin-ui-inline-row-actions-styles'

const CSS = `
/* ── InlineRowActions 默认隐藏 + hover 浮现（reference §6.0 + CHG-DESIGN-12 12B fix#2） ─────── */
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

let injected = false

/**
 * 一次性注入 InlineRowActions 全局 CSS。
 * 多个 InlineRowActions 实例同时挂载时仅写入一次（模块级 flag 守卫）。
 * 卸载时不撤回 — 卸载后样式残留无副作用，重新挂载可立即生效。
 */
export function InlineRowActionsStyles(): null {
  useEffect(() => {
    if (injected) return
    if (typeof document === 'undefined') return
    if (document.getElementById(STYLE_ID)) {
      injected = true
      return
    }
    const el = document.createElement('style')
    el.id = STYLE_ID
    el.textContent = CSS
    document.head.appendChild(el)
    injected = true
  }, [])
  return null
}
