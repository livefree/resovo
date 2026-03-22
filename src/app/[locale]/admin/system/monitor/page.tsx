/**
 * /admin/system/monitor — 性能监控页面（Server Component）
 * CHG-32
 */

import { AdminPageShell } from '@/components/admin/shared/layout/AdminPageShell'
import { PerformanceMonitor } from '@/components/admin/system/monitoring/PerformanceMonitor'

export default function AdminMonitorPage() {
  return (
    <AdminPageShell
      title="性能监控"
      description="监控接口耗时、慢请求与系统性能指标。"
      testId="admin-monitor-page"
    >
      <PerformanceMonitor />
    </AdminPageShell>
  )
}
