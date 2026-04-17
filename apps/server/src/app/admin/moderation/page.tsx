/**
 * /admin/moderation — 内容审核台页面（CHG-221）
 * 爬虫采集内容的人工审核工作台入口
 * UX-13: 待审核 / 已审核 Tab 切换（由 ModerationDashboard 管理）
 */

import { Suspense } from 'react'
import { ListPageShell } from '@/components/shared/layout/ListPageShell'
import { ModerationDashboard } from '@/components/admin/moderation/ModerationDashboard'

export default function AdminModerationPage() {
  return (
    <ListPageShell variant="admin"
      title="内容审核台"
      description="审核爬虫采集内容，执行通过或拒绝（支持填写拒绝原因）。"
      testId="admin-moderation-page"
    >
      <Suspense>
        <ModerationDashboard />
      </Suspense>
    </ListPageShell>
  )
}
