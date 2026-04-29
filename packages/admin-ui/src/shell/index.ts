/**
 * shell/index.ts — packages/admin-ui Shell 桶导出（ADR-103a §4.1.11）
 *
 * 当前已落地：ToastViewport + useToast（CHG-SN-2-03）
 * 待落地（CHG-SN-2-04 ~ CHG-SN-2-12）：
 *   - KeyboardShortcuts + Breadcrumbs + HealthBadge + UserMenu
 *   - Sidebar + Topbar + NotificationDrawer + TaskDrawer + CommandPalette
 *   - AdminShell（装配 + admin layout 替换骨架）
 *
 * ── shell/ 子目录章法（CHG-SN-2-03 首例落地，作为 CHG-SN-2-04+ 范式参照）──
 *
 * 1. 文件命名（按组件形态二选一）：
 *    A. store-driven（有跨组件共享状态，如 ToastViewport / NotificationDrawer）：
 *       - <component>-store.ts         — zustand 单例 store
 *       - use-<component>.ts           — hook 包装 store API（不订阅 state，仅透传 actions）
 *       - <component>.tsx 或 <component>-viewport.tsx — React 组件（useSyncExternalStore 订阅）
 *    B. 纯工具 + 无状态副作用组件（如 KeyboardShortcuts + platform.ts）：
 *       - <utility>.ts                 — 纯函数 + 顶层 const 工具集
 *       - <component>.tsx              — React 组件（return null + useEffect 副作用 / 或纯渲染）
 *       - 例外：utility helper 与 component 强耦合时（如 inferBreadcrumbs 与 Breadcrumbs
 *         共享 BreadcrumbItem 类型）可同文件，避免循环类型导出（CHG-SN-2-05 实践）
 *    C. 受控浮层 + focus trap + outside-click + portal 定位模式（如 UserMenu / 未来 Drawer / CommandPalette）：
 *       - <component>.tsx              — React 组件单文件
 *       - props：{ open; onOpenChange; anchorRef?; ...其他 } 受控开闭
 *       - listener（document mousedown / keydown）全在 useEffect 内挂；deps 含 [open, ...]；
 *         open=false 不挂 listener；unmount/rerender 自动 cleanup
 *       - focus trap 焦点门禁：仅当焦点在组件容器内时启用 Tab 循环（避免菜单外焦点被劫持）
 *       - 任意操作触发后调 onOpenChange(false) 自动关闭；callback throw 用 try/finally 保护
 *       - **popover/visual 契约**（fix(CHG-SN-2-07) 补齐）：
 *         · anchorRef 提供 → createPortal 到 document.body + position: fixed +
 *           基于 anchorRef.current.getBoundingClientRect() 计算 top/left +
 *           z-index: var(--z-shell-{drawer|cmdk}) 按层级取（ADR-103a §4.3 4 级）+
 *           useLayoutEffect 计算位置（避免一帧抖动），SSR 自动 noop +
 *           resize / scroll(capture) 重新计算
 *         · anchorRef 缺省 → inline 渲染（demo/单测 fallback）
 *         · transform 偏移决定弹出方向（如 UserMenu 上方对齐：translateY(calc(-100% - 8px))）
 *
 * 2. 不变约束（与 ADR-103a §4.4 + 顶层 packages/admin-ui/src/index.ts 一致）：
 *    - 零 BrandProvider / ThemeProvider 声明（Provider 不下沉，§4.4-1）
 *    - Edge Runtime 兼容：模块顶层零 window/document/fetch/Cookie/localStorage/navigator（§4.4-2）
 *    - 零硬编码颜色：颜色/间距/阴影只读 admin-layout + semantic + brands token（§4.4-3）
 *    - 零图标库依赖：lucide-react 等由 server-next 应用层注入 ReactNode（§4.4-4）
 *
 * 3. 类型导出范式：
 *    - 组件 Props 接口（readonly + on<Verb> 事件命名）
 *    - 默认值常量（如 DEFAULT_DURATION_MS / DEFAULT_MAX_QUEUE）
 *    - 内部 ToastItem / state union 等数据类型（消费方需要时导出）
 *
 * 4. 单测组织（路径 tests/unit/components/admin-ui/shell/）：
 *    - <component>-store.test.ts        — 纯 store 行为（push / dismiss / FIFO / 边界）
 *    - <component>-viewport.test.tsx    — React 渲染 + 用户交互（jsdom）
 *    - <component>-viewport-ssr.test.tsx — renderToString 零 throw + SSR snapshot 稳定
 *
 * 5. SSR 安全模式（按组件形态二选一）：
 *    A. store-driven 组件：
 *       - useSyncExternalStore 第三参数 getServerSnapshot 必须返稳定常量引用
 *       - 模块顶层 SSR 常量定义（如 SSR_EMPTY_QUEUE）；不要每次调用新建数组
 *    B. 无渲染副作用组件（return null + useEffect listener，如 KeyboardShortcuts）：
 *       - renderToString 输出空字符串即合规
 *       - useEffect 内才访问 window/document（顶层用 typeof 防御 + 模块求值，详见 platform.ts trade-off）
 *    C. 受控浮层组件（如 UserMenu）：
 *       - open=false 时 return null（renderToString 输出空字符串）
 *       - open=true 时 SSR 渲染但 useEffect / focus / listener 在客户端 mount 后才生效（SSR 安全）
 *       - 单测三分扩展（渲染 + 交互 + SSR）；交互单测覆盖 focus trap / ESC / outside-click 三类边界
 */
export { ToastViewport } from './toast-viewport'
export type { ToastPosition, ToastViewportProps } from './toast-viewport'

export { useToast } from './use-toast'
export type { UseToastReturn } from './use-toast'

export { DEFAULT_DURATION_MS, DEFAULT_MAX_QUEUE } from './toast-store'
export type { ToastInput, ToastItem, ToastLevel } from './toast-store'

export { KeyboardShortcuts } from './keyboard-shortcuts'
export type { KeyboardShortcutsProps, ShortcutBinding } from './keyboard-shortcuts'

export { IS_MAC, MOD_KEY_LABEL, formatShortcut, parseShortcut, matchesEvent, usePlatform, useFormatShortcut } from './platform'
export type { ShortcutMatcher, UsePlatformReturn } from './platform'

export { Breadcrumbs, inferBreadcrumbs } from './breadcrumbs'
export type { BreadcrumbsProps, BreadcrumbItem } from './breadcrumbs'

export { HealthBadge } from './health-badge'
export type { HealthBadgeProps } from './health-badge'

export { UserMenu, deriveAvatarText } from './user-menu'
export type { UserMenuProps } from './user-menu'

export { Sidebar, formatCount } from './sidebar'
export type { SidebarProps } from './sidebar'

export { Topbar, formatTaskCount } from './topbar'
export type { TopbarProps, TopbarIcons } from './topbar'

export { NotificationDrawer } from './notification-drawer'
export type { NotificationDrawerProps } from './notification-drawer'

export { TaskDrawer } from './task-drawer'
export type { TaskDrawerProps } from './task-drawer'

// Drawer item 数据契约类型 SSOT（CHG-SN-2-10；server-next 应用层准备 items 注入）
export type { NotificationItem, TaskItem } from './types'

// AdminNav + HealthSnapshot + AdminShellUser + AdminUserActions + UserMenuAction
// 数据契约类型 SSOT（CHG-SN-2-05/06/07）
export type {
  AdminNavItem,
  AdminNavSection,
  AdminNavCountProvider,
  HealthSnapshot,
  AdminShellUser,
  AdminUserActions,
  UserMenuAction,
} from './types'
