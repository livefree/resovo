import { Suspense } from 'react'
import { Nav } from '@/components/layout/Nav'
import { Footer } from '@/components/layout/Footer'
import { PlayerShell } from '@/components/player/PlayerShell'

interface Props {
  params: Promise<{ locale: string; slug: string }>
}

export default async function WatchPage({ params }: Props) {
  const { slug } = await params

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: 'var(--bg-canvas)' }}
      data-testid="watch-page"
    >
      <Nav />
      <main className="flex-1">
        <Suspense>
          <PlayerShell slug={slug} />
        </Suspense>
      </main>
      <Footer />
    </div>
  )
}
