/**
 * /admin/403 — 无权访问页面
 * ADR-010: role=user 或 moderator 访问 admin-only 路径时重定向至此
 */

import Link from 'next/link'

export default function AdminForbiddenPage() {
  return (
    <main
      className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[var(--bg)] text-[var(--text)]"
      data-testid="admin-403-page"
    >
      <div className="text-center">
        <p className="mb-2 text-8xl font-bold text-[var(--accent)]">403</p>
        <h1 className="mb-2 text-2xl font-semibold">无权访问</h1>
        <p className="text-[var(--muted)]">您的账号权限不足，无法访问此页面。</p>
      </div>
      <Link
        href="/"
        className="rounded-md bg-[var(--accent)] px-5 py-2 text-sm font-medium text-black hover:opacity-90"
      >
        返回首页
      </Link>
    </main>
  )
}
