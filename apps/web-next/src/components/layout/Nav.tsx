'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { usePathname, useRouter } from 'next/navigation'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { useBrand } from '@/hooks/useBrand'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/primitives/feedback/Skeleton'

/**
 * Nav — UI-REBUILD-02 对齐 docs/handoff_20260422/designs/Global Shell.html:321-357
 *
 * 结构（从左到右）：
 *   1. Logo：渐变方块 "R" + "Resovo" 文字
 *   2. 6 个 nav-link（首页/电影/剧集/动漫/综艺/纪录片）扁平无子菜单
 *      - active 态：accent 色 + 底部 2px underline
 *      - hover 态：--bg-surface-sunken 浅灰背景
 *   3. 搜索 input：flex-1 max-w-[480px]，40px 高，圆角 10px
 *   4. 右侧：ThemeToggle（三态 radio）+ 齿轮设置按钮（档位 1 仅视觉占位）
 *
 * 档位 1 不做（留档位 2）：
 *   - 齿轮按钮 Settings Drawer
 *   - locale 切换（按 B 方案进 Settings Drawer）
 *   - 搜索 ⌘K 快捷键
 *   - "更多 ▾" MegaMenu（设计稿扁平 6 链接）
 *
 * 保留（X 方案）：scroll-collapse h-16 → h-12；backdrop-blur-md；Nav.Skeleton
 */

// 5 个顶层分类 + 首页 = 6 个 nav-link（设计稿扁平结构，无二级菜单）
const MAIN_CATEGORIES = [
  { key: 'movie',       labelKey: 'nav.catMovie',       typeParam: 'movie' },
  { key: 'series',      labelKey: 'nav.catSeries',      typeParam: 'series' },
  { key: 'anime',       labelKey: 'nav.catAnime',       typeParam: 'anime' },
  { key: 'tvshow',      labelKey: 'nav.catVariety',     typeParam: 'tvshow' },
  { key: 'documentary', labelKey: 'nav.catDocumentary', typeParam: 'documentary' },
] as const

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
      <div className="max-w-[1440px] mx-auto px-8 flex items-center h-full gap-8">
        <Skeleton shape="rect" width={120} height={28} />
        <div className="hidden sm:flex gap-3 flex-1">
          {[36, 36, 36, 36, 48].map((w, i) => (
            <Skeleton key={i} shape="text" width={w} height={16} delay={300} />
          ))}
        </div>
        <Skeleton shape="rect" width={480} height={40} className="hidden md:block" />
        <div className="flex gap-2">
          <Skeleton shape="rect" width={96} height={36} />
          <Skeleton shape="rect" width={38} height={38} />
        </div>
      </div>
    </div>
  )
}

// ── NavLinkItem（内部复用，active underline） ─────────────────────────────────

interface NavLinkItemProps {
  readonly href: string
  readonly active: boolean
  readonly label: string
  readonly testId?: string
}

function NavLinkItem({ href, active, label, testId }: NavLinkItemProps) {
  return (
    <Link
      href={href}
      data-testid={testId}
      className="relative transition-colors"
      style={{
        padding: '8px 14px',
        fontSize: '14px',
        fontWeight: 600,
        borderRadius: '8px',
        textDecoration: 'none',
        color: active ? 'var(--accent-default)' : 'var(--fg-muted)',
      }}
      onMouseEnter={(e) => {
        if (!active) {
          e.currentTarget.style.color = 'var(--fg-default)'
          e.currentTarget.style.background = 'var(--bg-surface-sunken)'
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          e.currentTarget.style.color = 'var(--fg-muted)'
          e.currentTarget.style.background = 'transparent'
        }
      }}
    >
      {label}
      {active && (
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: '14px',
            right: '14px',
            bottom: '-16px',
            height: '2px',
            background: 'var(--accent-default)',
            borderRadius: '1px',
          }}
        />
      )}
    </Link>
  )
}

// ── Nav ───────────────────────────────────────────────────────────────────────

