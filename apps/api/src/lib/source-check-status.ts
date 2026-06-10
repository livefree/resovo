/**
 * source-check-status.ts — videos.source_check_status 的 probe 维度聚合纯函数
 *
 * SRCHEALTH-P1-2（B2）：手动探测（SourceProbeService）完成后即时重算视频聚合状态，
 * 不再等 worker level1 cron（6h）。
 *
 * **跨包同步约束（ADR-107 §4：worker 禁止 import apps/api，反向同样不可）**：
 *   `apps/worker/src/jobs/source-health/aggregate-source-check-status.ts` 的
 *   `computeCheckStatus` 是本函数的并行真源——逻辑必须保持语义一致，维护时双侧同步改
 *   （范式先例：auto-retire-line SQL 双侧 byte-identical）。
 *   双侧一致性由 `tests/unit/api/source-check-status.test.ts` 对拍守卫。
 *
 * 已知语义并存（SRCHEALTH-P1-2 调查发现，登记于 SEQ-20260610-02）：
 *   `videos.status.ts syncSourceCheckStatusFromSources / bulkSyncSourceCheckStatus`
 *   按 is_active 聚合写同一字段（补源/验源路径），与本 probe 维度语义交替覆盖，
 *   收敛留 P1 收口复盘独立裁决，本文件不扩大冲突面。
 */

import type { SourceCheckStatus } from '@/types'

/** video_sources.probe_status 取值（与 worker types ProbeStatus 对齐） */
export type ProbeStatus = 'pending' | 'ok' | 'partial' | 'dead'

/**
 * 按视频全部 active source 的 probe_status 聚合出 source_check_status。
 * 输入约定：仅 is_active = true AND deleted_at IS NULL 的行（与 worker 聚合输入一致）。
 */
export function computeCheckStatus(statuses: readonly ProbeStatus[]): SourceCheckStatus {
  if (statuses.length === 0) return 'pending'
  const all = (s: ProbeStatus) => statuses.every((x) => x === s)
  const any = (s: ProbeStatus) => statuses.some((x) => x === s)
  if (all('pending')) return 'pending'
  if (all('dead')) return 'all_dead'
  if (any('ok')) return statuses.every((x) => x === 'ok') ? 'ok' : 'partial'
  return 'partial'
}
