/**
 * card-size/api.ts — 前台卡片尺寸体系 admin API 客户端封装（ADR-215 + Amendment A1，仿 home-curation/api.ts）
 *
 * 消费端点：apps/api/src/routes/admin/card-sizes.ts（ADR-215 D-215-1/2）
 *   - GET  /admin/card-sizes           → 2 档全量 CardSizeSettings[]（枚举序）
 *   - PUT  /admin/card-sizes/:sizeClass → 全替换该档可编辑投影 + audit card_size.update
 *
 * body 统一（Amendment A1 D-214-A1-1/5：单位统一为卡宽，standard size-driven / scroll 横滚同构）：
 *   { cardWidthPx, gapPx }（desktopColumns 列数护栏本轮不暴露编辑；服务端 zod `.strict()` 拒未知字段）。
 */

import { apiClient } from '@/lib/api-client'
import type { CardSizeClass, CardSizeSettings } from '@resovo/types'

/** PUT body 统一可编辑投影（镜像服务端 CardSizeBodySchema） */
export interface CardSizeBody {
  cardWidthPx: number
  gapPx: number
}

/** GET /admin/card-sizes — 2 档全量（后台直读 DB 不走公开缓存，服务端枚举序） */
export async function listCardSizes(): Promise<CardSizeSettings[]> {
  const result = await apiClient.get<{ data: CardSizeSettings[] }>('/admin/card-sizes')
  return result.data
}

/** PUT /admin/card-sizes/:sizeClass — 全替换该档可编辑投影；422 越界/未知字段 由 ApiClientError 抛出 */
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
