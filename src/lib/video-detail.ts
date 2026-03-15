/**
 * video-detail.ts — 视频详情页服务端工具函数
 * Server-side only，禁止在客户端组件中导入
 */

import { notFound } from 'next/navigation'
import type { Video, ApiResponse } from '@/types'

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/v1'

/**
 * 从 slug 提取 shortId（最后一个 `-` 后的 8 位字符）
 * 例："attack-on-titan-aB3kR9x1" → "aB3kR9x1"
 */
export function extractShortId(slug: string): string {
  const lastDash = slug.lastIndexOf('-')
  if (lastDash === -1) return slug
  return slug.slice(lastDash + 1)
}

/**
 * 服务端获取视频详情（直接 fetch，不通过 apiClient 避免 Zustand 依赖）
 * shortId 无效或资源不存在时触发 notFound()
 */
export async function fetchVideoDetail(slug: string): Promise<Video> {
  const shortId = extractShortId(slug)

  const res = await fetch(`${API_BASE}/videos/${shortId}`, {
    // Next.js 会缓存 fetch 结果，60s 后 revalidate
    next: { revalidate: 60 },
  }).catch(() => null)

  if (!res || res.status === 404 || !res.ok) {
    notFound()
  }

  const body = (await res.json()) as ApiResponse<Video>
  return body.data
}
