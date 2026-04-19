/**
 * tvshow/[slug]/page.tsx — 综艺（tvshow）详情页
 * 数据由 VideoDetailClient 在客户端获取（确保 E2E page.route() 可拦截）
 */

import type { Metadata } from 'next'
import { Nav } from '@/components/layout/Nav'
import { Footer } from '@/components/layout/Footer'
import { VideoDetailClient } from '@/components/video/VideoDetailClient'
import { fetchVideoMeta } from '@/lib/video-detail'

interface Props {
  params: Promise<{ locale: string; slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const video = await fetchVideoMeta(slug)
  if (!video) return { title: '流光视频' }
  const description = video.description?.slice(0, 150) ?? undefined
  return {
    title: `${video.title} - 流光`,
    description,
    openGraph: { title: `${video.title} - 流光`, description, images: video.coverUrl ? [{ url: video.coverUrl }] : [] },
  }
}

export default async function VarietyDetailPage({ params }: Props) {
  const { slug } = await params

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--background)' }}>
      <Nav />
      <main className="flex-1">
        <VideoDetailClient slug={slug} showEpisodes />
      </main>
      <Footer />
    </div>
  )
}
