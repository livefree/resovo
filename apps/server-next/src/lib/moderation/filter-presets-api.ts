/**
 * filter-presets-api.ts — ADR-144 / CHG-SN-8-FUP-PRESET-TEAM-EP-B
 * `/admin/filter-presets` 4 端点客户端封装（消费 EP-A 后端实施 commit 0bf0b36c）
 */
import { apiClient } from '@/lib/api-client'
import type { FilterPresetTab, FilterPresetQuery } from './use-filter-presets'

export type FilterPresetScope = 'private' | 'shared'

export interface ApiFilterPreset {
  readonly id: string
  readonly ownerUserId: string
  readonly ownerUsername: string | null
  readonly name: string
  readonly scope: FilterPresetScope
  readonly tab: FilterPresetTab
  readonly query: FilterPresetQuery
  readonly isDefault: boolean
  readonly createdAt: string
  readonly updatedAt: string
}

export interface ListFilterPresetsParams {
  readonly tab?: FilterPresetTab
  readonly scope?: FilterPresetScope
}

export async function listFilterPresets(params: ListFilterPresetsParams = {}): Promise<readonly ApiFilterPreset[]> {
  const qs = new URLSearchParams()
  if (params.tab) qs.set('tab', params.tab)
  if (params.scope) qs.set('scope', params.scope)
  const url = qs.toString() ? `/admin/filter-presets?${qs}` : '/admin/filter-presets'
  const res = await apiClient.get<{ data: readonly ApiFilterPreset[] }>(url)
  return res.data
}

export interface CreateFilterPresetInput {
  readonly name: string
  readonly scope?: FilterPresetScope
  readonly tab: FilterPresetTab
  readonly query: FilterPresetQuery
  readonly isDefault?: boolean
}

export async function createFilterPreset(input: CreateFilterPresetInput): Promise<ApiFilterPreset> {
  const res = await apiClient.post<{ data: ApiFilterPreset }>('/admin/filter-presets', input)
  return res.data
}

export interface UpdateFilterPresetInput {
  readonly name?: string
  readonly scope?: FilterPresetScope
  readonly tab?: FilterPresetTab
  readonly query?: FilterPresetQuery
  readonly isDefault?: boolean
}

export async function updateFilterPreset(id: string, patch: UpdateFilterPresetInput): Promise<ApiFilterPreset> {
  const res = await apiClient.patch<{ data: ApiFilterPreset }>(`/admin/filter-presets/${id}`, patch)
  return res.data
}

export async function deleteFilterPreset(id: string): Promise<void> {
  await apiClient.delete(`/admin/filter-presets/${id}`)
}
