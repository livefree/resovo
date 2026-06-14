'use client'
/**
 * admin-global-search.ts — 顶栏全局搜索接线（ADR-200 / SEARCH-02-C）
 *
 * 职责：
 *   - `useAdminGlobalSearch`：debounce + AbortController 调 `GET /admin/search`，维护 loading + prefilteredGroups；
 *     query='' 清空（防 stale，与 CommandPalette open=false 发 onQueryChange('') 端到端闭环）。
 *   - `mapAdminSearchToCommandGroups`：DTO → CommandGroup 纯映射（id namespace `search:kind:id` 防与本地 nav href 撞键，
 *     自然显示 meta）。
 *
 * 防抖/取消由本消费方负责（CommandPalette 组件保持纯，ADR-200 D-200-1）。
 */
import { useCallback, useRef, useState } from 'react'
import type { CommandGroup, CommandItem } from '@resovo/admin-ui'
import type {
  AdminSearchResponseData,
  AdminSearchResult,
  AdminSearchKind,
} from '@resovo/types'
import { apiClient } from '@/lib/api-client'

const DEBOUNCE_MS = 250

/** kind → 结果分组中文标题（与 ADR-200 实体范围一致） */
const KIND_GROUP_LABEL: Record<AdminSearchKind, string> = {
  video: '视频',
  source: '播放源',
  user: '用户',
  task: '任务',
  submission: '投稿',
}

/** user 角色短标签（meta 自然显示；与 UserRole SSOT 同枚举） */
const ROLE_LABEL: Record<string, string> = {
  admin: '管理员',
  moderator: '审核员',
  user: '用户',
}

/** task 面向状态短标签（AdminTaskItem.status 4 态） */
const TASK_STATUS_LABEL: Record<string, string> = {
  pending: '待处理',
  running: '运行中',
  success: '成功',
  failed: '失败',
}

/** 拼接非空片段为 meta（中点分隔）；全空 → undefined（CommandItem.meta 可选） */
function joinMeta(parts: ReadonlyArray<string | number | null | undefined>): string | undefined {
  const text = parts.filter((p) => p !== null && p !== undefined && p !== '').join(' · ')
  return text === '' ? undefined : text
}

/** 单条结果自然显示的次要信息（plan UX：视频=年份/short_id；源=站点/视频；用户=email/角色；任务=状态/时间） */
function buildMeta(result: AdminSearchResult): string | undefined {
  switch (result.kind) {
    case 'video':
      return joinMeta([result.payload.year, result.payload.shortId])
    case 'source':
      return joinMeta([result.payload.siteDisplayName, result.payload.videoTitle])
    case 'user':
      return joinMeta([result.payload.email, ROLE_LABEL[result.payload.role] ?? result.payload.role])
    case 'task':
      return joinMeta([
        TASK_STATUS_LABEL[result.payload.status] ?? result.payload.status,
        result.payload.lastRunAt ? result.payload.lastRunAt.slice(0, 10) : null,
      ])
    case 'submission':
      return joinMeta([result.payload.submittedBy, result.payload.createdAt.slice(0, 10)])
  }
}

function mapItem(result: AdminSearchResult, rank: number, globalRank: number): CommandItem {
  return {
    // namespace 防与本地 nav href（id=href）撞键（CommandItem.id 全局唯一约束，ADR-200 D-200-1）
    id: `search:${result.kind}:${result.id}`,
    label: result.title,
    meta: buildMeta(result),
    kind: 'navigate',
    href: result.href,
    // D-200-10.4：映射期预存点击埋点 rank（组内 1-based / globalRank prefiltered 扁平 1-based）。
    // 在此预存而非消费方点击时现算——避免点击瞬间 prefilteredGroups 已被新 in-flight 结果回填的竞态。
    telemetry: { kind: result.kind, rank, globalRank },
  }
}

