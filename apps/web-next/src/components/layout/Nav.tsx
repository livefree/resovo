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
 *   2. 5 主分类 nav-link（首页/电影/剧集/动漫/综艺/纪录片）+ "更多 ▼" 下拉
 *      - MAIN_CATEGORIES 5 种（movie/series/anime/tvshow/documentary，含首页共 6 扁平）
 *      - MORE_CATEGORIES 6 种（short/sports/music/news/kids/other）进"更多"下拉
 *      - active 态：accent 色 + 底部 2px underline 贴 header 底部 border
 *      - hover 态：--bg-surface-sunken 浅灰背景
 *   3. 搜索 input：flex-1 max-w-[480px]，40px 高，圆角 10px
 *   4. 右侧：ThemeToggle（三态 radio）+ 齿轮设置按钮（档位 1 仅视觉占位）
 *
 * 档位 1 不做（留档位 2）：
 *   - 齿轮按钮 Settings Drawer
 *   - locale 切换（按 B 方案进 Settings Drawer）
 *   - 搜索 ⌘K 快捷键
 *
 * 修订（2026-04-23 用户反馈）：
 *   - 移除 scroll-collapse（让 underline 位置稳定，贴 header 底部 border）
 *   - underline `bottom: -1px` 覆盖 header 1px border
 *   - 加"更多 ▼"下拉覆盖剩余 6 种 VideoType（视频分类不足的反馈）
 */

// 5 主分类（扁平显示）
const MAIN_CATEGORIES = [
  { key: 'movie',       labelKey: 'nav.catMovie',       typeParam: 'movie' },
  { key: 'series',      labelKey: 'nav.catSeries',      typeParam: 'series' },
  { key: 'anime',       labelKey: 'nav.catAnime',       typeParam: 'anime' },
  { key: 'tvshow',      labelKey: 'nav.catVariety',     typeParam: 'tvshow' },
  { key: 'documentary', labelKey: 'nav.catDocumentary', typeParam: 'documentary' },
] as const

// 6 扩展分类（"更多 ▼" 下拉内）
const MORE_CATEGORIES = [
  { key: 'short',  labelKey: 'nav.catShort',  typeParam: 'short' },
  { key: 'sports', labelKey: 'nav.catSports', typeParam: 'sports' },
  { key: 'music',  labelKey: 'nav.catMusic',  typeParam: 'music' },
  { key: 'news',   labelKey: 'nav.catNews',   typeParam: 'news' },
  { key: 'kids',   labelKey: 'nav.catKids',   typeParam: 'kids' },
  { key: 'other',  labelKey: 'nav.catOther',  typeParam: 'other' },
] as const

const MORE_KEYS = new Set<string>(MORE_CATEGORIES.map((c) => c.typeParam))

// ── Nav.Skeleton ──────────────────────────────────────────────────────────────

function NavSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn('sticky top-0 z-50 border-b', className)}
      style={{
        height: '72px',
        background: 'var(--bg-canvas)',
        borderColor: 'var(--border-default)',
      }}
      data-testid="nav-skeleton"
      aria-hidden="true"
    >
      <div className="max-w-[1440px] mx-auto px-10 flex items-center h-full gap-8">
        <Skeleton shape="rect" width={120} height={28} />
        <div className="hidden sm:flex gap-3 flex-1">
          {[36, 36, 36, 36, 48, 48].map((w, i) => (
            <Skeleton key={i} shape="text" width={w} height={16} delay={300} />
          ))}
        </div>
        <Skeleton shape="rect" width={480} height={40} className="hidden md:block" />
        <div className="flex gap-2">
          <Skeleton shape="rect" width={120} height={40} />
          <Skeleton shape="rect" width={40} height={40} />
        </div>
      </div>
    </div>
  )
}

// ── NavLinkItem（内部复用，active underline 贴 header 底部 border） ────────────

interface NavLinkItemProps {
  readonly href: string
  readonly active: boolean
  readonly label: string
  readonly testId?: string
  /** header 内容区到 header 底部的距离（px），用于 underline 贴 header 底部 border */
  readonly bottomOffset: number
}

function NavLinkItem({ href, active, label, testId, bottomOffset }: NavLinkItemProps) {
  return (
    <Link
      href={href}
      data-testid={testId}
      className="relative transition-colors shrink-0 whitespace-nowrap"
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
            bottom: `-${bottomOffset}px`,
            height: '2px',
            background: 'var(--accent-default)',
            borderRadius: '1px',
          }}
        />
      )}
    </Link>
  )
}

// ── MoreMenu "更多 ▼" 下拉（6 种扩展 VideoType） ──────────────────────────────

interface MoreMenuProps {
  readonly locale: string
  readonly currentType: string | null
  readonly label: string
  readonly bottomOffset: number
}

