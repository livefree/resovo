import { Suspense } from 'react'
import type { Metadata } from 'next'
import { VideoDetailClient, VideoDetailClientSkeleton } from '@/components/video/VideoDetailClient'
import { fetchVideoMeta, fetchVideoDetail, fetchVideoSources, fetchLineMatrix } from '@/lib/video-detail'
import { DEFAULT_BRAND_NAME } from '@/lib/brand-detection'

interface PageProps {
  params: Promise<{ locale: string; slug: string }>
}

export async function detailGenerateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const video = await fetchVideoMeta(slug)
  if (!video) return { title: `${DEFAULT_BRAND_NAME}视频` }
  const description = video.description?.slice(0, 150) ?? undefined
  return {
    title: `${video.title} - ${DEFAULT_BRAND_NAME}`,
    description,
    openGraph: {
      title: `${video.title} - ${DEFAULT_BRAND_NAME}`,
      description,
      images: video.coverUrl ? [{ url: video.coverUrl }] : [],
    },
  }
}

export function createDetailPage(showEpisodes: boolean) {
  return async function DetailPage({ params }: PageProps) {
    const { slug } = await params
    // ADR-160 AMENDMENT 2 D-160-AMD2-1：server-side hydration / 派发链路从 metadata-only 扩到 page body
    // - fetchVideoDetail 触发 notFound() on 404（A-AMD2-2 / 替代 client 内联错误状态）
    // - fetchVideoSources 失败返回空数组（VideoDetailClient 渲染"暂无可用播放源"占位）
    // - preview 模式下两个 fetch 都走 admin preview 派发链路（middleware header → Bearer → cache:no-store）
    const initialVideo = await fetchVideoDetail(slug)
    // BUGFIX-WATCH-EP-URL ③：拉**全集源**（省略 episode），与播放页线路矩阵同源 → 线路名逐字一致
    // PLAYER-12-B 双供给（MEDIUM-2）：新增精简 initialMatrix（DetailHero 消费派生线路名）**不删** initialSources
    // （保留全集源作 DetailHero 回退兜底 + 独立回滚；-C 收口时删）。线路名 episode 无关 → 取 ep=1。
    const [initialSources, initialMatrix] = await Promise.all([
      fetchVideoSources(slug),
      fetchLineMatrix(slug, 1),
    ])
    return (
      <Suspense fallback={<VideoDetailClientSkeleton />}>
        <VideoDetailClient
          slug={slug}
          showEpisodes={showEpisodes}
          initialVideo={initialVideo}
          initialSources={initialSources}
          initialMatrix={initialMatrix ?? undefined}
        />
      </Suspense>
    )
  }
}
