'use client'

import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useBrand } from '@/hooks/useBrand'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/primitives/feedback/Skeleton'

/**
 * Footer — HANDOFF-12 对齐 docs/frontend_design_spec_20260423.md §9
 *
 * 结构（两层）：
 *   上半区：品牌列（logo + 免责声明 + 社交占位）+ 导航列
 *   下半区：版权文字 + 法务链接横排
 *
 * Token 消费：
 *   上半区 padding → var(--footer-top-padding)     48px 32px 32px
 *   下半区 padding → var(--footer-bottom-padding)   20px 32px
 *   列间 gap       → var(--footer-col-gap)          var(--space-10) = 40px
 *   社交按钮 gap   → var(--footer-social-gap)       var(--space-2)  = 8px
 *   法务链接 gap   → var(--footer-legal-gap)        var(--space-5)  = 20px
 *   容器 max-width → max-w-shell                    var(--layout-shell-max) 1440px
 *
 * 法务链接与社交图标仅在此阶段（HANDOFF-12）静态展示；
 * 语言切换、locale 绑定由 HANDOFF-16+ 补齐。
 */

// 上半区导航链接（法务 + 帮助）
const NAV_LINKS = [
  { label: 'Help',    href: '/help' },
  { label: 'Privacy', href: '/privacy' },
  { label: 'DMCA',    href: '/dmca' },
  { label: 'About',   href: '/about' },
] as const

// ── Footer.Skeleton ───────────────────────────────────────────────────────────

function FooterSkeleton({ className }: { className?: string }) {
  return (
    <footer
      className={cn('mt-auto w-full', className)}
      style={{ background: 'var(--bg-canvas)', borderTop: '1px solid var(--border-default)' }}
      data-testid="footer-skeleton"
      aria-hidden="true"
    >
      {/* 上半区骨架 */}
      <div
        className="max-w-shell mx-auto"
        style={{ padding: 'var(--footer-top-padding)' }}
      >
        <div className="flex" style={{ gap: 'var(--footer-col-gap)' }}>
          {/* 品牌列骨架 */}
          <div className="flex flex-col gap-3" style={{ flex: '1 1 280px', minWidth: 0 }}>
            <Skeleton shape="rect" width={100} height={24} />
            <Skeleton shape="text" width={280} height={12} delay={300} />
            <Skeleton shape="text" width={240} height={12} delay={300} />
            <div className="flex" style={{ gap: 'var(--footer-social-gap)' }}>
              {[32, 32, 32].map((s, i) => (
                <Skeleton key={i} shape="rect" width={s} height={s} delay={300} />
              ))}
            </div>
          </div>
          {/* 导航列骨架 */}
          <div className="flex flex-col gap-2" style={{ minWidth: '120px' }}>
            {[48, 52, 44, 52].map((w, i) => (
              <Skeleton key={i} shape="text" width={w} height={13} delay={300} />
            ))}
          </div>
        </div>
      </div>

      {/* 下半区骨架 */}
      <div
        className="max-w-shell mx-auto flex justify-between items-center"
        style={{
          padding: 'var(--footer-bottom-padding)',
          borderTop: '1px solid var(--border-default)',
        }}
      >
        <Skeleton shape="text" width={160} height={12} />
        <div className="flex" style={{ gap: 'var(--footer-legal-gap)' }}>
          {[40, 48, 44, 52].map((w, i) => (
            <Skeleton key={i} shape="text" width={w} height={12} delay={300} />
          ))}
        </div>
      </div>
    </footer>
  )
}

// ── Footer ────────────────────────────────────────────────────────────────────

