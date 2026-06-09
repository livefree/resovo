'use client'

/**
 * admin-shell-nav-counts.ts — 侧边栏导航 count badge 实时化（ADR-190 / NTLG-P0-1-B）
 *
 * countProvider 是 admin-ui 既有协议（ADR-103a §4.2，同步函数签名）；本 hook 在
 * client 侧 60s 轮询真数据后重建 countProvider 闭包，runtime 返回值优先于
 * ADMIN_NAV 静态 count 回退（admin-shell.tsx 消费侧既有逻辑，不改 admin-ui Props）。
 *
 * NTLG-P0-1-B：从「仅 merge 单查」升级为消费单一聚合端点
 * `GET /admin/system/nav-counts`（ADR-190），一次拿全 5 模块计数填充侧边栏。
 * 服务端逐模块容错（§11 D8）+ 角色门控：无权/失败的模块不在 data 中，前端天然无 badge。
 *
 * 轮询范式对齐 admin-shell-notifications.ts（setInterval 60s + 失败 warn 降级；
 * 设计稿「SWR」按项目惯例落地为自写 hook——项目无 swr 依赖，禁引入新依赖红线）。
 */

import { useEffect, useMemo, useState } from 'react'
import type { AdminNavCountProvider } from '@resovo/admin-ui'
import type { AdminNavCounts, AdminNavCountKey, AdminNavCountsResponse } from '@resovo/types'
import { apiClient, ApiClientError } from '@/lib/api-client'

const POLL_INTERVAL_MS = 60_000

/** nav count key → 侧边栏 href（与 admin-nav.tsx href 一一映射） */
const KEY_TO_HREF: Record<AdminNavCountKey, string> = {
  moderation: '/admin/moderation',
  sources: '/admin/sources',
  imageHealth: '/admin/image-health',
  userSubmissions: '/admin/user-submissions',
  merge: '/admin/merge',
}

/**
 * 60s 轮询 `/admin/system/nav-counts` → AdminNavCountProvider 闭包。
 * 加载中 / 失败 / count=0 / 缺省（无权·降级）时不入 Map（无 badge；不回退静态假数据）。
 */
export function useAdminNavCounts(): AdminNavCountProvider {
  const [counts, setCounts] = useState<AdminNavCounts | null>(null)

  useEffect(() => {
    let cancelled = false
    const reload = async () => {
      try {
        const res = await apiClient.get<AdminNavCountsResponse>('/admin/system/nav-counts')
        if (!cancelled) setCounts(res.data)
      } catch (err) {
        if (cancelled) return
        // 401/403 由会话/角色边界产生，静默降级无 badge；其他错误 warn 留痕
        // （对齐 useAdminNotifications HOTFIX-G degraded mode 范式）
        if (err instanceof ApiClientError && (err.status === 401 || err.status === 403)) return
        // eslint-disable-next-line no-console -- 客户端 hook 无 logger / degraded mode 留痕
        console.warn('[useAdminNavCounts] /admin/system/nav-counts failed (degraded mode):', err)
      }
    }
    void reload()
    const timer = setInterval(() => { void reload() }, POLL_INTERVAL_MS)
    return () => { cancelled = true; clearInterval(timer) }
  }, [])

  return useMemo<AdminNavCountProvider>(() => {
    if (counts === null) return () => new Map()
    const entries: Array<[string, number]> = []
    for (const key of Object.keys(KEY_TO_HREF) as AdminNavCountKey[]) {
      const value = counts[key]
      // 0 / 缺省（无权·降级）不入 Map → 无 badge
      if (typeof value === 'number' && value > 0) {
        entries.push([KEY_TO_HREF[key], value])
      }
    }
    const snapshot: ReadonlyMap<string, number> = new Map(entries)
    return () => snapshot
  }, [counts])
}
