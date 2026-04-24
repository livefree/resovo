'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { usePathname, useRouter } from 'next/navigation'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { useBrand } from '@/hooks/useBrand'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/primitives/feedback/Skeleton'
import { SearchOverlay } from '@/components/search/SearchOverlay'
import { ALL_CATEGORIES, MAIN_TYPE_PARAMS, MORE_TYPE_PARAMS } from '@/lib/categories'

/**
 * Nav — HANDOFF-21 对齐 docs/frontend_design_spec_20260423.md §8
 *
 * 结构（从左到右）：
 *   1. Logo：渐变方块 "R" + 品牌名
 *   2. 主分类 nav-link（首页/电影/剧集/动漫/综艺/纪录片）+ "更多 ▼" 下拉
 *      - MAIN_TYPE_PARAMS 5 种 + 首页共 6 扁平
 *      - MORE_TYPE_PARAMS 6 种（short/sports/music/news/kids/other）进"更多"下拉
 *      - 分类数据单源 lib/categories.ts（I-6）
 *   3. 搜索 input（flex-1，max-width 240px by --search-input-max-w）
 *      - ⌘K（Mac）/ Ctrl+K（其他）徽章；键盘监听打开浮层（I-1/I-3）
 *      - 浮层无输入时展示 nav.hotSearchTerms 热搜列表（I-1）
 *   4. 右侧：ThemeToggle + 齿轮设置按钮（w-full 保证贴右，I-2）
 *   5. "更多" 下拉：hover 展开（桌面）/ click 展开（触屏）（I-5）
 */

// 主分类（5 种，扁平显示），单源 lib/categories.ts（I-6）
const MAIN_CATS = ALL_CATEGORIES.filter((c) =>
  (MAIN_TYPE_PARAMS as readonly string[]).includes(c.typeParam)
)

// 扩展分类（6 种，"更多 ▼" 下拉内），单源 lib/categories.ts（I-6）
const MORE_CATS = ALL_CATEGORIES.filter((c) =>
  (MORE_TYPE_PARAMS as readonly string[]).includes(c.typeParam)
)

const MORE_KEYS = new Set<string>(MORE_TYPE_PARAMS)

// ── Nav.Skeleton ──────────────────────────────────────────────────────────────

function NavSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn('sticky top-0 z-50 border-b', className)}
      style={{
        height: 'var(--header-height)',
        background: 'var(--bg-canvas)',
        borderColor: 'var(--border-default)',
      }}
      data-testid="nav-skeleton"
      aria-hidden="true"
    >
      <div className="max-w-shell mx-auto px-8 flex items-center h-full gap-6 w-full">
        <Skeleton shape="rect" width={120} height={28} />
        <div className="hidden sm:flex gap-3 flex-1">
          {[36, 36, 36, 36, 48, 48].map((w, i) => (
            <Skeleton key={i} shape="text" width={w} height={16} delay={300} />
          ))}
        </div>
        <Skeleton shape="rect" width={240} height={40} className="hidden md:block flex-1" />
        <div className="flex gap-2">
          <Skeleton shape="rect" width={120} height={40} />
          <Skeleton shape="rect" width={40} height={40} />
        </div>
      </div>
    </div>
  )
}

// ── NavLinkItem（active underline 贴 header 底部 border）──────────────────────

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
      className="relative transition-colors shrink-0 whitespace-nowrap"
      style={{
        padding: 'var(--header-nav-padding)',
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
            bottom: 'calc(-1 * var(--header-underline-offset))',
            height: '2px',
            background: 'var(--accent-default)',
            borderRadius: '1px',
          }}
        />
      )}
    </Link>
  )
}

// ── MoreMenu "更多 ▼" 下拉（I-5：hover 展开桌面 / click 展开触屏）────────────

interface MoreMenuProps {
  readonly locale: string
  readonly currentType: string | null
  readonly label: string
}

