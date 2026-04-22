'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/primitives/feedback/Skeleton'

// ── Icons ────────────────────────────────────────────────────────────────────

function IconHome({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9.5z" />
      <path d="M9 21V12h6v9" />
    </svg>
  )
}

function IconGrid({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  )
}

function IconSearch({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.35-4.35" />
    </svg>
  )
}

// ── Tab definition ────────────────────────────────────────────────────────────

interface TabDef {
  key: string
  labelKey: string
  href: string
  testId: string
  Icon: React.FC<{ active: boolean }>
  match: (pathname: string) => boolean
}

const TABS: TabDef[] = [
  {
    key: 'home',
    labelKey: 'nav.home',
    href: '/',
    testId: 'tabbar-home',
    Icon: IconHome,
    match: (p) => /^\/[a-z]{2}(-[A-Z]{2})?(\/)?$/.test(p) || p === '/',
  },
  {
    key: 'browse',
    labelKey: 'nav.catAll',
    href: '/browse',
    testId: 'tabbar-browse',
    Icon: IconGrid,
    match: (p) => p.includes('/browse'),
  },
  {
    key: 'search',
    labelKey: 'nav.search',
    href: '/search',
    testId: 'tabbar-search',
    Icon: IconSearch,
    match: (p) => p.includes('/search'),
  },
]

// ── MobileTabBar.Skeleton ────────────────────────────────────────────────────

function MobileTabBarSkeleton({ className }: { className?: string }) {
  return (
    <nav
      className={cn(className)}
      data-testid="mobile-tabbar-skeleton"
      aria-hidden="true"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: 'calc(var(--tabbar-height) + env(safe-area-inset-bottom, 0px))',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        zIndex: 'var(--z-tabbar)',
        background: 'color-mix(in srgb, var(--bg-canvas) 85%, transparent)',
        borderTop: '1px solid var(--border-default)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-around',
        paddingInline: '1rem',
      }}
    >
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} shape="rect" width={40} height={36} delay={300} />
      ))}
    </nav>
  )
}

// ── MobileTabBar ──────────────────────────────────────────────────────────────

export function MobileTabBar() {
  const pathname = usePathname()
  const t = useTranslations()

  return (
    <nav
      data-tabbar
      data-testid="mobile-tabbar"
      aria-label={t('nav.mobileNav') as string}
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: 'calc(var(--tabbar-height) + env(safe-area-inset-bottom, 0px))',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        zIndex: 'var(--z-tabbar)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        background: 'color-mix(in srgb, var(--bg-canvas) 85%, transparent)',
        borderTop: '1px solid var(--border-default)',
      }}
    >
      <div style={{ display: 'flex', height: 'var(--tabbar-height)', alignItems: 'stretch' }}>
        {TABS.map(({ key, labelKey, href, testId, Icon, match }) => {
          const active = match(pathname)
          return (
            <Link
              key={key}
              href={href}
              data-testid={testId}
              aria-current={active ? 'page' : undefined}
              className="relative flex flex-col items-center justify-center flex-1 gap-1 text-[0.625rem] leading-none"
              style={{ color: active ? 'var(--accent-default)' : 'var(--fg-subtle)' }}
            >
              <Icon active={active} />
              <span>{t(labelKey)}</span>
              {/* 180ms underline indicator */}
              <span
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: '25%',
                  right: '25%',
                  height: 2,
                  borderRadius: 1,
                  background: 'var(--accent-default)',
                  opacity: active ? 1 : 0,
                  transition: 'opacity 180ms ease',
                }}
              />
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

MobileTabBar.Skeleton = MobileTabBarSkeleton
