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

  it('moderator 角色看不见「系统管理」组 3 个 admin-only 路由', () => {
    const { container } = renderClient(themeValue, { initialRole: 'moderator' })
    const hrefs = Array.from(container.querySelectorAll('[data-sidebar-item]'))
      .map((el) => el.getAttribute('data-sidebar-item'))
    expect(hrefs).not.toContain('/admin/users')
    expect(hrefs).not.toContain('/admin/settings')
    expect(hrefs).not.toContain('/admin/audit')
  })

  it('moderator 仍可见非 admin-only 业务 nav（审核台 / 视频库 等）', () => {
    const { container } = renderClient(themeValue, { initialRole: 'moderator' })
    const hrefs = Array.from(container.querySelectorAll('[data-sidebar-item]'))
      .map((el) => el.getAttribute('data-sidebar-item'))
    expect(hrefs).toContain('/admin/moderation')
    expect(hrefs).toContain('/admin/videos')
  })
})