/** DTO → CommandGroup（服务端已分组/排序，前端仅展示映射；空组保留以承载 degraded 提示文案） */
export function mapAdminSearchToCommandGroups(data: AdminSearchResponseData): CommandGroup[] {
  let globalRank = 0 // prefiltered 扁平计数（仅命中项、跨组累加；degraded 空组不计）
  return data.groups
    .filter((group) => group.items.length > 0 || group.degraded === true)
    .map((group) => ({
      id: `search:${group.kind}`,
      label: group.degraded ? `${KIND_GROUP_LABEL[group.kind]}（部分不可用）` : KIND_GROUP_LABEL[group.kind],
      items: group.items.map((item, idx) => mapItem(item, idx + 1, (globalRank += 1))),
    }))
}

export interface AdminGlobalSearch {
  /** 服务端已过滤的结果组（传 CommandPalette.commandPrefilteredGroups）；undefined=空查询/已清空 */
  readonly prefilteredGroups: readonly CommandGroup[] | undefined
  readonly loading: boolean
  /** 传 CommandPalette.onCommandQueryChange（已 memoize） */
  readonly onQueryChange: (q: string) => void
  /** 当前结果对应的查询词（trim 后）；点击埋点 POST 明文 query 来源（D-200-10.4）。空查询时 '' */
  readonly query: string
}

export function useAdminGlobalSearch(): AdminGlobalSearch {
  const [prefilteredGroups, setPrefilteredGroups] = useState<readonly CommandGroup[] | undefined>(undefined)
  const [loading, setLoading] = useState(false)
  // 当前结果对应的查询词（与 prefilteredGroups 同步）；点击埋点 POST 明文 query 来源（D-200-10.4）
  const [query, setQuery] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  // 单调请求 token（latest-wins）：每次输入变更即自增 → 旧在途请求 resolve 时若 token 已被更新输入推进则丢弃。
  // 不依赖 AbortController 的 abort 时序：abort 推迟到下一个 debounce setTimeout 才执行，存在「旧请求在新输入后、
  // abort 前就 resolve」的窗口，仅靠 `signal.aborted` 会漏过 → 提交 stale（Codex stop-time review）。
  const requestIdRef = useRef(0)

  const onQueryChange = useCallback((raw: string) => {
    const q = raw.trim()
    // 每次输入变更（含清空）即推进 token，作废所有更早的在途/将发请求
    const myId = ++requestIdRef.current
    if (debounceRef.current) clearTimeout(debounceRef.current)

    // 空查询 → 取消在途 + 清空结果（与 CommandPalette open=false 发 '' 端到端闭环，防 stale）
    if (q === '') {
      abortRef.current?.abort()
      abortRef.current = null
      setPrefilteredGroups(undefined)
      setQuery('')
      setLoading(false)
      return
    }

    setLoading(true)
    debounceRef.current = setTimeout(() => {
      abortRef.current?.abort()
      const ctrl = new AbortController()
      abortRef.current = ctrl
      void (async () => {
        try {
          const res = await apiClient.get<{ data: AdminSearchResponseData }>(
            `/admin/search?q=${encodeURIComponent(q)}`,
            { signal: ctrl.signal },
          )
          // latest-wins：更新的输入已发生（token 推进）→ 丢弃此 stale 结果（不依赖 abort 时序）
          if (myId !== requestIdRef.current) return
          setPrefilteredGroups(mapAdminSearchToCommandGroups(res.data))
          setQuery(q) // 与结果同步提交（点击埋点明文 query 来源）
          setLoading(false)
        } catch {
          if (myId !== requestIdRef.current) return // 被更晚输入取代（含 AbortError），不更新
          // 其余错误（ES 宕机/网络）→ 空结果兜底，不崩 shell（ADR-200 D-200-7 前端容忍）
          setPrefilteredGroups([])
          setLoading(false)
        }
      })()
    }, DEBOUNCE_MS)
  }, [])

  return { prefilteredGroups, loading, onQueryChange, query }
}
