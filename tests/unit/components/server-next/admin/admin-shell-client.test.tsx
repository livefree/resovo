import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { AdminShellClient } from '../../../../../apps/server-next/src/app/admin/admin-shell-client'
import { ThemeContext } from '../../../../../apps/server-next/src/contexts/BrandProvider'
import type { ThemeContextValue } from '../../../../../apps/server-next/src/types/brand'

const routerPush = vi.fn()

vi.mock('next/navigation', () => ({
  usePathname: () => '/admin',
  useRouter: () => ({ push: routerPush }),
}))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

function renderClient(
  themeValue: ThemeContextValue,
  options: { initialRole?: 'admin' | 'moderator' } = {},
) {
  return render(
    <ThemeContext.Provider value={themeValue}>
      <AdminShellClient
        defaultCollapsed={false}
        initialTheme="dark"
        initialRole={options.initialRole ?? 'admin'}
      >
        <div data-testid="admin-page">页面内容</div>
      </AdminShellClient>
    </ThemeContext.Provider>,
  )
}

describe('AdminShellClient — 主题切换', () => {
  it('点击顶部主题按钮通过 ThemeContext 切换到浅色主题', () => {
    const setTheme = vi.fn()
    const { container } = renderClient({ theme: 'dark', resolvedTheme: 'dark', setTheme })

    fireEvent.click(container.querySelector('[data-topbar-icon-btn="theme"]')!)

    expect(setTheme).toHaveBeenCalledWith('light')
  })

  it('resolvedTheme=light 时点击顶部主题按钮切换回深色主题', () => {
    const setTheme = vi.fn()
    const { container } = renderClient({ theme: 'light', resolvedTheme: 'light', setTheme })

    expect(container.querySelector('[data-topbar]')?.getAttribute('data-topbar-theme')).toBe('light')
    fireEvent.click(container.querySelector('[data-topbar-icon-btn="theme"]')!)

    expect(setTheme).toHaveBeenCalledWith('dark')
  })
})

// CHG-SN-8-GAPS-AUDIT-NAV-HIDE（#G-audit-self-scope 消费层补齐）
describe('AdminShellClient — 系统管理组 role 过滤', () => {
  const themeValue: ThemeContextValue = { theme: 'dark', resolvedTheme: 'dark', setTheme: vi.fn() }

  it('admin 角色看见全部 nav 含「用户管理」「站点设置」「审计日志」', () => {
    const { container } = renderClient(themeValue, { initialRole: 'admin' })
    const hrefs = Array.from(container.querySelectorAll('[data-sidebar-item]'))
      .map((el) => el.getAttribute('data-sidebar-item'))
    expect(hrefs).toContain('/admin/users')
    expect(hrefs).toContain('/admin/settings')
    expect(hrefs).toContain('/admin/audit')
  })

  it('moderator 角色看不见「系统管理」组 admin-only 路由（users / settings；audit 已 ADR-142 self-scope 放开）', () => {
    const { container } = renderClient(themeValue, { initialRole: 'moderator' })
    const hrefs = Array.from(container.querySelectorAll('[data-sidebar-item]'))
      .map((el) => el.getAttribute('data-sidebar-item'))
    expect(hrefs).not.toContain('/admin/users')
    expect(hrefs).not.toContain('/admin/settings')
    // ADR-142 / CHG-SN-8-FUP-AUDIT-SELF-SCOPE-EP：moderator 仍可见审计日志 self-scope
    expect(hrefs).toContain('/admin/audit')
  })

  it('moderator 仍可见非 admin-only 业务 nav（审核台 / 视频库 等）', () => {
    const { container } = renderClient(themeValue, { initialRole: 'moderator' })
    const hrefs = Array.from(container.querySelectorAll('[data-sidebar-item]'))
      .map((el) => el.getAttribute('data-sidebar-item'))
    expect(hrefs).toContain('/admin/moderation')
    expect(hrefs).toContain('/admin/videos')
  })
})

// ── ADR-155 D-155-2 / EP-2：BackgroundEventBell 反回归 ──
// Y-EP2-1 / 关键洞察 #2 process 红线复发监测：防止未来主循环再创建任何
// "第 3 个 topbar 图标 position:fixed 旁路"组件
describe('AdminShellClient — D-155-2 EP-2 BackgroundEventBell 反回归', () => {
  const themeValue: ThemeContextValue = { theme: 'dark', resolvedTheme: 'dark', setTheme: vi.fn() }

  it('topbar 不再渲染独立 BackgroundEventBell（仅铃铛 + 闪电两图标在 notifications/tasks 槽）', () => {
    const { container } = renderClient(themeValue, { initialRole: 'admin' })
    // BackgroundEventBell.tsx 文件已删除 / N1-152-A position:fixed 旁路撤销
    // 确认 DOM 不含 data-background-event-bell 残留属性
    expect(container.querySelector('[data-background-event-bell]')).toBeNull()
    // 也不含 BackgroundEventBell 测试 testid 残留
    expect(container.querySelector('[data-testid="background-event-bell"]')).toBeNull()
  })
})
