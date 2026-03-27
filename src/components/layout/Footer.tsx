import { useTranslations } from 'next-intl'
import Link from 'next/link'

export function Footer() {
  const t = useTranslations('home')
  
  return (
    <footer
      className="border-t py-8 mt-auto w-full"
      style={{ borderColor: 'var(--border)', background: 'var(--background)' }}
      data-testid="global-footer"
    >
      <div 
        className="max-w-screen-xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-4 text-xs" 
        style={{ color: 'var(--muted-foreground)' }}
      >
        <div className="flex flex-col items-center md:items-start gap-1 text-center md:text-left">
          <span className="font-bold text-sm tracking-tight" style={{ color: 'var(--gold)' }}>
            Resovo
          </span>
          <p className="max-w-xl">{t('disclaimer')}</p>
        </div>
        
        <div className="flex gap-4 font-medium">
          <Link href="/help" className="hover:text-[var(--foreground)] transition-colors">Help</Link>
          <Link href="/privacy" className="hover:text-[var(--foreground)] transition-colors">Privacy</Link>
          <Link href="/dmca" className="hover:text-[var(--foreground)] transition-colors">DMCA</Link>
          <Link href="/about" className="hover:text-[var(--foreground)] transition-colors">About</Link>
        </div>
      </div>
    </footer>
  )
}
