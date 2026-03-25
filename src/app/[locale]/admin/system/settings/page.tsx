/**
 * /admin/system/settings — 站点配置页面
 * CHG-35
 */

import { AdminPageShell } from '@/components/admin/shared/layout/AdminPageShell'
import { SiteSettings } from '@/components/admin/system/site-settings/SiteSettings'

export default function AdminSiteSettingsPage() {
  return (
    <AdminPageShell
      title="站点配置"
      description="管理站点基础信息、展示文案与上传策略。"
      testId="admin-site-settings-page"
    >
      <SiteSettings />
    </AdminPageShell>
  )
}
