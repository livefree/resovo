import { Suspense } from 'react'
import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { LoadingState } from '@resovo/admin-ui'
import { parseUserRole } from '@/lib/auth'
import { SourcesClient } from './_client/SourcesClient'

export const metadata: Metadata = {
  title: '播放线路 | Resovo Admin',
}

// 服务端读取 user_role cookie（middleware 鉴权后已存在）→ 派生 isAdmin，用于门控操作列
// refresh/zap（adminOnly 端点 batch-probe / batch-render-check）在 moderator 可达页面上
// 不可触发（Codex stop-time review）。沿用 admin layout 同 cookie 读取范式。
const COOKIE_USER_ROLE = 'user_role'

export default async function SourcesPage() {
  const cookieStore = await cookies()
  const isAdmin = parseUserRole(cookieStore.get(COOKIE_USER_ROLE)?.value) === 'admin'
  return (
    <Suspense fallback={<LoadingState variant="skeleton" />}>
      <SourcesClient isAdmin={isAdmin} />
    </Suspense>
  )
}
