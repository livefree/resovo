/**
 * /admin/system/settings — 站点配置页面
 * CHG-35
 */

import { SiteSettings } from '@/components/admin/system/site-settings/SiteSettings'

export default function AdminSiteSettingsPage() {
  return (
    <div data-testid="admin-site-settings-page">
      <h1 className="mb-6 text-2xl font-bold">站点配置</h1>
      <SiteSettings />
    </div>
  )
}
