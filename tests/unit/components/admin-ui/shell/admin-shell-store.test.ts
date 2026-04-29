/**
 * admin-shell-store 单测（CHG-SN-2-12）
 *
 * 覆盖：初始状态 / toggleCollapsed / setCollapsed / Drawer 互斥 /
 *       openCmdk 关 Drawer / openDrawer 关 CmdK / closeDrawer / closeCmdk
 */
import { describe, it, expect } from 'vitest'
import { createAdminShellStore } from '../../../../../packages/admin-ui/src/shell/admin-shell-store'

describe('createAdminShellStore — 初始状态', () => {
  it('默认 collapsed=false drawerOpen=null cmdkOpen=false', () => {
    const store = createAdminShellStore()
    const s = store.getState()
    expect(s.collapsed).toBe(false)
    expect(s.drawerOpen).toBeNull()
    expect(s.cmdkOpen).toBe(false)
  })

  it('initialCollapsed=true 时初始 collapsed=true', () => {
    const store = createAdminShellStore(true)
    expect(store.getState().collapsed).toBe(true)
  })
})

describe('createAdminShellStore — collapsed 操作', () => {
  it('toggleCollapsed false → true', () => {
    const store = createAdminShellStore(false)
    store.getState().toggleCollapsed()
    expect(store.getState().collapsed).toBe(true)
  })

  it('toggleCollapsed 连续调用往返', () => {
    const store = createAdminShellStore()
    store.getState().toggleCollapsed()
    store.getState().toggleCollapsed()
    expect(store.getState().collapsed).toBe(false)
  })

  it('setCollapsed 直接设值', () => {
    const store = createAdminShellStore()
    store.getState().setCollapsed(true)
    expect(store.getState().collapsed).toBe(true)
    store.getState().setCollapsed(false)
    expect(store.getState().collapsed).toBe(false)
  })
})

describe('createAdminShellStore — Drawer 互斥', () => {
  it('openDrawer(notifications) 打开通知抽屉', () => {
    const store = createAdminShellStore()
    store.getState().openDrawer('notifications')
    expect(store.getState().drawerOpen).toBe('notifications')
  })

  it('openDrawer(tasks) 打开任务抽屉', () => {
    const store = createAdminShellStore()
    store.getState().openDrawer('tasks')
    expect(store.getState().drawerOpen).toBe('tasks')
  })

  it('先开 notifications 再开 tasks → notifications 自动关闭', () => {
    const store = createAdminShellStore()
    store.getState().openDrawer('notifications')
    store.getState().openDrawer('tasks')
    expect(store.getState().drawerOpen).toBe('tasks')
  })

  it('先开 tasks 再开 notifications → tasks 自动关闭', () => {
    const store = createAdminShellStore()
    store.getState().openDrawer('tasks')
    store.getState().openDrawer('notifications')
    expect(store.getState().drawerOpen).toBe('notifications')
  })

  it('closeDrawer 关闭当前 Drawer', () => {
    const store = createAdminShellStore()
    store.getState().openDrawer('notifications')
    store.getState().closeDrawer()
    expect(store.getState().drawerOpen).toBeNull()
  })
})

describe('createAdminShellStore — CmdK 与 Drawer 互斥', () => {
  it('openCmdk 打开 CmdK', () => {
    const store = createAdminShellStore()
    store.getState().openCmdk()
    expect(store.getState().cmdkOpen).toBe(true)
  })

  it('openCmdk 时自动关闭 Drawer（互斥）', () => {
    const store = createAdminShellStore()
    store.getState().openDrawer('notifications')
    store.getState().openCmdk()
    expect(store.getState().cmdkOpen).toBe(true)
    expect(store.getState().drawerOpen).toBeNull()
  })

  it('openDrawer 时自动关闭 CmdK（互斥）', () => {
    const store = createAdminShellStore()
    store.getState().openCmdk()
    store.getState().openDrawer('tasks')
    expect(store.getState().cmdkOpen).toBe(false)
    expect(store.getState().drawerOpen).toBe('tasks')
  })

  it('closeCmdk 关闭 CmdK', () => {
    const store = createAdminShellStore()
    store.getState().openCmdk()
    store.getState().closeCmdk()
    expect(store.getState().cmdkOpen).toBe(false)
  })
})

describe('createAdminShellStore — 工厂隔离', () => {
  it('两个工厂实例相互独立', () => {
    const s1 = createAdminShellStore()
    const s2 = createAdminShellStore()
    s1.getState().toggleCollapsed()
    expect(s1.getState().collapsed).toBe(true)
    expect(s2.getState().collapsed).toBe(false)
  })
})
