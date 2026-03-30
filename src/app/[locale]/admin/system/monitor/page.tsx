/**
 * /admin/system/monitor — 性能监控页面（Server Component）
 * CHG-32
 */

import { ListPageShell } from '@/components/shared/layout/ListPageShell'
import { PerformanceMonitor } from '@/components/admin/system/monitoring/PerformanceMonitor'

export default function AdminMonitorPage() {
  return (
    <ListPageShell variant="admin"
      title="性能监控"
      description="监控接口耗时、慢请求与系统性能指标。"
      testId="admin-monitor-page"
    >
      <PerformanceMonitor />
    </ListPageShell>
  )
}
