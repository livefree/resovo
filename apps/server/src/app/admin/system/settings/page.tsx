/**
 * /admin/system/settings — 站点配置页面
 * CHG-35
 */

import { ListPageShell } from '@/components/shared/layout/ListPageShell'
import { SiteSettings } from '@/components/admin/system/site-settings/SiteSettings'

export default function AdminSiteSettingsPage() {
  return (
    <ListPageShell variant="admin"
      title="站点配置"
      description="管理站点基础信息、展示文案与上传策略。"
      testId="admin-site-settings-page"
    >
      <SiteSettings />
    </ListPageShell>
  )
}
