/**
 * Nav.tsx — 顶部导航栏
 * Logo + 分类标签 + 主题切换 + 语言切换 + 用户状态
 */

'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { usePathname, useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/authStore'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { apiClient } from '@/lib/api-client'
import { cn } from '@/lib/utils'

// ── 分类标签 ──────────────────────────────────────────────────────

const CATEGORIES = [
  { key: 'all',     labelKey: 'nav.catAll',     href: '/browse' },
  { key: 'movie',   labelKey: 'nav.catMovie',   href: '/browse?type=movie' },
  { key: 'series',  labelKey: 'nav.catSeries',  href: '/browse?type=series' },
  { key: 'anime',   labelKey: 'nav.catAnime',   href: '/browse?type=anime' },
  { key: 'variety', labelKey: 'nav.catVariety', href: '/browse?type=variety' },
]

// ── 语言选项 ──────────────────────────────────────────────────────

const LOCALES = [
  { code: 'en',    label: 'EN' },
  { code: 'zh-CN', label: '中' },
]

// ── 组件 ──────────────────────────────────────────────────────────

export function Nav() {
  const t = useTranslations()
  const pathname = usePathname()
  const router = useRouter()
  const { user, logout } = useAuthStore()

  // 当前 locale（从 pathname 中提取，如 /en/browse → en）
  const currentLocale = pathname.split('/')[1] ?? 'en'

  function switchLocale(locale: string) {
    // 替换路径中的 locale 段
    const segments = pathname.split('/')
    segments[1] = locale
    router.push(segments.join('/'))
  }

  async function handleLogout() {
    try {
      await apiClient.post('/auth/logout', undefined)
    } catch {
      // 忽略 API 错误，仍然清除本地状态
    }
    logout()
  }

  return (
    <header
      className="sticky top-0 z-50 border-b backdrop-blur-sm"
      style={{ background: 'color-mix(in srgb, var(--background) 90%, transparent)', borderColor: 'var(--border)' }}
    >
      <div className="max-w-screen-xl mx-auto px-4 flex items-center gap-6 h-14">
        {/* Logo */}
        <Link
          href="/"
          className="text-xl font-bold tracking-tight shrink-0"
          style={{ color: 'var(--gold)' }}
          data-testid="nav-logo"
        >
          Resovo
        </Link>

        {/* 分类标签 */}
        <nav className="hidden sm:flex items-center gap-1 flex-1 overflow-x-auto scrollbar-none">
          {CATEGORIES.map((cat) => (
            <Link
              key={cat.key}
              href={cat.href}
              data-testid={`nav-cat-${cat.key}`}
              className={cn(
                'px-3 py-1.5 rounded-md text-sm whitespace-nowrap transition-colors',
                'hover:bg-[var(--secondary)]',
                // 粗略高亮当前分类
                pathname.includes(cat.href.split('?')[0]) && cat.href !== '/browse'
                  ? 'font-semibold text-[var(--foreground)]'
                  : 'text-[var(--muted-foreground)]'
              )}
            >
              {t(cat.labelKey)}
            </Link>
          ))}
        </nav>

        {/* 右侧操作区 */}
        <div className="flex items-center gap-2 shrink-0 ml-auto">
          {/* 主题切换 */}
          <ThemeToggle />

          {/* 语言切换 */}
          <div className="flex items-center rounded-md overflow-hidden border" style={{ borderColor: 'var(--border)' }}>
            {LOCALES.map((loc) => (
              <button
                key={loc.code}
                onClick={() => switchLocale(loc.code)}
                data-testid={`lang-${loc.code}`}
                className={cn(
                  'px-2.5 py-1 text-xs transition-colors',
                  currentLocale === loc.code
                    ? 'bg-[var(--secondary)] font-semibold text-[var(--foreground)]'
                    : 'text-[var(--muted-foreground)] hover:bg-[var(--secondary)]'
                )}
              >
                {loc.label}
              </button>
            ))}
          </div>

          {/* 用户状态 */}
          {user ? (
            <div className="flex items-center gap-3">
              <span
                data-testid="nav-username"
                className="text-sm font-medium hidden sm:block"
                style={{ color: 'var(--foreground)' }}
              >
                {user.username}
              </span>
              <button
                onClick={handleLogout}
                data-testid="nav-logout"
                className="text-sm px-3 py-1.5 rounded-md transition-colors hover:bg-[var(--secondary)]"
                style={{ color: 'var(--muted-foreground)' }}
              >
                {t('nav.logout')}
              </button>
            </div>
          ) : (
            <Link
              href="/auth/login"
              data-testid="nav-login"
              className="text-sm px-3 py-1.5 rounded-md font-medium transition-colors"
              style={{ background: 'var(--gold)', color: 'black' }}
            >
              {t('nav.signIn')}
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}
