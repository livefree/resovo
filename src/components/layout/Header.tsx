/**
 * Header.tsx — 顶部导航栏（客户端组件）
 * 显示登录状态、用户名
 */

'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useAuthStore } from '@/stores/authStore'
import { apiClient } from '@/lib/api-client'

export function Header() {
  const t = useTranslations('nav')
  const { user, logout } = useAuthStore()

  async function handleLogout() {
    try {
      await apiClient.post('/auth/logout', undefined, { skipAuth: false })
    } catch {
      // 即便 API 失败，仍然清除本地状态
    }
    logout()
  }

  return (
    <header
      className="flex items-center justify-between px-6 py-4 border-b"
      style={{ borderColor: 'var(--border)', background: 'var(--card)' }}
    >
      <Link
        href="/"
        className="text-xl font-bold tracking-tight"
        style={{ color: 'var(--gold)' }}
      >
        Resovo
      </Link>

      <nav className="flex items-center gap-4">
        {user ? (
          <>
            <span
              data-testid="nav-username"
              className="text-sm font-medium"
              style={{ color: 'var(--foreground)' }}
            >
              {user.username}
            </span>
            <button
              onClick={handleLogout}
              data-testid="nav-logout"
              className="text-sm hover:opacity-80 transition-opacity"
              style={{ color: 'var(--muted-foreground)' }}
            >
              {t('logout')}
            </button>
          </>
        ) : (
          <Link
            href="/auth/login"
            className="text-sm font-medium hover:opacity-80 transition-opacity"
            style={{ color: 'var(--foreground)' }}
          >
            Sign In
          </Link>
        )}
      </nav>
    </header>
  )
}
