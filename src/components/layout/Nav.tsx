/**
 * Nav.tsx — 顶部导航栏
 * Logo + 分类标签 + 搜索框 + 主题切换 + 语言切换 + 用户状态
 */

'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useAuthStore } from '@/stores/authStore'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { apiClient } from '@/lib/api-client'
import { cn } from '@/lib/utils'

// ── 分类标签 ──────────────────────────────────────────────────────

const CATEGORIES = [
  { key: 'all',     labelKey: 'nav.catAll',     href: '/browse',              typeParam: '' },
  { key: 'movie',   labelKey: 'nav.catMovie',   href: '/browse?type=movie',   typeParam: 'movie' },
  { key: 'series',  labelKey: 'nav.catSeries',  href: '/browse?type=series',  typeParam: 'series' },
  { key: 'anime',   labelKey: 'nav.catAnime',   href: '/browse?type=anime',   typeParam: 'anime' },
  { key: 'variety', labelKey: 'nav.catVariety', href: '/browse?type=variety', typeParam: 'variety' },
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
  const searchParams = useSearchParams()
  const { user, logout } = useAuthStore()
  const [searchQuery, setSearchQuery] = useState('')

  // 当前 locale（从 pathname 中提取，如 /en/browse → en）
  const currentLocale = pathname.split('/')[1] ?? 'en'

  // 当前 URL 中的 type 参数（用于分类标签高亮）
  const currentType = pathname.includes('/browse') ? (searchParams.get('type') ?? '') : null

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

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    const q = searchQuery.trim()
    router.push(q ? `/search?q=${encodeURIComponent(q)}` : '/search')
  }

  const isAdminOrModerator = user?.role === 'admin' || user?.role === 'moderator'

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
          {CATEGORIES.map((cat) => {
            // 精确高亮：在浏览页时对比 type 参数
            const isActive = currentType !== null
              ? currentType === cat.typeParam
              : false

            return (
              <Link
                key={cat.key}
                href={cat.href}
                data-testid={`nav-cat-${cat.key}`}
                className={cn(
                  'px-3 py-1.5 rounded-md text-sm whitespace-nowrap transition-colors',
                  'hover:bg-[var(--secondary)]',
                  isActive
                    ? 'font-semibold text-[var(--foreground)]'
                    : 'text-[var(--muted-foreground)]'
                )}
              >
                {t(cat.labelKey)}
              </Link>
            )
          })}
        </nav>

        {/* 右侧操作区 */}
        <div className="flex items-center gap-2 shrink-0 ml-auto">
          {/* 搜索框 */}
          <form onSubmit={handleSearch} className="hidden sm:flex items-center">
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('nav.search')}
              data-testid="nav-search"
              className="w-28 rounded-md px-2.5 py-1 text-xs border outline-none focus:w-40 transition-all"
              style={{
                background: 'var(--secondary)',
                borderColor: 'var(--border)',
                color: 'var(--foreground)',
              }}
            />
          </form>

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
            <div className="flex items-center gap-2">
              {/* 管理后台入口（admin / moderator 专属） */}
              {isAdminOrModerator && (
                <Link
                  href="/admin"
                  data-testid="nav-admin"
                  className="text-sm px-3 py-1.5 rounded-md font-medium transition-colors hover:opacity-80"
                  style={{ color: 'var(--gold)' }}
                >
                  {t('nav.admin')}
                </Link>
              )}

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
