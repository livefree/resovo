/**
 * maintenanceWorker.taskrun.ts — maintenance 作业 task_runs 登记辅助（ADR-194 D-194-5/8 / NTLG-P2-a-B）
 *
 * 职责（纯函数 + 可测 run-wrapper，无 IO；与 crawlerWorker.notifications.ts 同范式，
 *   隔离让 maintenanceWorker.ts 不超 500 行预算、且 wrapper 可脱离 bull/es/services 重型依赖单测）：
 *   - maintenanceJobTitle：MaintenanceJobType → 人读标题（→ task_runs.title → AdminTaskItem.title）
 *   - buildMaintenanceDigest：MaintenanceJobResult 聚合字段 → TaskResultDigest（finish 落 task_runs.digest，path B D-194-8）
 *   - runMaintenanceJobWithReporter：start→执行→finish 的登记包裹（start 失败降级由 reporter 内吞，§11 D4）
 *
 * 本文件运行时仅依赖 @resovo/types（MaintenanceJob* 全 type-only import，与 maintenanceWorker.ts 的
 *   type-only 循环安全——type import 编译期擦除，无运行时环）。
 */

import type { TaskMetric, TaskResultDigest, TaskRunReporter } from '@resovo/types'
import type { MaintenanceJobType, MaintenanceJobResult } from './maintenanceWorker'

// ── 标题映射 ──────────────────────────────────────────────────────

const JOB_TITLE: Record<MaintenanceJobType, string> = {
  'auto-publish-staging': '暂存自动发布',
  'verify-published-sources': '已发布源校验',
  'verify-staging-sources': '暂存源校验',
  'reconcile-search-index': '搜索索引校准',
  'purge-external-fetch-log': '采集流水清理',
  'purge-expired-notifications': '过期通知清理',
}

/** MaintenanceJobType → 人读标题（未知类型回退原始键，保健壮性） */
export function maintenanceJobTitle(type: MaintenanceJobType): string {
  return JOB_TITLE[type] ?? type
}

// ── digest 投影 ───────────────────────────────────────────────────

interface MetricMeta {
  label: string
  tone?: TaskMetric['tone']
  /** true=恒展示（含 0，运营需知本次产出）；省略=仅 >0 展示（不展示 0 噪声，同 buildTaskResultDigest 口径） */
  alwaysShow?: boolean
}

/**
 * 已知聚合 metric 键 → 标签/着色（声明序即展示序；未知键不投影，保标签一致性 #4）。
 * 覆盖 5 类 maintenance 作业的 MaintenanceJobResult 产出字段：
 *   auto-publish-staging: published / skipped
 *   verify-published-sources: unpublished / refetchEnqueued / skipped / failed
 *   verify-staging-sources: updated
 *   reconcile-search-index: synced / fixed / deleted / errors
 *   purge-external-fetch-log: deleted
 */
const METRIC_META: Record<string, MetricMeta> = {
  published: { label: '已发布', tone: 'ok', alwaysShow: true },
  updated: { label: '已更新', tone: 'ok', alwaysShow: true },
  synced: { label: '已同步', tone: 'ok', alwaysShow: true },
  deleted: { label: '已删除', tone: 'ok', alwaysShow: true },
  fixed: { label: '已修复', tone: 'ok' },
  refetchEnqueued: { label: '重排重抓', tone: 'ok' },
  unpublished: { label: '已下架', tone: 'warn' },
  skipped: { label: '跳过', tone: 'warn' },
  failed: { label: '失败', tone: 'danger' },
  errors: { label: '错误', tone: 'danger' },
}

/**
 * 从 MaintenanceJobResult 投影结构化 TaskResultDigest（ADR-194 D-194-8 path B，bull 作业 digest）。
 * 仅投影 METRIC_META 已知键（number 守卫，非数字/非有限值跳过）；正向产出恒展示、告警/错误 >0 才展示。
 * 无任何 metric（如纯 {type,durationMs}）→ 返回 undefined（不挂 digest，同 buildTaskResultDigest）。
 */
export function buildMaintenanceDigest(result: MaintenanceJobResult): TaskResultDigest | undefined {
  const metrics: TaskMetric[] = []
  const parts: string[] = []
  for (const [key, meta] of Object.entries(METRIC_META)) {
    const raw = result[key]
    if (typeof raw !== 'number' || !Number.isFinite(raw)) continue
    if (!meta.alwaysShow && raw <= 0) continue
    metrics.push({ key, label: meta.label, value: raw, ...(meta.tone ? { tone: meta.tone } : {}) })
    parts.push(`${meta.label} ${raw}`)
  }
  if (metrics.length === 0) return undefined
  return { summary: parts.join(' · '), metrics }
}

// ── run 登记包裹 ──────────────────────────────────────────────────

/**
 * 以 task_runs 登记包裹一次 maintenance 作业执行（ADR-194 D-194-5）。
 *   start → 执行 process → 成功 finish(success + digest) / 失败 finish(failed + error) 后 **rethrow**
 *   （保持 bull 失败语义：attemptsMade 累加 + on('failed') 触发）。
 * start 登记失败降级 sentinel + 后续 finish no-op 由 DbTaskRunReporter 内部吞错（§11 D4），本包裹不感知。
 */
export async function runMaintenanceJobWithReporter(
  reporter: TaskRunReporter,
  type: MaintenanceJobType,
  jobId: string,
  process: () => Promise<MaintenanceJobResult>,
): Promise<MaintenanceJobResult> {
  const runId = await reporter.start({ kind: 'maintenance', title: maintenanceJobTitle(type), ref: jobId })
  try {
    const result = await process()
    await reporter.finish(runId, { status: 'success', digest: buildMaintenanceDigest(result) })
    return result
  } catch (err) {
    await reporter.finish(runId, {
      status: 'failed',
      error: err instanceof Error ? err.message : String(err),
    })
    throw err
  }
}
