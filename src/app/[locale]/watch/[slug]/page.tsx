/**
 * watch/[slug]/page.tsx — 播放页（CSR）
 * SEO 由详情页负责；播放器组件 dynamic import + ssr: false
 * 视频数据在客户端获取，不做 SSR（确保 page.route() 可拦截）
 */

import { Suspense } from 'react'
import { Nav } from '@/components/layout/Nav'
import { Footer } from '@/components/layout/Footer'
import { PlayerLoader } from './PlayerLoader'

interface Props {
  params: Promise<{ locale: string; slug: string }>
}

export default async function WatchPage({ params }: Props) {
  const { slug } = await params

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: 'var(--background)' }}
      data-testid="watch-page"
    >
      <Nav />
      <main className="flex-1">
        <Suspense>
          <PlayerLoader slug={slug} />
        </Suspense>
      </main>
      <Footer />
    </div>
  )
}