export function Nav() {
  const { brand } = useBrand()
  const t = useTranslations()
  const pathname = usePathname()
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const searchInputRef = useRef<HTMLInputElement | null>(null)

  const currentLocale = pathname.split('/')[1] ?? 'en'
  const currentType = pathname.split('/')[2] ?? null
  const isHomePage = !currentType

  // Scroll-collapse: h-16 → h-12 past 80px（X 方案保留既有体验）
  useEffect(() => {
    setCollapsed(window.scrollY > SCROLL_COLLAPSE_PX)
    function onScroll() {
      setCollapsed(window.scrollY > SCROLL_COLLAPSE_PX)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const submitSearch = useCallback(
    (q: string) => {
      const trimmed = q.trim()
      const url = trimmed
        ? `/${currentLocale}/search?q=${encodeURIComponent(trimmed)}`
        : `/${currentLocale}/search`
      router.push(url)
    },
    [router, currentLocale],
  )

  return (
    <header
      data-testid="global-nav"
      className={cn(
        'sticky top-0 z-50 border-b backdrop-blur-md',
        'transition-[height] duration-200 ease-out',
        collapsed ? 'h-12' : 'h-16',
      )}
      style={{
        background: 'color-mix(in oklch, var(--bg-canvas) 88%, transparent)',
        borderColor: 'var(--border-default)',
      }}
    >
      <div className="max-w-[1440px] mx-auto px-8 h-full flex items-center gap-8">
        {/* 1. Logo — 28px 渐变方块 + Resovo 文字 */}
        <Link
          href={`/${currentLocale}`}
          data-testid="nav-logo"
          className="flex items-center gap-2.5 font-black shrink-0"
          style={{
            fontSize: '20px',
            letterSpacing: '-0.02em',
            color: 'var(--fg-default)',
            textDecoration: 'none',
          }}
        >
          <span
            aria-hidden="true"
            className="flex items-center justify-center"
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '7px',
              background:
                'linear-gradient(135deg, var(--accent-default), oklch(48% 0.22 280))',
              color: 'var(--color-gray-0)',
              fontSize: '13px',
              fontWeight: 900,
            }}
          >
            R
          </span>
          {brand.name}
        </Link>

        {/* 2. 6 个 nav-link 扁平（首页 + 5 分类） */}
        <nav className="hidden sm:flex items-center gap-1 flex-1" aria-label="主导航">
          <NavLinkItem
            href={`/${currentLocale}`}
            active={isHomePage}
            label={t('nav.home')}
            testId="nav-home"
          />
          {MAIN_CATEGORIES.map((cat) => (
            <NavLinkItem
              key={cat.key}
              href={`/${currentLocale}/${cat.typeParam}`}
              active={currentType === cat.typeParam}
              label={t(cat.labelKey)}
              testId={`nav-cat-${cat.key}`}
            />
          ))}
        </nav>

        {/* 3. 搜索 input（max-480px，Enter 跳 /search?q=） */}
        <form
          role="search"
          onSubmit={(e) => {
            e.preventDefault()
            submitSearch(searchQuery)
          }}
          className="hidden md:block flex-1 max-w-[480px] relative"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            style={{
              position: 'absolute',
              left: '14px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--fg-subtle)',
              pointerEvents: 'none',
            }}
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            ref={searchInputRef}
            type="search"
            data-testid="nav-search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('nav.searchPlaceholder')}
            aria-label={t('nav.searchPlaceholder')}
            enterKeyHint="search"
            className="w-full outline-none focus:border-[var(--accent-default)] focus:bg-[var(--bg-surface)]"
            style={{
              height: '40px',
              padding: '0 16px 0 42px',
              fontSize: '14px',
              borderRadius: '10px',
              border: '1px solid var(--border-default)',
              background: 'var(--bg-surface-sunken)',
              color: 'var(--fg-default)',
            }}
          />
        </form>

        {/* 4. 右侧：三态 ThemeToggle + 齿轮（档位 1 仅视觉占位） */}
        <div className="flex items-center gap-1 shrink-0">
          <ThemeToggle />

          <button
            type="button"
            data-testid="nav-settings"
            aria-label={t('nav.settings')}
            title={t('nav.settings')}
            className="inline-flex items-center justify-center transition-colors"
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '8px',
              background: 'transparent',
              border: 'none',
              color: 'var(--fg-muted)',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--bg-surface-sunken)'
              e.currentTarget.style.color = 'var(--fg-default)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.color = 'var(--fg-muted)'
            }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
        </div>
      </div>
    </header>
  )
}

Nav.Skeleton = NavSkeleton
