/**
 * home-curation/api.ts — Home Curation 聚合门面 API 客户端封装
 * （CHG-HOME-CANVAS-A / ADR-182）
 *
 * 消费端点：apps/api/src/routes/admin/home.ts（ADR-182 #1/#2/#3）。
 * preview 跳缓存（后端语义），客户端不做本地缓存。
 */

import { apiClient } from '@/lib/api-client'
import type {
  HomePreview,
  HomePreviewQuery,
  HomeSectionKey,
  HomeSectionSettings,
  HomeSectionSummary,
} from './types'

export async function getHomePreview(query: HomePreviewQuery = {}): Promise<HomePreview> {
  const params = new URLSearchParams()
  if (query.brandSlug) params.set('brand_slug', query.brandSlug)
  if (query.locale)    params.set('locale', query.locale)
  if (query.at)        params.set('at', query.at)
  if (query.device)    params.set('device', query.device)
  const qs = params.toString()
  const result = await apiClient.get<{ data: HomePreview }>(`/admin/home/preview${qs ? `?${qs}` : ''}`)
  return result.data
}

export async function listHomeSections(): Promise<HomeSectionSummary[]> {
  const result = await apiClient.get<{ data: HomeSectionSummary[] }>('/admin/home/sections')
  return result.data
}

export async function updateHomeSectionSettings(
  section: HomeSectionKey,
  body: Partial<Pick<HomeSectionSettings, 'autofillMode' | 'refreshIntervalMinutes' | 'displayCount' | 'allowDuplicates' | 'pinnedLimit' | 'settings'>>,
): Promise<HomeSectionSettings> {
  const result = await apiClient.patch<{ data: HomeSectionSettings }>(
    `/admin/home/sections/${section}/settings`,
    body,
  )
  return result.data
}
