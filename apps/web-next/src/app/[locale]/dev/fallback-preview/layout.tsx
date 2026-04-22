import { notFound } from 'next/navigation'

export default function FallbackPreviewDevLayout({ children }: { children: React.ReactNode }) {
  if (process.env.NODE_ENV !== 'development') {
    notFound()
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-canvas)', color: 'var(--fg-default)' }}>
      {children}
    </div>
  )
}
