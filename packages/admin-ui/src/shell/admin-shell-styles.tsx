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
  /* CHG-DESIGN-04 brand 切蓝后改用 accent-default（饱和蓝条），不沿用旧 amber state-warning-fg */
  background: var(--accent-default);
}

/* ── Sidebar 展开/折叠过渡动效（CHG-DESIGN-04 + fix#5 / reference.md §4.1.2 问题 A+B）
 * Sidebar 的 layout 重置（折叠态 max-width:0 / padding:0 / justify-center 等）走 inline 条件
 * 见 sidebar.tsx COLLAPSED_HIDDEN_STYLE / linkStyle / brandStyle / footerStyle 等。
 * 本处仅声明 transition：当 inline style 在 collapsed 切换时变化，AdminShell 合成路径
 * 触发平滑过渡；Sidebar 独立使用（不通过 AdminShell）时降级为 instant snap，layout 仍正确。
 */
[data-sidebar] {
  transition: width 200ms cubic-bezier(0.4, 0, 0.2, 1);
}
/* 内容渐隐元素：opacity + max-width + padding 全部参与动画
 * （CHG-DESIGN-04 fix#6：max-width 数值 100% ↔ 0 让插值连续；padding 1px 8px ↔ 0 同理） */
[data-sidebar-section-title],
[data-sidebar-brand-title],
[data-sidebar-item-label],
[data-sidebar-item-badge],
[data-sidebar-foot-meta],
[data-sidebar-foot-chevron],
[data-sidebar-collapse-label],
[data-sidebar-collapse-kbd] {
  transition:
    opacity 150ms ease-out,
    max-width 200ms cubic-bezier(0.4, 0, 0.2, 1),
    padding 200ms cubic-bezier(0.4, 0, 0.2, 1);
}

/* Sidebar nav 滚动条隐藏（不预留宽度） — 用户反馈："悬浮态"，不影响 layout
 * 其他容器（DataTable / Drawer / Modal 等）保留全局 scrollbar-gutter: stable */
[data-sidebar-nav] {
  scrollbar-width: none;
}
[data-sidebar-nav]::-webkit-scrollbar {
  display: none;
}

@media (prefers-reduced-motion: reduce) {
  [data-sidebar],
  [data-sidebar-section-title],
  [data-sidebar-brand-title],
  [data-sidebar-item-label],
  [data-sidebar-item-badge],
  [data-sidebar-foot-meta],
  [data-sidebar-foot-chevron],
  [data-sidebar-collapse-label],
  [data-sidebar-collapse-kbd] { transition: none; }
}

/* ── Global scrollbar — 全站统一 6px（CHG-DESIGN-03 / reference.md §0-6 §3.4） ─────── */
/* AdminShell 是 admin 路由树根 Shell，本 <style> 注入后规则作用于整个 admin 文档；
 * 适用于：sidebar nav 滚动、main page 滚动、Drawer/Modal body、DataTable body、
 *         Notification/Task drawer list、Cmd+K cmdk__list、任意 card body 内部 scroll
 * 禁止在消费方单独 override 宽度（task-queue SEQ-20260429-02 验收要求 grep 仅 1 处） */
*::-webkit-scrollbar {
  width: var(--admin-scrollbar-size);
  height: var(--admin-scrollbar-size);
}
*::-webkit-scrollbar-track {
  background: transparent;
}
*::-webkit-scrollbar-thumb {
  background: var(--border-strong);
  border-radius: var(--radius-full);
  /* 2px 视觉 padding 让 6px 不显得过瘦；底色与最常见 surface 对齐 */
  border: 2px solid var(--bg-surface);
}
*::-webkit-scrollbar-thumb:hover {
  background: var(--fg-disabled);
}
/* Firefox 双轨：thin = 系统细滚动条；scrollbar-color = thumb / track
 * scrollbar-gutter: stable —— 始终预留 scrollbar 空间，避免出现/消失时
 * 内容回流（用户反馈："滚动条不应该改变现有布局"）。仅对 overflow:auto/scroll
 * 容器生效，对其他元素无副作用（CSS Scrollbars Module Level 1） */
* {
  scrollbar-width: thin;
  scrollbar-color: var(--border-strong) transparent;
  scrollbar-gutter: stable;
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
