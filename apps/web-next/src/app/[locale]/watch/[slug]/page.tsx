import { Suspense } from 'react'
import { WatchPageClient } from './WatchPageClient'
import { PlayerShell } from '@/components/player/PlayerShell'
import { fetchVideoDetail, fetchVideoSources } from '@/lib/video-detail'

interface Props {
  params: Promise<{ locale: string; slug: string }>
}

/**
 * REG-M3-04: /watch 页面含 Nav + Footer（正常页面布局）。
 * WatchPageClient 负责同步 slug → playerStore + 替换视频的 ConfirmDialog。
 * PlayerShell 直接内嵌在页面主内容区，GlobalPlayerFullFrame 在 watch 路由上返回 null 避免双重渲染。
 *
 * ADR-160 AMENDMENT 2 D-160-AMD2-1：server-side hydration 让 admin preview 模式下
 * internal/hidden 视频也能渲染 PlayerShell（client-side fetch 完全绕过 middleware header
 * 是 ADR 起草遗漏 / E3 通过 server-side fetch + initialVideo/initialSources props 修补）。
 * preview 模式失败（refresh 过期 / 公开访问）→ fetchVideoDetail 触发 notFound() / Next 404 page。
 */
export default async function WatchPage({ params }: Props) {
  const { slug } = await params

  // server-side hydration (D-160-AMD2-1)
  // 首集（第 1 集）作为 initial sources / episode 切换走 client（Y-AMD2-2 internal 视频限制）
  const initialVideo = await fetchVideoDetail(slug)
  const initialSources = await fetchVideoSources(slug, 1)

  return (
    <div data-testid="watch-page" className="flex-1 flex flex-col">
      <WatchPageClient slug={slug} />
      <Suspense>
        <PlayerShell slug={slug} initialVideo={initialVideo} initialSources={initialSources} />
      </Suspense>
    </div>
  )
}
