/**
 * UserMenu SSR 单测（CHG-SN-2-07 范式遵守 — Shell 范式章法 5）
 *
 * 验证 ADR-103a §4.4-2 Edge Runtime 兼容性：
 *   - open=false 时 renderToString 输出为空（无 hydration mismatch）
 *   - open=true 时 renderToString 零 throw + 输出含 menu 容器 + items
 */
import { describe, it, expect } from 'vitest'
import { renderToString } from 'react-dom/server'
import { UserMenu } from '../../../../../packages/admin-ui/src/shell/user-menu'
import type { AdminShellUser, AdminUserActions } from '../../../../../packages/admin-ui/src/shell/types'

const USER: AdminShellUser = {
  id: 'u1',
  displayName: 'Yan Liu',
  email: 'yan@resovo.io',
  role: 'admin',
}

const ACTIONS: AdminUserActions = {
  onProfile: () => {},
  onLogout: () => {},
}

describe('UserMenu — SSR renderToString（ADR-103a §4.4-2）', () => {
  it('open=false → renderToString 不抛错 + 输出空（return null）', () => {
    expect(() => renderToString(<UserMenu open={false} onOpenChange={() => {}} user={USER} actions={ACTIONS} />)).not.toThrow()
    const html = renderToString(
      <UserMenu open={false} onOpenChange={() => {}} user={USER} actions={ACTIONS} />,
    )
    expect(html).toBe('')
  })

  it('open=true → renderToString 不抛错（useEffect 在 SSR 不执行 / focus 不触发）', () => {
    expect(() => renderToString(<UserMenu open onOpenChange={() => {}} user={USER} actions={ACTIONS} />)).not.toThrow()
  })

  it('open=true → SSR 输出含 menu 容器 + items + a11y attributes', () => {
    const html = renderToString(<UserMenu open onOpenChange={() => {}} user={USER} actions={ACTIONS} />)
    expect(html).toContain('data-user-menu')
    expect(html).toContain('role="menu"')
    expect(html).toContain('aria-label="用户菜单"')
    expect(html).toContain('Yan Liu')
    expect(html).toContain('个人资料')
    expect(html).toContain('登出')
    expect(html).toContain('data-menu-item="logout"')
    expect(html).toContain('data-menu-item-danger="true"')
  })
})