function MoreMenu({ locale, currentType, label }: MoreMenuProps) {
  const t = useTranslations('nav')
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement | null>(null)

  const active = currentType !== null && MORE_KEYS.has(currentType)

  // 点击外部 + ESC 关闭（touch 模式下需要）
  useEffect(() => {
    if (!open) return
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current?.contains(e.target as Node)) return
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

  function handleMouseEnter() {
    // hover 展开仅用于 pointer: fine（桌面鼠标）设备（I-5）
    if (typeof window !== 'undefined' && window.matchMedia('(hover: hover)').matches) {
      setOpen(true)
    }
  }

  function handleMouseLeave() {
    if (typeof window !== 'undefined' && window.matchMedia('(hover: hover)').matches) {
      setOpen(false)
    }
  }

  return (
    <div
      ref={wrapperRef}
      className="relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button
        type="button"
        data-testid="nav-more-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((p) => !p)}
        className="relative flex items-center gap-1 transition-colors shrink-0 whitespace-nowrap"
        style={{
          padding: 'var(--header-nav-padding)',
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
              bottom: 'calc(-1 * var(--header-underline-offset))',
              height: '2px',
              background: 'var(--accent-default)',
              borderRadius: '1px',
            }}
          />
        )}
      </button>

      {open && (
        <div
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
          {MORE_CATS.map((cat) => {
            const isActive = currentType === cat.typeParam
            return (
              <Link
                key={cat.typeParam}
                href={`/${locale}/${cat.typeParam}`}
                role="menuitem"
                data-testid={`nav-more-${cat.typeParam}`}
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

export function Nav() {
  const { brand } = useBrand()
  const t = useTranslations('nav')
  const pathname = usePathname()
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState('')
  const [overlayOpen, setOverlayOpen] = useState(false)
  const [isMac, setIsMac] = useState(false)
  const searchInputRef = useRef<HTMLInputElement | null>(null)
  const searchFormRef = useRef<HTMLFormElement | null>(null)

  const currentLocale = pathname.split('/')[1] ?? 'en'
  const currentType = pathname.split('/')[2] ?? null
  const isHomePage = !currentType

  // OS 检测（SSR 安全：只在 client mount 后读取 navigator）（I-1/I-3）
  useEffect(() => {
    if (typeof navigator !== 'undefined') {
      setIsMac(/Mac|iPhone|iPad|iPod/.test(navigator.platform))
    }
  }, [])

  // ⌘K / Ctrl+K 键盘监听（I-1/I-3）
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOverlayOpen(true)
        searchInputRef.current?.focus()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
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

  // 热搜词（来自 messages 的 nav.hotSearchTerms，无 API 调用；?.() 兼容测试 mock）
  const hotSearchTerms: string[] = (t.raw?.('hotSearchTerms') as string[]) ?? []

  return (
    <header
      data-testid="global-nav"
      className="sticky top-0 z-50 border-b backdrop-blur-md"
      style={{
        height: 'var(--header-height)',
        background: 'color-mix(in oklch, var(--bg-canvas) 88%, transparent)',
        borderColor: 'var(--border-default)',
      }}
    >
      {/* 内容容器：w-full 保证右侧组件贴右边缘（I-2）*/}
      <div className="max-w-shell mx-auto px-8 h-full flex items-center gap-6 w-full">

        {/* 1. Logo */}
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
              background: 'linear-gradient(135deg, var(--accent-default), oklch(48% 0.22 280))',
              color: 'var(--color-gray-0)',
              fontSize: '13px',
              fontWeight: 900,
            }}
          >
            R
          </span>
          {brand.name}
        </Link>

        {/* 2. 主导航 + "更多" 下拉（单源 lib/categories.ts，I-6）*/}
        <nav
          className="flex items-center gap-1 shrink-0"
          aria-label="主导航"
        >
          <NavLinkItem
            href={`/${currentLocale}`}
            active={isHomePage}
            label={t('home')}
            testId="nav-home"
          />
          {MAIN_CATS.map((cat) => (
            <NavLinkItem
              key={cat.typeParam}
              href={`/${currentLocale}/${cat.typeParam}`}
              active={currentType === cat.typeParam}
              label={t(cat.labelKey)}
              testId={`nav-cat-${cat.typeParam}`}
            />
          ))}
          <MoreMenu
            locale={currentLocale}
            currentType={currentType}
            label={t('more')}
          />
        </nav>

        {/* 3. 搜索（flex-1 取余下空间，max-width 由 --search-input-max-w 约束）*/}
        <form
          ref={searchFormRef}
          role="search"
          onSubmit={(e) => {
            e.preventDefault()
            setOverlayOpen(false)
            submitSearch(searchQuery)
          }}
          className="hidden md:flex flex-1 relative"
          style={{ maxWidth: 'var(--search-input-max-w)' }}
        >
          {/* 搜索图标 */}
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
            onFocus={() => setOverlayOpen(true)}
            onBlur={() => {
              setTimeout(() => setOverlayOpen(false), 200)
            }}
            placeholder={t('searchPlaceholder')}
            aria-label={t('searchPlaceholder')}
            enterKeyHint="search"
            className="w-full outline-none focus:border-[var(--accent-default)] focus:bg-[var(--bg-surface)]"
            style={{
              height: '40px',
              padding: '0 56px 0 42px',
              fontSize: '14px',
              borderRadius: '10px',
              border: '1px solid var(--border-default)',
              background: 'var(--bg-surface-sunken)',
              color: 'var(--fg-default)',
            }}
          />

          {/* ⌘K / Ctrl+K 徽章（I-1/I-3，SSR 安全：isMac 默认 false，mount 后更新）*/}
          <kbd
            aria-hidden="true"
            style={{
              position: 'absolute',
              right: '10px',
              top: '50%',
              transform: 'translateY(-50%)',
              padding: '2px 5px',
              fontSize: '11px',
              fontWeight: 600,
              borderRadius: '4px',
              border: '1px solid var(--border-default)',
              background: 'var(--bg-surface-sunken)',
              color: 'var(--fg-subtle)',
              userSelect: 'none',
              pointerEvents: 'none',
              whiteSpace: 'nowrap',
              lineHeight: '16px',
            }}
          >
            {isMac ? '⌘K' : 'Ctrl+K'}
          </kbd>

          {/* SearchOverlay：浮层，无输入时展示热搜，有输入时展示结果 */}
          {overlayOpen && (
            <SearchOverlay
              query={searchQuery}
              hotSearchTerms={hotSearchTerms}
              onNavigate={(q) => {
                setSearchQuery(q)
                submitSearch(q)
              }}
              onClose={() => setOverlayOpen(false)}
              locale={currentLocale}
            />
          )}
        </form>

        {/* 4. 右侧操作区：gap-2(8px) 固定间距，shrink-0 不压缩，w-full 保证贴右（I-2）*/}
        <div className="flex items-center gap-2 shrink-0 ml-auto">
          <ThemeToggle />

          <button
            type="button"
            data-testid="nav-settings"
            aria-label={t('settings')}
            title={t('settings')}
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
