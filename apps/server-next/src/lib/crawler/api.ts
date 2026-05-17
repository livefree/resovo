/**
 * crawler/api.ts — /admin/crawler 视图 API 客户端（CHG-SN-6-13 MVP 扩展）
 *
 * 端点（v1 CHG-34 / allowlist 豁免）：
 *   GET    /admin/crawler/sites             — 列表
 *   POST   /admin/crawler/sites             — 新增
 *   PATCH  /admin/crawler/sites/:key        — 更新
 *   DELETE /admin/crawler/sites/:key        — 删除（fromConfig=true 不可删）
 *   POST   /admin/crawler/sites/batch       — 批量操作
 *   POST   /admin/crawler/sites/validate    — 验证 API 可达性
 *   GET    /admin/crawler/system-status     — 调度器 + 队列状态
 */

import { apiClient } from '@/lib/api-client'
import type { CrawlerSite as CrawlerSiteFull } from '@resovo/types'

export type { CrawlerSiteFull as CrawlerSite }

export type CrawlerSourceType = 'vod' | 'shortdrama'
export type CrawlerSiteFormat = 'json' | 'xml'

export interface CreateCrawlerSiteInput {
  readonly key: string
  readonly name: string
  readonly apiUrl: string
  readonly detail?: string
  readonly sourceType?: CrawlerSourceType
  readonly format?: CrawlerSiteFormat
  readonly weight?: number
  readonly isAdult?: boolean
}

export interface UpdateCrawlerSiteInput {
  readonly name?: string
  readonly apiUrl?: string
  readonly detail?: string
  readonly sourceType?: CrawlerSourceType
  readonly format?: CrawlerSiteFormat
  readonly weight?: number
  readonly isAdult?: boolean
  readonly disabled?: boolean
  readonly allowAutoPublish?: boolean
}

export type CrawlerSiteBatchAction =
  | 'enable' | 'disable' | 'delete'
  | 'mark_adult' | 'unmark_adult'
  | 'mark_shortdrama' | 'mark_vod'

export interface BatchResult { readonly affected: number }
export interface ValidateApiResult {
  readonly ok: boolean
  readonly statusCode?: number
  readonly message?: string
}
export interface CrawlerSystemStatus {
  readonly enabled?: boolean
  readonly schedulers?: ReadonlyArray<{ readonly name: string; readonly enabled: boolean; readonly intervalMs: number }>
  readonly [key: string]: unknown
}

export async function listCrawlerSites(): Promise<readonly CrawlerSiteFull[]> {
  const res = await apiClient.get<{ data: readonly CrawlerSiteFull[] }>('/admin/crawler/sites')
  return res.data
}

export async function createCrawlerSite(input: CreateCrawlerSiteInput): Promise<CrawlerSiteFull> {
  const res = await apiClient.post<{ data: CrawlerSiteFull }>('/admin/crawler/sites', input)
  return res.data
}

export async function updateCrawlerSite(key: string, input: UpdateCrawlerSiteInput): Promise<CrawlerSiteFull> {
  const res = await apiClient.patch<{ data: CrawlerSiteFull }>(
    `/admin/crawler/sites/${encodeURIComponent(key)}`, input,
  )
  return res.data
}

export async function deleteCrawlerSite(key: string): Promise<void> {
  await apiClient.delete(`/admin/crawler/sites/${encodeURIComponent(key)}`)
}

export async function batchCrawlerSites(
  keys: readonly string[],
  action: CrawlerSiteBatchAction,
): Promise<BatchResult> {
  const res = await apiClient.post<{ data: BatchResult }>('/admin/crawler/sites/batch', { keys, action })
  return res.data
}

export async function validateCrawlerSite(apiUrl: string): Promise<ValidateApiResult> {
  const res = await apiClient.post<{ data: ValidateApiResult }>('/admin/crawler/sites/validate', { apiUrl })
  return res.data
}

export async function getCrawlerSystemStatus(): Promise<CrawlerSystemStatus> {
  const res = await apiClient.get<{ data: CrawlerSystemStatus }>('/admin/crawler/system-status')
  return res.data
}
