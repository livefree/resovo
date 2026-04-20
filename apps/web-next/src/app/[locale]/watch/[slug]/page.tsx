import { Suspense } from 'react'
import { PlayerShell } from '@/components/player/PlayerShell'

interface Props {
  params: Promise<{ locale: string; slug: string }>
}

export default async function WatchPage({ params }: Props) {
  const { slug } = await params

  return (
    <div data-testid="watch-page" className="flex-1 flex flex-col">
      <Suspense>
        <PlayerShell slug={slug} />
      </Suspense>
    </div>
  )
}
