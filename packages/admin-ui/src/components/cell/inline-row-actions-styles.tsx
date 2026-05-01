'use client'

/**
 * inline-row-actions-styles.tsx — 全局 CSS 注入（CHG-DESIGN-12 12B fix#1→#2→#3→#4）
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
 *   - fix#3 改模块顶层 eager inject：仅 client-only（typeof document 守卫）→ 模块 import 时
 *     注入；client-only paint 路径无 FOUC
 *
 * 反"SSR 路径仍 FOUC"教训（fix#3 → fix#4，本卡当前形态）：
 *   - fix#3 module-level eager inject 有 typeof document 守卫 → SSR 路径跳过
 *     → server-rendered HTML 不含 <style> → 浏览器解析 HTML（display 已就位）到
 *     JS 加载执行 module-level inject 之间，actions 显示 opacity 1（仍 FOUC）
 *   - fix#4 改 SSR-safe `<style>` JSX 元素：React SSR 会把 CSS 字符串渲染到 HTML 里
 *     → 浏览器收到含 CSS 的 server HTML → 第一帧解析时规则已就位 → 真正无 FOUC
 *   - 每个 InlineRowActions 实例渲染一份 <style>（DOM 体积 ~600B × N 实例可接受）；
 *     浏览器 CSSOM 自动合并多份相同规则，语义等价
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

const CSS = `
/* ── InlineRowActions 默认隐藏 + hover 浮现（reference §6.0 + CHG-DESIGN-12 12B fix#2/#3/#4） ─────── */
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
 * SSR-safe `<style>` JSX 元素 — 每个 InlineRowActions 实例渲染一份。
 *
 * **关键 fix#4**（反 fix#3 SSR 第一帧 FOUC）：
 *   - fix#3 用 module-level eager inject + `typeof document` 守卫
 *     → SSR 路径跳过 → server-rendered HTML 不含 <style>
 *     → 浏览器解析 HTML 到 JS 执行模块加载之间，actions 显示 opacity 1（FOUC）
 *   - fix#4 改 SSR-safe JSX `<style>`：React SSR 会把 CSS 渲染到 HTML 字符串里
 *     → 浏览器解析 HTML 时 CSS 已生效 → 第一帧无 FOUC
 *
 * 多实例策略：
 *   - 每个 InlineRowActions 实例渲染一个 `<style>` 节点（CSS ~600B × N 实例）
 *   - 浏览器 CSSOM 自动合并：多份相同规则解析后语义等价（最终样式一致）
 *   - data-admin-ui-cell-row-actions attribute 便于 e2e / DevTools 识别来源
 *
 * 兼容性：
 *   - SSR + CSR 双路径生效
 *   - HMR：React 重渲染时 style 节点保留
 *   - prefers-reduced-motion / focus-within / hover 全部由 CSS 选择器覆盖
 */
export function InlineRowActionsStyles(): React.ReactElement {
  return (
    <style
      data-admin-ui-cell-row-actions=""
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: CSS }}
    />
  )
}
