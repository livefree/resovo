/**
 * picker-fetcher.ts — VideoPicker 注入 fetcher（消费 listVideos 端点）
 *
 * 真源：M-SN-SHARED-04-A VideoPicker (commit 1c2b2329) + CHG-SN-8-FUP-SUB
 *
 * 隔离实现（ADR-103b）：admin-ui 的 VideoPicker 不 import apps/**；
 * 本模块在 apps/server-next 侧做字段映射 + listVideos 调用 + AbortSignal 兼容。
 */

import type { VideoPickerFetcher } from '@resovo/admin-ui'
import { listVideos } from './api'

/**
 * 标准 VideoPicker fetcher，所有审核台 / 字幕上传 / 首页模块等消费方共用
 *
 * 实施备注：
 *   - listVideos 当前是 page/limit 分页（不支持 cursor），PickerDialog 的 cursor
 *     参数被静默忽略（v1 picker dialog 也不消费 nextCursor 翻页，仅展示首页）
 *   - AbortSignal 暂未透传到 apiClient（M-SN-N follow-up：apiClient 加 signal 选项），
 *     当前用户快速键入时旧请求会跑完但被丢弃（不污染 state，PickerDialog 状态机判断
 *     dialogState.kind === 'loading' 仅认最新一次）
 */
export const videoPickerFetcher: VideoPickerFetcher = async ({ q, limit, filter }) => {
  const res = await listVideos({
    q: q || undefined,
    limit,
    type: filter?.type as never,
    status: filter?.status as never,
  })
  const items = res.data.map((row) => ({
    id: row.id,
    shortId: row.short_id,
    title: row.title,
    titleEn: row.title_en,
    type: row.type,
    year: row.year,
    coverUrl: row.cover_url,
    isPublished: row.is_published,
  }))
  return {
    items,
    total: res.total,
    // 不返回 nextCursor（listVideos 是 page-based；M-SN-N follow-up）
  }
}
