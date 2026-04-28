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
 */
export { ToastViewport } from './toast-viewport'
export type { ToastPosition, ToastViewportProps } from './toast-viewport'

export { useToast } from './use-toast'
export type { UseToastReturn } from './use-toast'

export { DEFAULT_DURATION_MS, DEFAULT_MAX_QUEUE } from './toast-store'
export type { ToastInput, ToastItem, ToastLevel } from './toast-store'

export { KeyboardShortcuts } from './keyboard-shortcuts'
export type { KeyboardShortcutsProps, ShortcutBinding } from './keyboard-shortcuts'

export { IS_MAC, MOD_KEY_LABEL, formatShortcut, parseShortcut, matchesEvent } from './platform'
export type { ShortcutMatcher } from './platform'
