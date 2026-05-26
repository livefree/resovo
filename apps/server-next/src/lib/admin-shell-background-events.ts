/**
 * admin-shell-background-events.ts —
 * ADR-155 D-155-2 / EP-2 瘦身后版本（2026-05-26）
 *
 * 变更摘要：
 *   - 删除 useAdminBackgroundEvents hook（BackgroundEventBell 已删除 / EP-2）
 *   - 保留 invalidateBackgroundEvents + globalMutateRegistry（CrawlerClient Y-152-4 仍消费）
 *   - 数据消费迁移到 admin-shell-notifications.ts useAdminNotifications/useAdminTasks
 *     并发 GET 两端点 + merge by category/source（Y-155-3 短期方案）
 *
 * 历史：ADR-152 CW1-E-EP step 7 / D-152-3/4 BackgroundEventBell 旁路方案；
 *   N1-152-A position:fixed 已撤销（ADR-152 AMENDMENT 2026-05-26）
 */
'use client'

/**
 * 全局 mutate 注册表：让 CrawlerClient 无需 prop drilling 即可触发 invalidate
 *
 * useAdminNotifications / useAdminTasks 在 mount 时注册各自的 reload；
 * CrawlerClient.handleRunAllIncremental 等写操作成功后调
 * invalidateBackgroundEvents() 触发两 hook 强制 refetch（跳过 60s polling 窗口）。
 */
export const globalMutateRegistry = new Set<() => Promise<void>>()

/**
 * ADR-152 Y-152-4：CrawlerClient 触发写操作后调此函数强制 refetch，跳过缓存。
 * 用法：`import { invalidateBackgroundEvents } from '@/lib/admin-shell-background-events'`
 *
 * EP-2 后语义不变（兼容 CrawlerClient 调用方零改动）；触发的是 notifications + tasks
 * hook 而非已删除的 BackgroundEventBell。
 */
export async function invalidateBackgroundEvents(): Promise<void> {
  await Promise.allSettled([...globalMutateRegistry].map((fn) => fn()))
}
