/**
 * derive-status.ts — 首页运营位模块生命周期状态推导（CHG-HOME-UX-03）
 *
 * 真源：P-home.md §6 状态颜色（绿生效中 / 黄待生效 / 灰禁用·过期 / 红引用失效）。
 * 纯前端读时推导（后端时效即查询时 NOW() 过滤，无 worker），与 admin-ui Pill variant 1:1。
 *
 * 判定优先级（高 → 低）：
 *   1. danger  — video 类型且引用已确认失效（videoMeta === null，即 by-id 取回 404）
 *   2. neutral — 已禁用（!enabled）或已过期（endAt ≤ now）
 *   3. warn    — 待生效（startAt > now）
 *   4. ok      — 已启用 + 时效内
 *
 * videoMeta === undefined 表示「尚未取回 / 非 video 类型」，不判 danger（落 2-4 正常态）。
 */

import type { HomeModule } from './types'
import type { VideoMeta } from './use-video-meta-map'

export type ModuleStatusVariant = 'ok' | 'warn' | 'neutral' | 'danger'

export interface ModuleStatus {
  readonly variant: ModuleStatusVariant
  readonly label: string
}

type StatusInput = Pick<HomeModule, 'enabled' | 'startAt' | 'endAt' | 'contentRefType'>

export function deriveModuleStatus(
  module: StatusInput,
  videoMeta: VideoMeta | null | undefined,
  now: Date = new Date(),
): ModuleStatus {
  // 1. 引用失效（仅 video 类型且已确认 404）
  if (module.contentRefType === 'video' && videoMeta === null) {
    return { variant: 'danger', label: '引用失效' }
  }

  // 2. 已禁用
  if (!module.enabled) {
    return { variant: 'neutral', label: '已隐藏' }
  }

  // 2b. 已过期（endAt ≤ now；与后端 end_at > NOW() 口径互补）
  if (module.endAt && new Date(module.endAt).getTime() <= now.getTime()) {
    return { variant: 'neutral', label: '已过期' }
  }

  // 3. 待生效（startAt > now；后端口径 start_at <= NOW() 可见）
  if (module.startAt && new Date(module.startAt).getTime() > now.getTime()) {
    return { variant: 'warn', label: '待生效' }
  }

  // 4. 已启用 + 时效内
  return { variant: 'ok', label: '生效中' }
}
