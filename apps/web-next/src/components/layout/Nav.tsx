'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { useBrand } from '@/hooks/useBrand'
import { cn } from '@/lib/utils'
import { MegaMenu } from './MegaMenu'
import type { MegaMenuItem } from './MegaMenu'
import { Skeleton } from '@/components/primitives/feedback/Skeleton'

const MAIN_CATEGORIES = [
  { key: 'movie',  labelKey: 'nav.catMovie',  typeParam: 'movie' },
  { key: 'series', labelKey: 'nav.catSeries', typeParam: 'series' },
  { key: 'anime',  labelKey: 'nav.catAnime',  typeParam: 'anime' },
]

const MORE_CATEGORY_KEYS = [
  { key: 'tvshow',      labelKey: 'nav.catVariety',     typeParam: 'tvshow' },
  { key: 'documentary', labelKey: 'nav.catDocumentary', typeParam: 'documentary' },
  { key: 'short',       labelKey: 'nav.catShort',       typeParam: 'short' },
  { key: 'sports',      labelKey: 'nav.catSports',      typeParam: 'sports' },
  { key: 'music',       labelKey: 'nav.catMusic',       typeParam: 'music' },
  { key: 'news',        labelKey: 'nav.catNews',        typeParam: 'news' },
  { key: 'kids',        labelKey: 'nav.catKids',        typeParam: 'kids' },
  { key: 'other',       labelKey: 'nav.catOther',       typeParam: 'other' },
]

const LOCALES = [
  { code: 'en',    label: 'English', short: 'EN' },
  { code: 'zh-CN', label: '中文',    short: '中' },
]

const SCROLL_COLLAPSE_PX = 80

// ── Nav.Skeleton ──────────────────────────────────────────────────────────────

function NavSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn('sticky top-0 z-50 h-16 border-b', className)}
      style={{ background: 'var(--bg-canvas)', borderColor: 'var(--border-default)' }}
      data-testid="nav-skeleton"
      aria-hidden="true"
    >
      <div className="max-w-screen-xl mx-auto px-4 flex items-center h-full gap-6">
        <Skeleton shape="text" width={80} height={20} />
        <div className="hidden sm:flex gap-3">
          {[56, 48, 52, 40].map((w, i) => (
            <Skeleton key={i} shape="text" width={w} height={16} delay={300} />
          ))}
        </div>
        <div className="ml-auto flex gap-2">
          <Skeleton shape="rect" width={240} height={36} />
          <Skeleton shape="rect" width={32} height={32} />
        </div>
      </div>
    </div>
  )
}

// ── Nav ───────────────────────────────────────────────────────────────────────

