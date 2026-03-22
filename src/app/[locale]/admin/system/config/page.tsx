/**
 * /admin/system/config — 配置文件页面
 * CHG-35
 */

import { AdminPageShell } from '@/components/admin/shared/layout/AdminPageShell'
import { ConfigFileEditor } from '@/components/admin/system/config-file/ConfigFileEditor'

export default function AdminConfigFilePage() {
  return (
    <AdminPageShell
      title="配置文件"
      description="定义爬虫源站列表 JSON 配置。保存后会同步到采集配置；from_config=true 的源站不可手动删除。"
      testId="admin-config-file-page"
    >
      <ConfigFileEditor />
    </AdminPageShell>
  )
}
