/**
 * /admin/system/monitor — 性能监控页面（Server Component）
 * CHG-32
 */

import { PerformanceMonitor } from '@/components/admin/system/PerformanceMonitor'

export default function AdminMonitorPage() {
  return (
    <div data-testid="admin-monitor-page">
      <h1 className="mb-6 text-2xl font-bold">性能监控</h1>
      <PerformanceMonitor />
    </div>
  )
}
