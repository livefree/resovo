'use client'

/**
 * admin-shell-nav-counts.ts — 侧边栏导航 count badge 实时化（CHG-VIR-13-A1 / 设计 §4.1 域 A）
 *
 * countProvider 是 admin-ui 既有协议（ADR-103a §4.2，同步函数签名）；本 hook 在
 * client 侧 60s 轮询真数据后重建 countProvider 闭包，runtime 返回值优先于
 * ADMIN_NAV 静态 count 回退（admin-shell.tsx 消费侧既有逻辑，不改 admin-ui Props）。
 *
 * 首项接入：`/admin/merge` pending 候选总数 — 复用既有
 * GET /admin/video-merges/candidates（source=identity / limit=1）读 total，免新端点
 * （设计 §3「candidates 端点已返回 total」）。identity 空表服务端自动降级 legacy
 * 时 total 为 legacy 组数，同样是「待处理候选」语义，badge 直接可用。
 *
 * 轮询范式对齐 admin-shell-notifications.ts（setInterval 60s + 失败 warn 降级；
 * 设计稿「SWR」按项目惯例落地为自写 hook——项目无 swr 依赖，禁引入新依赖红线）。
 */

import { useEffect, useMemo, useState } from 'react'
import type { AdminNavCountProvider } from '@resovo/admin-ui'
import { listCandidates } from '@/lib/merge/api'
import { ApiClientError } from '@/lib/api-client'

const POLL_INTERVAL_MS = 60_000

/**
 * 60s 轮询 merge pending 候选总数 → AdminNavCountProvider 闭包。
 * 加载中 / 失败 / count=0 时不入 Map（无 badge；不回退静态假数据）。
 */
export function useAdminNavCounts(): AdminNavCountProvider {
  const [mergeCount, setMergeCount] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    const reload = async () => {
      try {
        const res = await listCandidates({ source: 'identity', minScore: 0, limit: 1, page: 1 })
        if (!cancelled) setMergeCount(res.total)
      } catch (err) {
        if (cancelled) return
        // 401/403 由会话/角色边界产生（moderator 无 merge 端点权限），静默降级无 badge；
        // 其他错误 warn 留痕（对齐 useAdminNotifications HOTFIX-G degraded mode 范式）
        if (err instanceof ApiClientError && (err.status === 401 || err.status === 403)) return
        // eslint-disable-next-line no-console -- 客户端 hook 无 logger / degraded mode 留痕
        console.warn('[useAdminNavCounts] /admin/video-merges/candidates failed (degraded mode):', err)
      }
    }
    void reload()
    const timer = setInterval(() => { void reload() }, POLL_INTERVAL_MS)
    return () => { cancelled = true; clearInterval(timer) }
  }, [])

  return useMemo<AdminNavCountProvider>(() => {
    if (mergeCount === null || mergeCount === 0) return () => new Map()
    const snapshot: ReadonlyMap<string, number> = new Map([['/admin/merge', mergeCount]])
    return () => snapshot
  }, [mergeCount])
}
