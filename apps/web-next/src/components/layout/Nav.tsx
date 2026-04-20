'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { useBrand } from '@/hooks/useBrand'
import { cn } from '@/lib/utils'

const MAIN_CATEGORIES = [
  { key: 'movie',  labelKey: 'nav.catMovie',  href: '/browse?type=movie',  typeParam: 'movie' },
  { key: 'series', labelKey: 'nav.catSeries', href: '/browse?type=series', typeParam: 'series' },
  { key: 'anime',  labelKey: 'nav.catAnime',  href: '/browse?type=anime',  typeParam: 'anime' },
]

const MORE_CATEGORIES = [
  { key: 'all',          labelKey: 'nav.catAll',          href: '/browse',                    typeParam: '' },
  { key: 'tvshow',       labelKey: 'nav.catVariety',      href: '/browse?type=tvshow',        typeParam: 'tvshow' },
  { key: 'documentary',  labelKey: 'nav.catDocumentary',  href: '/browse?type=documentary',   typeParam: 'documentary' },
  { key: 'short',        labelKey: 'nav.catShort',        href: '/browse?type=short',         typeParam: 'short' },
  { key: 'sports',       labelKey: 'nav.catSports',       href: '/browse?type=sports',        typeParam: 'sports' },
  { key: 'music',        labelKey: 'nav.catMusic',        href: '/browse?type=music',         typeParam: 'music' },
  { key: 'news',         labelKey: 'nav.catNews',         href: '/browse?type=news',          typeParam: 'news' },
  { key: 'kids',         labelKey: 'nav.catKids',         href: '/browse?type=kids',          typeParam: 'kids' },
  { key: 'other',        labelKey: 'nav.catOther',        href: '/browse?type=other',         typeParam: 'other' },
]

const LOCALES = [
  { code: 'en',    label: 'English', short: 'EN' },
  { code: 'zh-CN', label: '中文',    short: '中' },
]

