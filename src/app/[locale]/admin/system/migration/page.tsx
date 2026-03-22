/**
 * /admin/system/migration — 数据导入导出页面（Server Component）
 * CHG-31
 */

import { AdminPageShell } from '@/components/admin/shared/layout/AdminPageShell'
import { DataMigration } from '@/components/admin/system/migration/DataMigration'

export default function AdminMigrationPage() {
  return (
    <AdminPageShell
      title="数据导入导出"
      description="执行配置与站点数据迁移，查看导入导出结果。"
      testId="admin-migration-page"
    >
      <DataMigration />
    </AdminPageShell>
  )
}
