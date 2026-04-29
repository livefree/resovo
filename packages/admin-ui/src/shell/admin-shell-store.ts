/**
 * admin-shell-store.ts — AdminShell 编排层状态工厂（zustand/vanilla）
 *
 * 真源（按优先级）：
 *   - ADR-103a §4.1.1 AdminShell 职责（collapsed + Drawer 互斥开闭态 + cmdkOpen）
 *   - ADR-103a §4.4-2 Edge Runtime 兼容（模块顶层零副作用）
 *
 * 设计要点：
 *   - 工厂函数 createAdminShellStore(initialCollapsed) — per-instance store；
 *     AdminShell 组件用 useRef 持有，避免全局单例与 defaultCollapsed 冲突
 *   - 状态三项：collapsed（侧栏折叠）+ drawerOpen（Drawer 互斥开闭）+ cmdkOpen（CmdK 开闭）
 *   - Drawer 互斥：openDrawer(variant) 自动关闭另一个 Drawer + 同时关闭 CmdK
 *   - CmdK 互斥：openCmdk() 自动关闭 Drawer
 *   - collapsed 受控/非受控双模式逻辑由 AdminShell 组件处理；store 只持有内部态
 *
 * 不变约束：
 *   - 模块顶层零 fetch / Cookie / localStorage / window / document / navigator 访问（§4.4-2）
 *   - 每个 AdminShell 实例独立 store（工厂模式，不共享全局队列）
 */
import { createStore } from 'zustand/vanilla'

export type DrawerVariant = 'notifications' | 'tasks'

export interface AdminShellStoreState {
  readonly collapsed: boolean
  /** 互斥开闭态：null = 全关；'notifications' | 'tasks' = 对应 Drawer 开 */
  readonly drawerOpen: DrawerVariant | null
  readonly cmdkOpen: boolean
}

export interface AdminShellStoreActions {
  /** 直接设置 collapsed（受控模式下由 AdminShell 组件调用以同步外部 prop） */
  readonly setCollapsed: (v: boolean) => void
  readonly toggleCollapsed: () => void
  /** 打开指定 Drawer，同时关闭另一 Drawer + 关闭 CmdK（互斥）*/
  readonly openDrawer: (variant: DrawerVariant) => void
  readonly closeDrawer: () => void
  /** 打开 CmdK，同时关闭 Drawer（互斥）*/
  readonly openCmdk: () => void
  readonly closeCmdk: () => void
}

/** AdminShell per-instance store 工厂（ADR-103a §4.1.1 受控/非受控双模式） */
export function createAdminShellStore(initialCollapsed = false) {
  return createStore<AdminShellStoreState & AdminShellStoreActions>()((set) => ({
    collapsed: initialCollapsed,
    drawerOpen: null,
    cmdkOpen: false,

    setCollapsed: (v) => set({ collapsed: v }),
    toggleCollapsed: () => set((s) => ({ collapsed: !s.collapsed })),

    openDrawer: (variant) => set({ drawerOpen: variant, cmdkOpen: false }),
    closeDrawer: () => set({ drawerOpen: null }),

    openCmdk: () => set({ cmdkOpen: true, drawerOpen: null }),
    closeCmdk: () => set({ cmdkOpen: false }),
  }))
}
