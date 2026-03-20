/**
 * /admin/system/migration — 数据导入导出页面（Server Component）
 * CHG-31
 */

import { DataMigration } from '@/components/admin/system/migration/DataMigration'

export default function AdminMigrationPage() {
  return (
    <div data-testid="admin-migration-page">
      <h1 className="mb-6 text-2xl font-bold">数据导入导出</h1>
      <DataMigration />
    </div>
  )
}
