/**
 * /admin/sources — 播放源管理页（Server Component）
 * CHG-28: 使用 SourceTable Client Component
 */

import { SourceTable } from '@/components/admin/sources/SourceTable'

export default function AdminSourcesPage() {
  return (
    <div className="space-y-4" data-testid="admin-sources-page">
      <div className="rounded-lg border border-[var(--border)] bg-[var(--bg2)] p-4">
        <h1 className="text-2xl font-bold">播放源管理</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">筛选、验证和清理播放源，保持源站稳定性。</p>
      </div>
      <SourceTable />
    </div>
  )
}
