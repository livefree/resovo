/**
 * TEMPLATE: Next.js 页面（SSR + SEO）
 * 使用方法：复制此文件到 src/app/[locale]/[page-name]/page.tsx
 * 替换 [PageName]、[page-name]，填充 TODO 部分
 */

import { Suspense } from 'react'
import { getTranslations } from 'next-intl/server'
import type { Metadata } from 'next'
// TODO: 替换为实际组件
// import { [PageName]Content } from '@/components/[page-name]/[PageName]Content'

// ── SEO：generateMetadata（SSR，对搜索引擎友好）──────────────────

export async function generateMetadata({
  params: { locale },
}: {
  params: { locale: string }
}): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: '[page-name]' })

  return {
    title: t('meta.title'),           // TODO: 在翻译文件里添加
    description: t('meta.description'),
    // TODO: 动态页面（如视频详情页）在此从 API 获取标题
    // openGraph: { title: ..., images: [...] },
  }
}

// ── 页面组件 ─────────────────────────────────────────────────────

interface PageProps {
  params: {
    locale: string
    // TODO: 添加动态路由参数
    // id?: string
  }
  searchParams?: {
    // TODO: 添加 URL 查询参数
    // q?: string
    // page?: string
  }
}

export default async function [PageName]Page({ params, searchParams }: PageProps) {
  // SSR 数据获取（可选，也可以在客户端 fetch）
  // TODO: 按需取消注释，替换为实际 API 调用
  // const data = await fetch(`${process.env.API_URL}/v1/[resource]`, {
  //   next: { revalidate: 60 }  // ISR：60 秒重新验证
  // }).then(r => r.json())

  return (
    <main className="min-h-screen bg-[var(--bg)]">
      {/* TODO: 替换为实际页面内容 */}
      <Suspense fallback={<div className="text-[var(--muted)]">Loading...</div>}>
        {/* <[PageName]Content initialData={data} /> */}
      </Suspense>
    </main>
  )
}

/**
 * TEMPLATE: 视频详情页（SSR + SEO）
 * 使用方法：复制到 src/app/[locale]/movie/[slug]/page.tsx 等四个路径
 * 替换 [VideoType] 为 movie / anime / series / variety
 */

// import { notFound } from 'next/navigation'
// import { getTranslations } from 'next-intl/server'
// import type { Metadata } from 'next'
// import { apiClient } from '@/lib/api-client'
// import type { Video } from '@/types'

// ── slug 解析工具（四个详情页复用）──────────────────────────────
// export function parseShortId(slug: string): string {
//   // slug 格式：{任意文字}-{8位shortId}
//   // 取最后一个 - 后的部分作为 shortId
//   const parts = slug.split('-')
//   return parts[parts.length - 1]
// }

// ── SEO ──────────────────────────────────────────────────────────
// export async function generateMetadata({ params }: { params: { slug: string; locale: string } }): Promise<Metadata> {
//   const shortId = parseShortId(params.slug)
//   const { data: video } = await apiClient.get<{ data: Video }>(`/videos/${shortId}`)
//   if (!video) return { title: 'Not Found' }
//   return {
//     title: `${video.title} - Resovo`,
//     description: video.description ?? undefined,
//     openGraph: {
//       title: video.title,
//       description: video.description ?? undefined,
//       images: video.coverUrl ? [{ url: video.coverUrl }] : [],
//     },
//   }
// }

// ── 页面组件 ─────────────────────────────────────────────────────
// export default async function [VideoType]DetailPage({ params }: { params: { slug: string; locale: string } }) {
//   const shortId = parseShortId(params.slug)
//   const { data: video } = await apiClient.get<{ data: Video }>(`/videos/${shortId}`)
//   if (!video) notFound()
//   return (
//     <main>
//       {/* TODO: <VideoDetailHero video={video} /> */}
//       {/* TODO: <VideoDetailMeta video={video} /> */}
//       {/* TODO: <EpisodeGrid video={video} /> */}
//     </main>
//   )
// }
