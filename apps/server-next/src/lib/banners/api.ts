/**
 * banners/api.ts — `/admin/home` Banner tab API 客户端封装
 * （CHG-HOME-BANNER-UNIFY-A / ADR-181 D-181-1）
 *
 * 消费端点：apps/api/src/routes/admin/banners.ts（M5-API-BANNER-01 既有 6 端点，零新端点）。
 * home_banners 为 Hero 首屏唯一真源（D-181-1.1）；本桥接层是 server-next 唯一推荐
 * 运营入口（D-181-1.3）的数据通道，v1 banners UI 随 v1 整体退场。
 */

import { apiClient } from '@/lib/api-client'
import type {
  Banner,
  BannerListFilter,
  BannerListResult,
  BannerReorderItem,
  CreateBannerInput,
  UpdateBannerInput,
} from './types'

export async function listBanners(filter: BannerListFilter = {}): Promise<BannerListResult> {
  const params = new URLSearchParams()
  if (filter.page != null)  params.set('page', String(filter.page))
  if (filter.limit != null) params.set('limit', String(filter.limit))
  if (filter.sortField)     params.set('sortField', filter.sortField)
  if (filter.sortDir)       params.set('sortDir', filter.sortDir)
  const qs = params.toString()
  return apiClient.get<BannerListResult>(`/admin/banners${qs ? `?${qs}` : ''}`)
}

export async function getBanner(id: string): Promise<Banner> {
  const result = await apiClient.get<{ data: Banner }>(`/admin/banners/${id}`)
  return result.data
}

export async function createBanner(body: CreateBannerInput): Promise<Banner> {
  const result = await apiClient.post<{ data: Banner }>('/admin/banners', body)
  return result.data
}

/** 更新走 PUT（v1 端点语义，非 PATCH——与 home-modules 桥接不同，勿混用） */
export async function updateBanner(id: string, body: UpdateBannerInput): Promise<Banner> {
  const result = await apiClient.put<{ data: Banner }>(`/admin/banners/${id}`, body)
  return result.data
}

export async function deleteBanner(id: string): Promise<void> {
  await apiClient.delete(`/admin/banners/${id}`)
}

/** body 键为 orders（非 home-modules 的 items），条目字段 sortOrder（非 ordering） */
export async function reorderBanners(orders: BannerReorderItem[]): Promise<void> {
  await apiClient.patch('/admin/banners/reorder', { orders })
}