export function Nav() {
  const { brand } = useBrand()
  const t = useTranslations()
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isLocaleOpen, setIsLocaleOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const localeMenuRef = useRef<HTMLDivElement | null>(null)
  const localeTriggerRef = useRef<HTMLButtonElement | null>(null)
  const searchPillRef = useRef<HTMLButtonElement | null>(null)

  const currentLocale = pathname.split('/')[1] ?? 'en'
  const currentType = pathname.split('/')[2] ?? null

  // Scroll-collapse: h-16 → h-12 past 80px
  useEffect(() => {
    setCollapsed(window.scrollY > SCROLL_COLLAPSE_PX)
    function onScroll() {
      setCollapsed(window.scrollY > SCROLL_COLLAPSE_PX)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (!isLocaleOpen) return

    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node
      if (
        localeMenuRef.current?.contains(target) ||
        localeTriggerRef.current?.contains(target)
      ) return
      setIsLocaleOpen(false)
    }

    function handleEsc(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsLocaleOpen(false)
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEsc)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEsc)
    }
  }, [isLocaleOpen])

  function switchLocale(locale: string) {
    const segments = pathname.split('/')
    segments[1] = locale
    const nextPath = segments.join('/')
    const query = searchParams.toString()
    router.push(query ? `${nextPath}?${query}` : nextPath)
    setIsLocaleOpen(false)
  }

  const navigateToSearch = useCallback(() => {
    if (searchPillRef.current) {
      const rect = searchPillRef.current.getBoundingClientRect()
      const x = Math.round(rect.left + rect.width / 2)
      const y = Math.round(rect.top + rect.height / 2)
      try { sessionStorage.setItem('resovo:search-reveal-origin', JSON.stringify({ x, y })) } catch { /* ignore */ }
    }
    router.push(`/${currentLocale}/search`)
  }, [router, currentLocale])

  // ⌘K / Ctrl+K global shortcut
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        navigateToSearch()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [navigateToSearch])

  const moreItems: MegaMenuItem[] = MORE_CATEGORY_KEYS.map((cat) => ({
    key:    cat.key,
    label:  t(cat.labelKey),
    href:   `/${currentLocale}/${cat.typeParam}`,
    active: currentType === cat.typeParam,
  }))

  return (
    <header
      data-testid="global-nav"
      className={cn(
        'sticky top-0 z-50 border-b backdrop-blur-md',
        'transition-[height] duration-200 ease-out',
        collapsed ? 'h-12' : 'h-16',
      )}
      style={{
        background: 'color-mix(in srgb, var(--bg-canvas) 88%, transparent)',
        borderColor: 'var(--border-default)',
      }}
    >
      <div className="max-w-screen-xl mx-auto px-4 flex items-center gap-6 h-full">
        {/* Logo */}
        <Link
          href="/"
          className="text-[22px] font-extrabold shrink-0"
          style={{ color: 'var(--accent-default)', letterSpacing: '-0.02em' }}
          data-testid="nav-logo"
        >
          {brand.name}
        </Link>

        {/* Category nav */}
        <nav className="hidden sm:flex items-center gap-1 flex-1 overflow-visible ml-4">
          <Link
            href="/"
            className={cn(
              'px-3 py-1.5 rounded-md text-sm whitespace-nowrap transition-colors',
              'hover:bg-[var(--bg-surface-sunken)] hover:text-[var(--fg-default)]',
              pathname === '/en' || pathname === '/zh-CN' || pathname === '/'
                ? 'font-bold bg-[var(--accent-muted)] text-[var(--accent-default)]'
                : 'font-medium text-[var(--fg-muted)]',
            )}
          >
            {t('nav.home')}
          </Link>

          {MAIN_CATEGORIES.map((cat) => {
            const isActive = currentType === cat.typeParam
            return (
              <Link
                key={cat.key}
                href={`/${currentLocale}/${cat.typeParam}`}
                data-testid={`nav-cat-${cat.key}`}
                className={cn(
                  'px-3 py-1.5 rounded-md text-sm whitespace-nowrap transition-colors',
                  'hover:bg-[var(--bg-surface-sunken)] hover:text-[var(--fg-default)]',
                  isActive
                    ? 'font-bold bg-[var(--accent-muted)] text-[var(--accent-default)]'
                    : 'font-medium text-[var(--fg-muted)]',
                )}
              >
                {t(cat.labelKey)}
              </Link>
            )
          })}

          {/* Mega Menu — 更多分类 */}
          <MegaMenu
            items={moreItems}
            trigger={
              <button
                type="button"
                data-testid="nav-more-trigger"
                className={cn(
                  'flex items-center gap-1 px-3 py-1.5 rounded-md text-sm transition-colors cursor-pointer',
                  'hover:bg-[var(--bg-surface-sunken)] hover:text-[var(--fg-default)] font-medium text-[var(--fg-muted)]',
                )}
              >
                {t('nav.more')}
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="opacity-70"
                  aria-hidden="true"
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
            }
          />
        </nav>

        {/* 右侧操作区 */}
        <div className="flex items-center gap-2 shrink-0 ml-auto">
          {/* 搜索 pill — 240px always-on，⌘K 快捷键触发 */}
          <button
            ref={searchPillRef}
            type="button"
            data-testid="nav-search"
            onClick={navigateToSearch}
            aria-label={t('nav.searchPlaceholder')}
            className="hidden sm:flex items-center gap-2 h-9 w-60 rounded-full border px-3.5 cursor-pointer transition-colors hover:border-[var(--accent-default)]"
            style={{ background: 'var(--bg-surface-sunken)', borderColor: 'var(--border-default)' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ color: 'var(--fg-subtle)', flexShrink: 0 }}>
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <span className="flex-1 text-left text-[13px] truncate" style={{ color: 'var(--fg-subtle)' }}>
              {t('nav.searchPlaceholder')}
            </span>
            <span
              className="text-[10px] px-1.5 py-0.5 rounded border shrink-0"
              style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-default)', color: 'var(--fg-subtle)' }}
            >
              ⌘K
            </span>
          </button>

          <ThemeToggle />

          {/* 语言切换 */}
          <div className="relative">
            <button
              ref={localeTriggerRef}
              type="button"
              data-testid="nav-locale-trigger"
              aria-haspopup="menu"
              aria-expanded={isLocaleOpen}
              aria-label={t('nav.language')}
              onClick={() => setIsLocaleOpen((prev) => !prev)}
              className="h-8 w-8 rounded-md border inline-flex items-center justify-center text-[var(--fg-muted)] hover:text-[var(--fg-default)] hover:bg-[var(--bg-surface-sunken)] transition-colors"
              style={{ borderColor: 'var(--border-default)' }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <path d="M2 12h20" />
                <path d="M12 2a15.3 15.3 0 0 1 0 20" />
                <path d="M12 2a15.3 15.3 0 0 0 0 20" />
              </svg>
            </button>
            {isLocaleOpen && (
              <div className="absolute right-0 top-full pt-2 z-50">
                <div
                  ref={localeMenuRef}
                  role="menu"
                  data-testid="nav-locale-menu"
                  className="min-w-[140px] rounded-lg border shadow-xl p-1.5"
                  style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-default)' }}
                >
                  {LOCALES.map((loc) => (
                    <button
                      key={loc.code}
                      type="button"
                      role="menuitem"
                      onClick={() => switchLocale(loc.code)}
                      data-testid={`lang-${loc.code}`}
                      className={cn(
                        'w-full text-left px-3 py-2 rounded-md text-sm transition-colors',
                        currentLocale === loc.code
                          ? 'bg-[var(--bg-surface-sunken)] text-[var(--fg-default)] font-semibold'
                          : 'text-[var(--fg-muted)] hover:bg-[var(--bg-surface-sunken)] hover:text-[var(--fg-default)]',
                      )}
                    >
                      {loc.short} · {loc.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}

Nav.Skeleton = NavSkeleton
