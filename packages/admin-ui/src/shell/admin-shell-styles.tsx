/**
 * admin-shell-styles.tsx — Shell 全局 CSS 注入（fix(CHG-SN-2-12)#vs）
 *
 * 解决问题：inline style 无法表达 :hover / ::webkit-scrollbar / transition / ::before 伪元素。
 * 方案：在 AdminShell 内渲染一个 <style> tag，作用域以 data-* 属性选择器限定。
 *
 * 约束：
 *   - 零硬编码颜色 — 全部通过 CSS 变量引用 token
 *   - 零 className — 选择器全部基于 data-* 属性（与 inline-style 模式一致）
 *   - 幂等：多次渲染输出相同 CSS，不会产生重复副作用
 *
 * 消费：仅由 admin-shell.tsx 内部使用，不对外导出。
 */

const SHELL_CSS = `
/* ── Sidebar nav item — hover / active 状态 ─────────────────────── */
[data-sidebar-item] {
  transition: background 120ms ease, color 120ms ease;
}
[data-sidebar-item]:not([data-sidebar-item-active="true"]):hover {
  background: var(--bg-surface-raised);
}

/* NavItem active — left indicator bar（design spec .sb__link::before） */
[data-sidebar-item-active="true"] {
  position: relative;
}
[data-sidebar-item-active="true"]::before {
  content: '';
  position: absolute;
  left: 10px;
  top: 8px;
  bottom: 8px;
  width: 2px;
  border-radius: var(--radius-full);
  background: var(--state-warning-fg);
}

/* ── Nav scroll — 细化 scrollbar（design spec .sb__scroll） ─────── */
[data-sidebar-nav]::-webkit-scrollbar {
  width: 6px;
}
[data-sidebar-nav]::-webkit-scrollbar-track {
  background: transparent;
}
[data-sidebar-nav]::-webkit-scrollbar-thumb {
  background: var(--border-default);
  border-radius: var(--radius-full);
}
[data-sidebar-nav]::-webkit-scrollbar-thumb:hover {
  background: var(--border-strong);
}

/* ── Sidebar footer ─────────────────────────────────────────────── */
[data-sidebar-foot] {
  transition: background 120ms ease;
}
[data-sidebar-foot]:hover {
  background: var(--bg-surface-raised);
}

/* ── Collapse button ────────────────────────────────────────────── */
[data-sidebar-collapse] {
  transition: background 120ms ease;
}
[data-sidebar-collapse]:hover {
  background: var(--bg-surface-raised);
}

/* ── UserMenu items ─────────────────────────────────────────────── */
[data-menu-item] {
  transition: background 120ms ease;
  width: 100%;
  border-radius: var(--radius-sm);
}
[data-menu-item]:hover {
  background: var(--bg-surface-raised);
}
[data-menu-item][data-menu-item-danger="true"]:hover {
  background: var(--admin-danger-soft);
}

/* ── Pulse keyframe — 实时状态指示器（design spec tokens.css .pulse） ── */
/* 消费：通知红点 / 后台任务运行 dot / 采集站点健康度 dot 等 */
@keyframes admin-shell-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50%      { opacity: .5; transform: scale(.85); }
}
[data-pulse],
.pulse {
  animation: admin-shell-pulse 1.6s ease-in-out infinite;
}
@media (prefers-reduced-motion: reduce) {
  [data-pulse],
  .pulse { animation: none; }
}
` as const

export function AdminShellStyles() {
  return <style data-admin-shell-styles dangerouslySetInnerHTML={{ __html: SHELL_CSS }} />
}
