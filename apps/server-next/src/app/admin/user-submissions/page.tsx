/**
 * /admin/user-submissions — 4 类用户投稿统一视图（ADR-124 + spec §5.13）
 *
 * 任务卡：CHG-SN-7-REDO-02-C
 * 旧 /admin/submissions 在 REDO-02-D 卡内改 alias 转发新端点 + 加 deprecation banner；
 * 当前 sidebar 入口仍指向旧路径，D 卡完成后切到新路径。
 */

import { UserSubmissionsClient } from './_client/UserSubmissionsClient'

export const dynamic = 'force-dynamic'

export default function UserSubmissionsPage() {
  return <UserSubmissionsClient />
}
