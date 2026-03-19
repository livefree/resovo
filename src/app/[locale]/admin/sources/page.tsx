/**
 * /admin/sources — 播放源管理页（Server Component）
 * CHG-28: 使用 SourceTable Client Component
 */

import { SourceTable } from '@/components/admin/sources/SourceTable'

export default function AdminSourcesPage() {
  return (
    <div data-testid="admin-sources-page">
      <h1 className="mb-6 text-2xl font-bold">播放源管理</h1>
      <SourceTable />
    </div>
  )
}
