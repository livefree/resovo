/**
 * home-modules/api.ts — `/admin/home` 视图 API 客户端封装（CHG-SN-5-07）
 *
 * 消费端点：apps/api/src/routes/admin/home-modules.ts（ADR-104）
 */

import { apiClient } from '@/lib/api-client'
import type {
  HomeModule,
  HomeModuleListFilter,
  HomeModuleListResult,
  CreateHomeModuleBody,
  UpdateHomeModuleBody,
  ReorderItem,
} from './types'

export async function listHomeModules(filter: HomeModuleListFilter = {}): Promise<HomeModuleListResult> {
  const params = new URLSearchParams()
  if (filter.slot)                    params.set('slot', filter.slot)
  if (filter.brandScope)              params.set('brandScope', filter.brandScope)
  if (filter.brandSlug)               params.set('brandSlug', filter.brandSlug)
  if (filter.enabled !== undefined)   params.set('enabled', String(filter.enabled))
  if (filter.page != null)            params.set('page', String(filter.page))
  if (filter.limit != null)           params.set('limit', String(filter.limit))
  const qs = params.toString()
  return apiClient.get<HomeModuleListResult>(`/admin/home-modules${qs ? `?${qs}` : ''}`)
}

export async function createHomeModule(body: CreateHomeModuleBody): Promise<HomeModule> {
  const result = await apiClient.post<{ data: HomeModule }>('/admin/home-modules', body)
  return result.data
}

export async function updateHomeModule(id: string, body: UpdateHomeModuleBody): Promise<HomeModule> {
  const result = await apiClient.patch<{ data: HomeModule }>(`/admin/home-modules/${id}`, body)
  return result.data
}

export async function deleteHomeModule(id: string): Promise<void> {
  await apiClient.delete(`/admin/home-modules/${id}`)
}

export async function reorderHomeModules(items: ReorderItem[]): Promise<void> {
  await apiClient.post('/admin/home-modules/reorder', { items })
}

export async function publishToggleHomeModule(id: string, enabled: boolean): Promise<HomeModule> {
  const result = await apiClient.post<{ data: HomeModule }>(`/admin/home-modules/${id}/publish-toggle`, { enabled })
  return result.data
}

/**
 * 上传运营横图（CHG-HOME-UX-03 / ADR-052 AMENDMENT D-052-11）。
 *
 * 消费 POST /admin/media/images（ownerType='home_module'）；后端写回 home_modules.image_url
 * 并返回存储结果。**需先有模块 id**（写回模式约束，D-104-10）：新建态仅允许外链。
 *
 * 进度回调偏离登记：server-next apiClient 仅有 postMultipart（无 XHR 进度，CHG-SN-6-08），
 * 消费方用 loading 态替代 v1 BannerForm 进度条；不为单消费点扩 api-client 共享层。
 */
export async function uploadHomeModuleImage(id: string, file: File): Promise<{ url: string }> {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('ownerType', 'home_module')
  formData.append('ownerId', id)
  const result = await apiClient.postMultipart<{ data: { url: string } }>('/admin/media/images', formData)
  return result.data
}
