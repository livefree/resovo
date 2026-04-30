/**
 * admin shell 专属视觉 token（design spec v2.1 tokens.css → admin-layout 命名空间）
 *
 * 与 semantic 层的分层依据：
 *   - admin-accent-soft / admin-accent-border：弱化 accent 叠加色，semantic 层无此形态（accent.ts 仅 default/hover/active/muted/fg）
 *   - admin-warn-soft / admin-danger-soft：amber/red rgba 半透明叠加；与状态色 -bg/-fg 不同的"软"语义（hover/selected 用途）
 *   - admin-avatar-bg：装饰性渐变，应用专属，不进入跨域 semantic 层
 *   - admin-input-radius：design spec --r-2 (6px)，semantic radius 层无该步长
 *   - admin-count-font-size：design spec --fs-11 (11px)，semantic font-size 层无该步长
 *   - admin-scrollbar-size：reference.md §0-6 全站统一 6px
 *
 * 命名约定：以 admin- 为前缀，区别于 semantic 层 token（无前缀）。
 *
 * accent-soft / accent-border 通过 color-mix 引用 var(--accent-default)，
 * 自动跟随当前 brand（蓝），不锁死到设计稿原 amber 字面量。warn/danger soft
 * 仍保留状态色字面量（warn 语义本就是橙，danger 本就是红，与 brand 解耦）。
 */
export const adminShellSurfaces = {
  // 弱化 accent 叠加 — 跟随 var(--accent-default) brand 色
  // 用途：DataTable selected row / FilterChip active / Pagination active page / Sidebar active item
  'admin-accent-soft': 'color-mix(in oklch, var(--accent-default) 18%, transparent)',

  // accent 边框（CHG-DESIGN-02 表格 selection 高亮、CHG-DESIGN-04 sidebar active outline 等用途）
  'admin-accent-border': 'color-mix(in oklch, var(--accent-default) 32%, transparent)',

  // warn / danger 软背景 — 与状态语义绑定，不跟随 brand
  'admin-warn-soft': 'rgba(245, 158, 11, 0.14)',
  'admin-danger-soft': 'rgba(239, 68, 68, 0.14)',

  // avatar 装饰渐变（design spec .sb__avatar）
  'admin-avatar-bg': 'linear-gradient(135deg, #6366f1, #8b5cf6)',

  // 6px 圆角步长（design spec --r-2，用于 search trigger / nav item）
  'admin-input-radius': '6px',

  // 11px 字号（design spec --fs-11，用于 count badge）
  'admin-count-font-size': '11px',

  // 全站统一滚动条宽度（reference.md §0-6 / §3.4）
  // 消费方 selectors 自行 webkit/firefox 双轨注入，本 token 仅承载值
  'admin-scrollbar-size': '6px',
} as const

export type AdminShellSurfacesToken = keyof typeof adminShellSurfaces