function MoreMenu({ locale, currentType, label, bottomOffset }: MoreMenuProps) {
  const t = useTranslations()
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)

  const active = currentType !== null && MORE_KEYS.has(currentType)

  useEffect(() => {
    if (!open) return
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return
      setOpen(false)
    }
    function handleEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEsc)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEsc)
    }
  }, [open])

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        data-testid="nav-more-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((p) => !p)}
        className="relative flex items-center gap-1 transition-colors shrink-0 whitespace-nowrap"
        style={{
          padding: '8px 14px',
          fontSize: '14px',
          fontWeight: 600,
          borderRadius: '8px',
          background: 'transparent',
          border: 'none',
          textDecoration: 'none',
          cursor: 'pointer',
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
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          style={{
            transition: 'transform 160ms ease-out',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            opacity: 0.7,
          }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
        {active && (
          <span
            aria-hidden="true"
            style={{
              position: 'absolute',
              left: '14px',
              right: '14px',
              bottom: `-${bottomOffset}px`,
              height: '2px',
              background: 'var(--accent-default)',
              borderRadius: '1px',
            }}
          />
        )}
      </button>

      {open && (
        <div
          ref={menuRef}
          role="menu"
          data-testid="nav-more-menu"
          className="absolute z-50 top-full mt-2"
          style={{
            left: 0,
            minWidth: '180px',
            borderRadius: '10px',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-default)',
            boxShadow: '0 8px 24px color-mix(in oklch, var(--color-gray-1000) 12%, transparent)',
            padding: '6px',
          }}
        >
          {MORE_CATEGORIES.map((cat) => {
            const isActive = currentType === cat.typeParam
            return (
              <Link
                key={cat.key}
                href={`/${locale}/${cat.typeParam}`}
                role="menuitem"
                data-testid={`nav-more-${cat.key}`}
                onClick={() => setOpen(false)}
                className="block transition-colors"
                style={{
                  padding: '8px 12px',
                  fontSize: '14px',
                  fontWeight: 500,
                  borderRadius: '6px',
                  textDecoration: 'none',
                  color: isActive ? 'var(--accent-default)' : 'var(--fg-default)',
                  background: isActive ? 'var(--accent-muted)' : 'transparent',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) e.currentTarget.style.background = 'var(--bg-surface-sunken)'
                }}
                onMouseLeave={(e) => {
                  if (!isActive) e.currentTarget.style.background = 'transparent'
                }}
              >
                {t(cat.labelKey)}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Nav ───────────────────────────────────────────────────────────────────────

// UI-REBUILD 2026-04-23 用户反馈修订：
//   - header 从 h-16 (64px) → h-[72px]，上下各多 4px buffer（用户反馈"高度太窄
//     underline 超出 + 无留白"）
//   - 右侧元素统一 40px（搜索 / ThemeToggle / 齿轮）
// underline bottom：(72 - linkHeight 36) / 2 - 1 ≈ 17px，贴 header 底部 border 内侧
const HEADER_HEIGHT = 72
const UNDERLINE_BOTTOM_OFFSET = 17

export function Nav() {
  const { brand } = useBrand()
  const t = useTranslations()
  const pathname = usePathname()
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState('')
  const searchInputRef = useRef<HTMLInputElement | null>(null)

  const currentLocale = pathname.split('/')[1] ?? 'en'
  const currentType = pathname.split('/')[2] ?? null
  const isHomePage = !currentType

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
      className="sticky top-0 z-50 border-b backdrop-blur-md"
      style={{
        height: `${HEADER_HEIGHT}px`,
        background: 'color-mix(in oklch, var(--bg-canvas) 88%, transparent)',
        borderColor: 'var(--border-default)',
      }}
    >
      <div className="max-w-[1440px] mx-auto px-10 h-full flex items-center gap-8">
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

        {/* 2. 6 主 nav-link + "更多 ▼" 下拉（6 扩展分类）
            overflow-x-auto + link shrink-0：宽度不够时横向滚动（不换行/不消失） */}
        <nav
          className="flex items-center gap-1 flex-1 min-w-0 overflow-x-auto [&::-webkit-scrollbar]:hidden"
          aria-label="主导航"
          style={{
            // Firefox / IE / 老浏览器隐藏滚动条
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          }}
        >
          <NavLinkItem
            href={`/${currentLocale}`}
            active={isHomePage}
            label={t('nav.home')}
            testId="nav-home"
            bottomOffset={UNDERLINE_BOTTOM_OFFSET}
          />
          {MAIN_CATEGORIES.map((cat) => (
            <NavLinkItem
              key={cat.key}
              href={`/${currentLocale}/${cat.typeParam}`}
              active={currentType === cat.typeParam}
              label={t(cat.labelKey)}
              testId={`nav-cat-${cat.key}`}
              bottomOffset={UNDERLINE_BOTTOM_OFFSET}
            />
          ))}
          <MoreMenu
            locale={currentLocale}
            currentType={currentType}
            label={t('nav.more')}
            bottomOffset={UNDERLINE_BOTTOM_OFFSET}
          />
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

        {/* 4. 右侧：三态 ThemeToggle + 齿轮；统一高度 40px，gap-2 (8px) 间隔
             （档位 1 齿轮仅视觉占位，不绑 Drawer） */}
        <div className="flex items-center gap-2 shrink-0">
          <ThemeToggle />

          <button
            type="button"
            data-testid="nav-settings"
            aria-label={t('nav.settings')}
            title={t('nav.settings')}
            className="inline-flex items-center justify-center transition-colors"
            style={{
              width: '40px',
              height: '40px',
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
