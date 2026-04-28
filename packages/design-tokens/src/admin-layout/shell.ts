/**
 * admin shell layout — server-next 侧栏 + 顶栏布局变量
 * 来源：v2.1 后台设计稿 styles/tokens.css `:root` Layout 段
 * 消费：apps/server-next（admin 专属）；apps/web-next 0 消费（ADR-102）
 * 叶子 key 即 CSS 变量名（不含 --），与 semantic/layout.ts 同惯例
 */
export const adminShell = {
  'sidebar-w': '232px',
  'sidebar-w-collapsed': '60px',
  'topbar-h': '52px',
} as const

export type AdminShellToken = keyof typeof adminShell
