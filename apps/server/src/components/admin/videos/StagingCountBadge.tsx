/**
 * StagingCountBadge.tsx — 暂存队列数量 badge（VIDEO-10）
 * 首次挂载时拉取 /admin/staging?page=1&limit=1 获取 total，
 * 以 badge 形式展示"暂存中 N 条"，点击跳转暂存队列页面。
 */

'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { apiClient } from '@/lib/api-client'

export function StagingCountBadge() {
  const [count, setCount] = useState<number | null>(null)

  useEffect(() => {
    apiClient
      .get<{ total: number }>('/admin/staging?page=1&limit=1')
      .then((res) => { setCount(res.total) })
      .catch(() => { /* 加载失败不影响页面其他功能 */ })
  }, [])

  if (count === null || count === 0) return null

  return (
    <Link
      href="/admin/staging"
      className="inline-flex items-center gap-1.5 rounded-full border border-blue-500/40 bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-300 hover:bg-blue-500/20 transition-colors"
      data-testid="staging-count-badge"
    >
      <span>暂存中</span>
      <span
        className="rounded-full bg-blue-500/30 px-1.5 py-0.5 tabular-nums"
        data-testid="staging-count-value"
      >
        {count}
      </span>
      <span>条</span>
    </Link>
  )
}
