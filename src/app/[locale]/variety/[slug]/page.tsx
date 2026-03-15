/**
 * variety/[slug]/page.tsx — 综艺详情页（SSR）
 */

import type { Metadata } from 'next'
import { Nav } from '@/components/layout/Nav'
import { VideoDetailHero } from '@/components/video/VideoDetailHero'
import { VideoDetailMeta } from '@/components/video/VideoDetailMeta'
import { EpisodeGrid } from '@/components/video/EpisodeGrid'
import { fetchVideoDetail } from '@/lib/video-detail'

interface Props {
  params: Promise<{ locale: string; slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const video = await fetchVideoDetail(slug)

  return {
    title: `${video.title}${video.year ? ` (${video.year})` : ''} — Resovo`,
    description: video.description ?? `在 Resovo 观看 ${video.title}`,
    openGraph: {
      title: video.title,
      description: video.description ?? undefined,
      images: video.coverUrl ? [{ url: video.coverUrl }] : [],
    },
  }
}

export default async function VarietyDetailPage({ params }: Props) {
  const { slug } = await params
  const video = await fetchVideoDetail(slug)

  return (
    <div className="min-h-screen" style={{ background: 'var(--background)' }}>
      <Nav />
      <VideoDetailHero video={video} />
      <VideoDetailMeta video={video} />
      <EpisodeGrid video={video} />
    </div>
  )
}
