'use client'

import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import { useBrand } from '@/hooks/useBrand'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/primitives/feedback/Skeleton'
import { ALL_CATEGORIES, MAIN_TYPE_PARAMS } from '@/lib/categories'

/**
 * Footer — HANDOFF-26 重构为 3 列结构（浏览/帮助/关于）。
 *
 * 浏览列：MAIN_TYPE_PARAMS 来自 lib/categories.ts，与 Nav 同源，含 locale 前缀。
 * 帮助/关于列：链接暂为 `#`，等内容页落地后填充。
 * 底部：Copyright 保留；原品牌列/法务重复行已移除。
 */

const MAIN_CATS = ALL_CATEGORIES.filter((c) =>
  (MAIN_TYPE_PARAMS as readonly string[]).includes(c.typeParam)
)

// ── Footer.Skeleton ───────────────────────────────────────────────────────────

function FooterSkeleton({ className }: { className?: string }) {
  return (
    <footer
      className={cn('mt-auto w-full', className)}
      style={{ background: 'var(--bg-canvas)', borderTop: '1px solid var(--border-default)' }}
      data-testid="footer-skeleton"
      aria-hidden="true"
    >
      <div className="max-w-shell mx-auto" style={{ padding: 'var(--footer-top-padding)' }}>
        <div className="grid grid-cols-1 md:grid-cols-3" style={{ gap: 'var(--footer-col-gap)' }}>
          {[1, 2, 3].map((col) => (
            <div key={col} className="flex flex-col gap-3">
              <Skeleton shape="text" width={60} height={13} />
              {[80, 70, 75, 65, 72].map((w, i) => (
                <Skeleton key={i} shape="text" width={w} height={13} delay={300} />
              ))}
            </div>
          ))}
        </div>
      </div>
      <div style={{ borderTop: '1px solid var(--border-default)' }}>
        <div
          className="max-w-shell mx-auto"
          style={{ padding: 'var(--footer-bottom-padding)' }}
        >
          <Skeleton shape="text" width={160} height={12} />
        </div>
      </div>
    </footer>
  )
}

// ── ColumnLink ─────────────────────────────────────────────────────────────────

function ColumnLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="transition-colors"
      style={{ fontSize: '14px', color: 'var(--fg-subtle)', textDecoration: 'none' }}
      onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--fg-default)' }}
      onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--fg-subtle)' }}
    >
      {label}
    </Link>
  )
}

// ── Footer ────────────────────────────────────────────────────────────────────

export function Footer() {
  const locale = useLocale()
  const { brand } = useBrand()
  const t = useTranslations()
  const year = new Date().getFullYear()

  return (
    <footer
      className="mt-auto w-full"
      style={{ background: 'var(--bg-canvas)', borderTop: '1px solid var(--border-default)' }}
      data-testid="global-footer"
    >
      {/* ── 3 列主体：浏览 / 帮助 / 关于 ─────────────────────────────────────── */}
      <div className="max-w-shell mx-auto" style={{ padding: 'var(--footer-top-padding)' }}>
        <div className="grid grid-cols-1 md:grid-cols-3" style={{ gap: 'var(--footer-col-gap)' }}>

          {/* 浏览列：MAIN_TYPE_PARAMS 单源 lib/categories.ts */}
          <nav className="flex flex-col gap-2.5" aria-label="浏览分类">
            <span
              style={{
                fontSize: '12px',
                fontWeight: 700,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: 'var(--fg-muted)',
                marginBottom: '4px',
              }}
            >
              {t('footer.browse')}
            </span>
            {MAIN_CATS.map((cat) => (
              <ColumnLink
                key={cat.typeParam}
                href={`/${locale}/${cat.typeParam}`}
                label={t(`nav.${cat.labelKey}`)}
              />
            ))}
          </nav>

          {/* 帮助列 */}
          <nav className="flex flex-col gap-2.5" aria-label="帮助">
            <span
              style={{
                fontSize: '12px',
                fontWeight: 700,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: 'var(--fg-muted)',
                marginBottom: '4px',
              }}
            >
              {t('footer.help')}
            </span>
            <ColumnLink href="#" label={t('footer.helpCenter')} />
            <ColumnLink href="#" label={t('footer.dmca')} />
            <ColumnLink href="#" label={t('footer.privacyPolicy')} />
          </nav>

          {/* 关于列 */}
          <nav className="flex flex-col gap-2.5" aria-label="关于">
            <span
              style={{
                fontSize: '12px',
                fontWeight: 700,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: 'var(--fg-muted)',
                marginBottom: '4px',
              }}
            >
              {t('footer.about')}
            </span>
            <ColumnLink href="#" label={t('footer.aboutUs')} />
            <ColumnLink href="#" label={t('footer.contact')} />
          </nav>

        </div>
      </div>

      {/* ── 底部：Copyright ───────────────────────────────────────────────────── */}
      <div style={{ borderTop: '1px solid var(--border-default)' }}>
        <div
          className="max-w-shell mx-auto"
          style={{ padding: 'var(--footer-bottom-padding)' }}
        >
          <p style={{ fontSize: '12px', color: 'var(--fg-subtle)' }}>
            © {year} {brand.name}. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  )
}

Footer.Skeleton = FooterSkeleton
