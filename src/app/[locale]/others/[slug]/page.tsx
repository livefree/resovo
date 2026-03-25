/**
 * others/[slug]/page.tsx — 其他内容类型详情页
 * 适用于 short_drama / documentary / music / sports / news / children / game_show / other
 * ADR-017: 新增 12 种类型中除 movie/drama/anime/variety 外的类型统一入口
 * 数据由 VideoDetailClient 在客户端获取（确保 E2E page.route() 可拦截）
 */

import type { Metadata } from 'next'
import { Nav } from '@/components/layout/Nav'
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

export default async function OthersDetailPage({ params }: Props) {
  const { slug } = await params

  return (
    <div className="min-h-screen" style={{ background: 'var(--background)' }}>
      <Nav />
      <VideoDetailClient slug={slug} showEpisodes />
    </div>
  )
}
