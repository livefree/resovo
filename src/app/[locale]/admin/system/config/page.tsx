/**
 * /admin/system/config — 配置文件页面
 * CHG-35
 */

import { ConfigFileEditor } from '@/components/admin/system/ConfigFileEditor'

export default function AdminConfigFilePage() {
  return (
    <div data-testid="admin-config-file-page">
      <h1 className="mb-2 text-2xl font-bold">配置文件</h1>
      <p className="mb-6 text-sm text-[var(--muted)]">
        定义爬虫源站列表的 JSON 配置。保存后自动同步到「视频源配置」，<code className="text-[var(--accent)]">from_config=true</code> 的源站不可手动删除。
      </p>
      <ConfigFileEditor />
    </div>
  )
}
