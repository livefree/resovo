/**
 * video-detail.ts — 视频详情页服务端工具函数
 * Server-side only，禁止在客户端组件中导入
 *
 * ADR-160 admin preview 派发：
 * - middleware 注入 `x-admin-preview: 1` header → 触发 preview 路径
 * - preview 路径凭 refresh_token cookie 换 access_token，附 Authorization: Bearer
 *   + `?preview=admin` query + `cache: 'no-store'`（D-160-4a Y1 防 ISR 缓存污染）
 * - 管理员未登录或 refresh 失败 → 自动降级 public 路径（revalidate: 60）
 */

import { cookies, headers } from 'next/headers'
import { notFound } from 'next/navigation'
import type { Video, VideoSource, ApiResponse, ApiListResponse } from '@resovo/types'
import {
  COOKIE_REFRESH_TOKEN,
  HEADER_ADMIN_PREVIEW,
  PREVIEW_QUERY_KEY,
  PREVIEW_QUERY_VALUE,
  getAdminAccessToken,
} from './admin-access-token'

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

/** ADR-160 D-160-3：判定当前请求是否处于 admin preview 模式（middleware 注入 header） */
async function shouldUsePreview(): Promise<boolean> {
  const h = await headers()
  return h.get(HEADER_ADMIN_PREVIEW) === '1'
}

/**
 * 构造 preview 路径 fetch options（D-160-4b：refresh token → access token 交换）
 * 返回 null 表示降级：refresh_token cookie 缺失或 /auth/refresh 失败
 */
async function buildPreviewFetchInit(): Promise<RequestInit | null> {
  const cookieStore = await cookies()
  const refreshToken = cookieStore.get(COOKIE_REFRESH_TOKEN)?.value
  const accessToken = await getAdminAccessToken(refreshToken)
  if (!accessToken) return null
  return {
    headers: { authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  }
}

/**
 * 构造视频详情 fetch URL + init：preview 派发 / public 维持 ISR cache。
 * preview 模式失败（无 token）自动降级 public 路径，保持页面可浏览性。
 */
async function buildVideoFetchRequest(
  slug: string
): Promise<{ url: string; init: RequestInit }> {
  const shortId = extractShortId(slug)
  const baseUrl = `${API_BASE}/videos/${shortId}`

  if (await shouldUsePreview()) {
    const previewInit = await buildPreviewFetchInit()
    if (previewInit) {
      return {
        url: `${baseUrl}?${PREVIEW_QUERY_KEY}=${PREVIEW_QUERY_VALUE}`,
        init: previewInit,
      }
    }
  }

  return { url: baseUrl, init: { next: { revalidate: 60 } } }
}

/**
 * 服务端获取视频 meta（用于 generateMetadata）
 * 资源不存在时返回 null，不触发 notFound()
 */
export async function fetchVideoMeta(slug: string): Promise<Video | null> {
  const { url, init } = await buildVideoFetchRequest(slug)
  const res = await fetch(url, init).catch(() => null)
  if (!res || !res.ok) return null
  const body = (await res.json()) as ApiResponse<Video>
  return body.data ?? null
}

/**
 * 服务端获取视频详情（直接 fetch，不通过 apiClient 避免 Zustand 依赖）
 * shortId 无效或资源不存在时触发 notFound()
 */
export async function fetchVideoDetail(slug: string): Promise<Video> {
  const { url, init } = await buildVideoFetchRequest(slug)
  const res = await fetch(url, init).catch(() => null)

  if (!res || res.status === 404 || !res.ok) {
    notFound()
  }

  const body = (await res.json()) as ApiResponse<Video>
  return body.data
}

/**
 * 服务端获取视频播放源（ADR-160 AMENDMENT 2 D-160-AMD2-2）
 * preview 派发：附 Authorization Bearer + `?preview=admin` + cache: no-store（Y-AMD2-3）
 * 公开路径：维持 `next: { revalidate: 60 }`（ISR 60s）
 * 失败（404 / 网络 / refresh 失败）→ 返回空数组（不抛错 / VideoDetailClient 渲染"暂无可用播放源"占位）
 */
export async function fetchVideoSources(slug: string, episode = 1): Promise<VideoSource[]> {
  const shortId = extractShortId(slug)
  const baseUrl = `${API_BASE}/videos/${shortId}/sources?episode=${episode}`

  let url = baseUrl
  let init: RequestInit = { next: { revalidate: 60 } }
  if (await shouldUsePreview()) {
    const previewInit = await buildPreviewFetchInit()
    if (previewInit) {
      url = `${baseUrl}&${PREVIEW_QUERY_KEY}=${PREVIEW_QUERY_VALUE}`
      init = previewInit
    }
  }

  const res = await fetch(url, init).catch(() => null)
  if (!res || !res.ok) return []
  const body = (await res.json()) as ApiListResponse<VideoSource>
  return body.data ?? []
}
