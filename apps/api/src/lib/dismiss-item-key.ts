/**
 * dismiss-item-key.ts — 抽屉项 dismiss 白名单守卫（ADR-197 D-197-2）
 *
 * item_key = 前端抽屉项最终 id 原值（跨源，D-197-2）。通知抽屉可 dismiss 范围：
 *   - general 通知行 id：纯数字串 /^\d+$/
 *   - finished 高危审计：'bg-audit:<audit_log.id>'
 * 拒绝（瞬时 / 进行中，dismiss 无意义或破窗）：
 *   - upcoming：'bg-auto_crawl:...' / 'bg-scheduler_timer:...'（预测未来事件，会自然过去；key 含 name 非时间，dismiss 即永久误伤）
 *   - active：'bg-crawler_run:...'（进行中采集，下轮 poll 重派生「删了又回来」破窗）
 *
 * 注：任务抽屉 'taskrun-<id>' 终态项的 dismiss 校验需查 task_runs 状态（running 不可 / 终态可），归 -B2。
 *     本守卫为通知抽屉同步前缀判定（零跨表），是 NotificationService.dismiss 写路径守卫。
 */
export function isDismissableNotificationKey(itemKey: string): boolean {
  return /^\d+$/.test(itemKey) || itemKey.startsWith('bg-audit:')
}

/**
 * taskrun- 前缀项 → task_run 裸数字 id（非 `taskrun-<digits>` 形态返 null）。
 * 任务抽屉终态 task 项 item_key = `taskrun-<id>`；终态校验（query task_runs status）由
 * NotificationService 异步守卫（ADR-197 D-197-2：终态 success/failed/cancelled 可 / running 拒）。
 */
export function parseTaskRunItemKey(itemKey: string): string | null {
  const m = /^taskrun-(\d+)$/.exec(itemKey)
  return m ? m[1]! : null
}
