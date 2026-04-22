'use client'

import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useBrand } from '@/hooks/useBrand'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/primitives/feedback/Skeleton'

// ── Footer.Skeleton ───────────────────────────────────────────────────────────

function FooterSkeleton({ className }: { className?: string }) {
  return (
    <footer
      className={cn('border-t py-8 mt-auto w-full', className)}
      style={{ borderColor: 'var(--border-default)', background: 'var(--bg-canvas)' }}
      data-testid="footer-skeleton"
      aria-hidden="true"
    >
      <div className="max-w-screen-xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex flex-col gap-2">
          <Skeleton shape="text" width={80} height={16} />
          <Skeleton shape="text" width={280} height={12} delay={300} />
        </div>
        <div className="flex gap-4">
          {[40, 48, 40, 44].map((w, i) => (
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

  return (
    <footer
      className="border-t py-8 mt-auto w-full"
      style={{ borderColor: 'var(--border-default)', background: 'var(--bg-canvas)' }}
      data-testid="global-footer"
    >
      <div
        className="max-w-screen-xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-4 text-xs"
        style={{ color: 'var(--fg-muted)' }}
      >
        <div className="flex flex-col items-center md:items-start gap-1 text-center md:text-left">
          <span
            className="font-bold text-sm tracking-tight"
            style={{ color: 'var(--accent-default)' }}
          >
            {brand.name}
          </span>
          <p className="max-w-xl" data-testid="footer-disclaimer">
            {t('disclaimer')}
          </p>
        </div>

        <div className="flex gap-4 font-medium">
          <Link href="/help"    className="hover:text-[var(--fg-default)] transition-colors">Help</Link>
          <Link href="/privacy" className="hover:text-[var(--fg-default)] transition-colors">Privacy</Link>
          <Link href="/dmca"    className="hover:text-[var(--fg-default)] transition-colors">DMCA</Link>
          <Link href="/about"   className="hover:text-[var(--fg-default)] transition-colors">About</Link>
        </div>
      </div>
    </footer>
  )
}

Footer.Skeleton = FooterSkeleton
