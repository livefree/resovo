/**
 * card-size/api.ts — 前台卡片尺寸体系 admin API 客户端封装（ADR-215 + Amendment A2，仿 home-curation/api.ts）
 *
 * 消费端点：apps/api/src/routes/admin/card-sizes.ts（ADR-215 D-215-1/2）
 *   - GET  /admin/card-sizes           → A2 单行全局 CardSizeSettings[]
 *   - PUT  /admin/card-sizes/:sizeClass → 全替换全局可编辑投影 + audit card_size.update（:sizeClass='global'）
 *
 * body（Amendment A2 D-214-A2-6：单一全局卡宽，全站网格 + 横滚共用）：
 *   { cardWidthPx, gapPx }（服务端 zod `.strict()` 拒未知字段）。
 */

import { apiClient } from '@/lib/api-client'
import type { CardSizeClass, CardSizeSettings } from '@resovo/types'

/** PUT body 统一可编辑投影（镜像服务端 CardSizeBodySchema） */
export interface CardSizeBody {
  cardWidthPx: number
  gapPx: number
}

/** GET /admin/card-sizes — A2 单行全局（后台直读 DB 不走公开缓存） */
export async function listCardSizes(): Promise<CardSizeSettings[]> {
  const result = await apiClient.get<{ data: CardSizeSettings[] }>('/admin/card-sizes')
  return result.data
}

/** PUT /admin/card-sizes/:sizeClass — 全替换全局可编辑投影（:sizeClass='global'）；422 越界/未知字段 由 ApiClientError 抛出 */
export async function updateCardSize(
  sizeClass: CardSizeClass,
  body: CardSizeBody,
): Promise<CardSizeSettings> {
  const result = await apiClient.put<{ data: CardSizeSettings }>(
    `/admin/card-sizes/${sizeClass}`,
    body,
  )
  return result.data
}
