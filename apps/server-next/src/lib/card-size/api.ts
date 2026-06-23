/**
 * card-size/api.ts — 前台卡片尺寸体系 admin API 客户端封装（ADR-215，仿 home-curation/api.ts）
 *
 * 消费端点：apps/api/src/routes/admin/card-sizes.ts（ADR-215 D-215-1/2）
 *   - GET  /admin/card-sizes           → 3 档全量 CardSizeSettings[]（枚举序）
 *   - PUT  /admin/card-sizes/:sizeClass → 全替换该档可编辑投影 + audit card_size.update
 *
 * body 据档位区分（D-215-2 可编辑投影；服务端 zod `.strict()` 拒倒置 body）：
 *   - 网格档（standard/compact）：{ desktopColumns, gapPx }
 *   - scroll 档：{ cardWidthPx, gapPx }
 */

import { apiClient } from '@/lib/api-client'
import type { CardSizeClass, CardSizeSettings } from '@resovo/types'

/** 网格档（standard/compact）PUT body 可编辑投影（镜像服务端 GridCardSizeBodySchema） */
export interface GridCardSizeBody {
  desktopColumns: number
  gapPx: number
}

/** scroll 档 PUT body 可编辑投影（镜像服务端 ScrollCardSizeBodySchema） */
export interface ScrollCardSizeBody {
  cardWidthPx: number
  gapPx: number
}

export type CardSizeBody = GridCardSizeBody | ScrollCardSizeBody

/** GET /admin/card-sizes — 3 档全量（后台直读 DB 不走公开缓存，服务端枚举序） */
export async function listCardSizes(): Promise<CardSizeSettings[]> {
  const result = await apiClient.get<{ data: CardSizeSettings[] }>('/admin/card-sizes')
  return result.data
}

/** PUT /admin/card-sizes/:sizeClass — 全替换该档可编辑投影；422 倒置 body/越界 由 ApiClientError 抛出 */
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
