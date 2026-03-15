'use client'

/**
 * PlayerLoader.tsx — Client Component wrapper for dynamic PlayerShell import
 * ssr: false is only allowed in Client Components (Next.js 15+)
 */

import dynamic from 'next/dynamic'

const PlayerShell = dynamic(
  () => import('@/components/player/PlayerShell').then((m) => ({ default: m.PlayerShell })),
  {
    ssr: false,
    loading: () => (
      <div
        className="max-w-screen-xl mx-auto px-4 py-4"
        style={{ color: 'var(--muted-foreground)' }}
      >
        <div
          className="w-full rounded-lg animate-pulse"
          style={{ aspectRatio: '16/9', background: 'var(--secondary)' }}
        />
      </div>
    ),
  }
)

export function PlayerLoader({ slug }: { slug: string }) {
  return <PlayerShell slug={slug} />
}
