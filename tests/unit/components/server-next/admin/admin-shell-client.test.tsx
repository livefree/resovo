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

function renderClient(themeValue: ThemeContextValue) {
  return render(
    <ThemeContext.Provider value={themeValue}>
      <AdminShellClient defaultCollapsed={false} initialTheme="dark" initialRole="admin">
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
