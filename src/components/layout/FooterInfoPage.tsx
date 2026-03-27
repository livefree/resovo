import { Nav } from '@/components/layout/Nav'
import { Footer } from '@/components/layout/Footer'

interface FooterInfoSection {
  title: string
  paragraphs: string[]
}

interface FooterInfoPageProps {
  title: string
  subtitle: string
  updatedAt: string
  sections: FooterInfoSection[]
}

export function FooterInfoPage({ title, subtitle, updatedAt, sections }: FooterInfoPageProps) {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--background)' }}>
      <Nav />
      <main className="flex-1 max-w-screen-lg mx-auto w-full px-4 py-8 md:py-12">
        <div className="rounded-2xl border p-6 md:p-8 space-y-8" style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
          <header className="space-y-2 border-b pb-5" style={{ borderColor: 'var(--border)' }}>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight" style={{ color: 'var(--foreground)' }}>
              {title}
            </h1>
            <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
              {subtitle}
            </p>
            <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
              Last updated: {updatedAt}
            </p>
          </header>

          <div className="space-y-6">
            {sections.map((section) => (
              <section key={section.title} className="space-y-2">
                <h2 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>
                  {section.title}
                </h2>
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph} className="leading-7" style={{ color: 'var(--muted-foreground)' }}>
                    {paragraph}
                  </p>
                ))}
              </section>
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