export function Footer() {
  const { brand } = useBrand()
  const t = useTranslations('home')
  const year = new Date().getFullYear()

  return (
    <footer
      className="mt-auto w-full"
      style={{ background: 'var(--bg-canvas)', borderTop: '1px solid var(--border-default)' }}
      data-testid="global-footer"
    >
      {/* ── 上半区：品牌列 + 导航列 ────────────────────────────────────────── */}
      <div
        className="max-w-shell mx-auto"
        style={{ padding: 'var(--footer-top-padding)' }}
      >
        <div
          className="flex flex-wrap"
          style={{ gap: 'var(--footer-col-gap)' }}
        >
          {/* 品牌列 */}
          <div
            className="flex flex-col"
            style={{ flex: '1 1 280px', minWidth: 0, gap: '12px' }}
          >
            {/* Logo 行：图标 + 品牌名 */}
            <div className="flex items-center gap-2.5">
              <span
                aria-hidden="true"
                className="flex items-center justify-center shrink-0"
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
              <span
                style={{
                  fontSize: '16px',
                  fontWeight: 800,
                  letterSpacing: '-0.02em',
                  color: 'var(--fg-default)',
                }}
              >
                {brand.name}
              </span>
            </div>

            {/* 免责声明 */}
            <p
              data-testid="footer-disclaimer"
              style={{
                fontSize: '12px',
                lineHeight: 1.6,
                color: 'var(--fg-subtle)',
                maxWidth: '380px',
              }}
            >
              {t('disclaimer')}
            </p>

            {/* 社交图标组（占位，HANDOFF-16+ 接入真实链接） */}
            <div className="flex items-center" style={{ gap: 'var(--footer-social-gap)' }}>
              {/* GitHub */}
              <a
                href="https://github.com"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="GitHub"
                className="transition-colors"
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--fg-subtle)',
                  background: 'transparent',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = 'var(--fg-default)'
                  e.currentTarget.style.background = 'var(--bg-surface-sunken)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--fg-subtle)'
                  e.currentTarget.style.background = 'transparent'
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0 0 22 12.017C22 6.484 17.522 2 12 2z" />
                </svg>
              </a>
              {/* Twitter/X */}
              <a
                href="https://twitter.com"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Twitter"
                className="transition-colors"
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--fg-subtle)',
                  background: 'transparent',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = 'var(--fg-default)'
                  e.currentTarget.style.background = 'var(--bg-surface-sunken)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--fg-subtle)'
                  e.currentTarget.style.background = 'transparent'
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.737-8.835L1.254 2.25H8.08l4.259 5.63zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>
            </div>
          </div>

          {/* 导航列 */}
          <nav
            aria-label="页脚导航"
            className="flex flex-col"
            style={{ gap: '10px', minWidth: '120px' }}
          >
            <span
              style={{ fontSize: '12px', fontWeight: 700, color: 'var(--fg-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}
            >
              Links
            </span>
            {NAV_LINKS.map(({ label, href }) => (
              <Link
                key={href}
                href={href}
                className="transition-colors"
                style={{ fontSize: '14px', color: 'var(--fg-subtle)', textDecoration: 'none' }}
                onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--fg-default)' }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--fg-subtle)' }}
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>
      </div>

      {/* ── 下半区：版权 + 法务链接 ────────────────────────────────────────── */}
      <div
        style={{ borderTop: '1px solid var(--border-default)' }}
      >
        <div
          className="max-w-shell mx-auto flex items-center justify-between flex-wrap"
          style={{ padding: 'var(--footer-bottom-padding)', gap: '12px' }}
        >
          <p style={{ fontSize: '12px', color: 'var(--fg-subtle)' }}>
            © {year} {brand.name}. All rights reserved.
          </p>
          <nav
            aria-label="法务链接"
            className="flex items-center flex-wrap"
            style={{ gap: 'var(--footer-legal-gap)' }}
          >
            {NAV_LINKS.map(({ label, href }) => (
              <Link
                key={href}
                href={href}
                className="transition-colors"
                style={{ fontSize: '12px', color: 'var(--fg-subtle)', textDecoration: 'none' }}
                onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--fg-default)' }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--fg-subtle)' }}
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </footer>
  )
}

Footer.Skeleton = FooterSkeleton