export function Nav() {
  const { brand } = useBrand()
  const t = useTranslations()
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [searchQuery, setSearchQuery] = useState('')
  const [isMoreOpen, setIsMoreOpen] = useState(false)
  const [isLocaleOpen, setIsLocaleOpen] = useState(false)
  const moreMenuRef = useRef<HTMLDivElement | null>(null)
  const moreTriggerRef = useRef<HTMLButtonElement | null>(null)
  const firstMoreItemRef = useRef<HTMLAnchorElement | null>(null)
  const localeMenuRef = useRef<HTMLDivElement | null>(null)
  const localeTriggerRef = useRef<HTMLButtonElement | null>(null)

  const currentLocale = pathname.split('/')[1] ?? 'en'
  const currentType = pathname.includes('/browse') ? (searchParams.get('type') ?? '') : null

  useEffect(() => {
    if (!isMoreOpen && !isLocaleOpen) return

    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node
      if (
        moreMenuRef.current?.contains(target) ||
        moreTriggerRef.current?.contains(target) ||
        localeMenuRef.current?.contains(target) ||
        localeTriggerRef.current?.contains(target)
      ) return
      setIsMoreOpen(false)
      setIsLocaleOpen(false)
    }

    function handleEsc(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      setIsMoreOpen(false)
      setIsLocaleOpen(false)
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEsc)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEsc)
    }
  }, [isLocaleOpen, isMoreOpen])

  function switchLocale(locale: string) {
    const segments = pathname.split('/')
    segments[1] = locale
    const nextPath = segments.join('/')
    const query = searchParams.toString()
    router.push(query ? `${nextPath}?${query}` : nextPath)
    setIsLocaleOpen(false)
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    const q = searchQuery.trim()
    router.push(q ? `/search?q=${encodeURIComponent(q)}` : '/search')
  }

  function openMoreMenuAndFocusFirst() {
    setIsLocaleOpen(false)
    setIsMoreOpen(true)
    requestAnimationFrame(() => firstMoreItemRef.current?.focus())
  }

  function handleMoreTriggerKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      openMoreMenuAndFocusFirst()
    }
  }

  return (
    <header
      className="sticky top-0 z-50 border-b backdrop-blur-sm"
      style={{ background: 'color-mix(in srgb, var(--bg-canvas) 90%, transparent)', borderColor: 'var(--border-default)' }}
    >
      <div className="max-w-screen-xl mx-auto px-4 flex items-center gap-6 h-14">
        {/* Logo */}
        <Link
          href="/"
          className="text-xl font-bold tracking-tight shrink-0"
          style={{ color: 'var(--accent-default)' }}
          data-testid="nav-logo"
        >
          {brand.name}
        </Link>

        {/* 分类标签 */}
        <nav className="hidden sm:flex items-center gap-1 flex-1 overflow-visible ml-4">
          <Link
            href="/"
            className={cn(
              'px-3 py-1.5 rounded-md text-sm whitespace-nowrap transition-colors',
              'hover:bg-[var(--bg-surface-sunken)] hover:text-[var(--fg-default)]',
              pathname === '/en' || pathname === '/zh-CN' || pathname === '/'
                ? 'font-semibold text-[var(--accent-default)]'
                : 'text-[var(--fg-muted)]'
            )}
          >
            {t('nav.home')}
          </Link>

          {MAIN_CATEGORIES.map((cat) => {
            const isActive = currentType !== null ? currentType === cat.typeParam : false
            return (
              <Link
                key={cat.key}
                href={cat.href}
                data-testid={`nav-cat-${cat.key}`}
                className={cn(
                  'px-3 py-1.5 rounded-md text-sm whitespace-nowrap transition-colors',
                  'hover:bg-[var(--bg-surface-sunken)] hover:text-[var(--fg-default)]',
                  isActive
                    ? 'font-semibold text-[var(--accent-default)]'
                    : 'text-[var(--fg-muted)]'
                )}
              >
                {t(cat.labelKey)}
              </Link>
            )
          })}

          {/* 更多分类 Dropdown */}
          <div className="relative">
            <button
              ref={moreTriggerRef}
              type="button"
              data-testid="nav-more-trigger"
              aria-haspopup="menu"
              aria-expanded={isMoreOpen}
              onClick={() => setIsMoreOpen((prev) => !prev)}
              onKeyDown={handleMoreTriggerKeyDown}
              className={cn(
                'flex items-center gap-1 px-3 py-1.5 rounded-md text-sm transition-colors cursor-pointer',
                'hover:bg-[var(--bg-surface-sunken)] hover:text-[var(--fg-default)] text-[var(--fg-muted)]'
              )}
            >
              {t('nav.more')}
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={cn('opacity-70 transition-transform duration-200', isMoreOpen && 'rotate-180')}>
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </button>
            {isMoreOpen ? (
              <div className="absolute top-full left-0 pt-2 z-50" data-testid="nav-more-menu-wrap">
                <div
                  ref={moreMenuRef}
                  role="menu"
                  data-testid="nav-more-menu"
                  className="bg-[var(--bg-surface)] border rounded-lg shadow-xl p-1.5 min-w-[120px] flex flex-col gap-0.5"
                  style={{ borderColor: 'var(--border-default)' }}
                >
                  {MORE_CATEGORIES.map((cat, index) => {
                    const isActive = currentType === cat.typeParam
                    return (
                      <Link
                        key={cat.key}
                        ref={index === 0 ? firstMoreItemRef : undefined}
                        href={cat.href}
                        role="menuitem"
                        tabIndex={0}
                        data-testid={`nav-cat-${cat.key}`}
                        onClick={() => setIsMoreOpen(false)}
                        onKeyDown={(event) => {
                          if (event.key === 'Escape') {
                            setIsMoreOpen(false)
                            moreTriggerRef.current?.focus()
                          }
                        }}
                        className={cn(
                          'px-3 py-2 rounded-md text-sm transition-colors text-left',
                          'hover:bg-[var(--bg-surface-sunken)] hover:text-[var(--fg-default)]',
                          isActive
                            ? 'font-semibold text-[var(--accent-default)] bg-[var(--bg-surface-sunken)]'
                            : 'text-[var(--fg-muted)]'
                        )}
                      >
                        {t(cat.labelKey)}
                      </Link>
                    )
                  })}
                </div>
              </div>
            ) : null}
          </div>
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
                background: 'var(--bg-surface-sunken)',
                borderColor: 'var(--border-default)',
                color: 'var(--fg-default)',
              }}
            />
          </form>

          {/* 主题切换 */}
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
              onClick={() => {
                setIsLocaleOpen((prev) => !prev)
                setIsMoreOpen(false)
              }}
              className="h-8 w-8 rounded-md border inline-flex items-center justify-center text-[var(--fg-muted)] hover:text-[var(--fg-default)] hover:bg-[var(--bg-surface-sunken)] transition-colors"
              style={{ borderColor: 'var(--border-default)' }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <path d="M2 12h20"></path>
                <path d="M12 2a15.3 15.3 0 0 1 0 20"></path>
                <path d="M12 2a15.3 15.3 0 0 0 0 20"></path>
              </svg>
            </button>
            {isLocaleOpen ? (
              <div className="absolute right-0 top-full pt-2 z-50">
                <div
                  ref={localeMenuRef}
                  role="menu"
                  data-testid="nav-locale-menu"
                  className="min-w-[140px] rounded-lg border shadow-xl p-1.5 bg-[var(--bg-surface)]"
                  style={{ borderColor: 'var(--border-default)' }}
                >
                  {LOCALES.map((loc) => (
                    <button
                      key={loc.code}
                      onClick={() => switchLocale(loc.code)}
                      data-testid={`lang-${loc.code}`}
                      className={cn(
                        'w-full text-left px-3 py-2 rounded-md text-sm transition-colors',
                        currentLocale === loc.code
                          ? 'bg-[var(--bg-surface-sunken)] text-[var(--fg-default)] font-semibold'
                          : 'text-[var(--fg-muted)] hover:bg-[var(--bg-surface-sunken)] hover:text-[var(--fg-default)]'
                      )}
                    >
                      {loc.short} · {loc.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

        </div>
      </div>
    </header>
  )
}
