/**
 * admin shell z-index — Shell 编排层 4 级层叠规范
 * 来源：ADR-103a §4.3（4 级 z-index 规范，CHG-SN-2-01 落盘 / CHG-SN-2-02 token 实施）
 * 消费：apps/server-next + packages/admin-ui Shell（admin 专属）；apps/web-next 0 消费（ADR-102）
 *
 * 4 级层叠不变量（CSS 变量级硬编码，禁止跨档反转）：
 *   L1 业务 Drawer (1000)        ← 由 components/ 层 Drawer/Modal 原语持有 `--z-modal`，不在本命名空间
 *   L2 Shell 抽屉 (1100)         ← `--z-shell-drawer`：NotificationDrawer / TaskDrawer / UserMenu 浮层
 *   L3 CommandPalette (1200)     ← `--z-shell-cmdk`：⌘K 命令面板
 *   L4 ToastViewport (1300)      ← `--z-shell-toast`：全局 Toast 队列
 *
 * 100 步进：留中间层扩展空隙（如未来插入"业务 Modal 之上、Shell 抽屉之下"的 confirm dialog）。
 *
 * 业务 Drawer (L1) 故意不进 z-shell-* 命名空间，避免污染 admin-layout 编排层语义边界
 * （admin-layout 只承载 Shell 编排层 z-index；业务 Modal/Drawer 是组件级 token，归 components/ 层管辖）。
 *
 * 跨域消费禁令：scripts/verify-token-isolation.mjs FORBIDDEN_TOKENS 含 z-shell-drawer / z-shell-cmdk / z-shell-toast，
 * apps/web-next 任何路由 0 消费（ADR-102 第 5 层硬约束）。
 */
export const adminShellZIndex = {
  'z-shell-drawer': '1100',
  'z-shell-cmdk': '1200',
  'z-shell-toast': '1300',
} as const

export type AdminShellZIndexToken = keyof typeof adminShellZIndex
