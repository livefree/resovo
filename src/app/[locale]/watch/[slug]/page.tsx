/**
 * watch/[slug]/page.tsx — 播放页（CSR）
 * SEO 由详情页负责；播放器组件 dynamic import + ssr: false
 * 视频数据在客户端获取，不做 SSR（确保 page.route() 可拦截）
 */

import dynamic from 'next/dynamic'
import { Suspense } from 'react'
import { Nav } from '@/components/layout/Nav'

// PlayerShell 动态导入，关闭 SSR（Video.js 依赖 DOM；视频数据客户端获取）
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

interface Props {
  params: Promise<{ locale: string; slug: string }>
}

export default async function WatchPage({ params }: Props) {
  const { slug } = await params

  return (
    <div
      className="min-h-screen"
      style={{ background: 'var(--background)' }}
      data-testid="watch-page"
    >
      <Nav />
      <Suspense>
        <PlayerShell slug={slug} />
      </Suspense>
    </div>
  )
}
