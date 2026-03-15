/**
 * movie/[slug]/page.tsx — 电影详情页
 * 数据由 VideoDetailClient 在客户端获取（确保 E2E page.route() 可拦截）
 */

import { Nav } from '@/components/layout/Nav'
import { VideoDetailClient } from '@/components/video/VideoDetailClient'

interface Props {
  params: Promise<{ locale: string; slug: string }>
}

export default async function MovieDetailPage({ params }: Props) {
  const { slug } = await params

  return (
    <div className="min-h-screen" style={{ background: 'var(--background)' }}>
      <Nav />
      <VideoDetailClient slug={slug} />
    </div>
  )
}
