/**
 * AdminSearchService.ts — 后台全局搜索 fan-out 编排（ADR-200 D-200-2/3/4/5/6/7）
 *
 * 职责：
 *   - fan-out 到启用的 entitySearcher（videos ES / sources·users·tasks DB），Promise.allSettled 合并
 *     （某 searcher 失败不 500，返回其余 kind + 该组 degraded 标记，沿用 TaskAggregator 降级范式）
 *   - 服务端按 kind 分组 + 组内 top-N + 组内精确命中置顶；跨 kind 顺序由固定优先级决定（不按 score 混排）
 *   - 权限分级（D-200-5）：moderator 不返 user 组
 *   - videos 走后台可见性 ES（复用 resovo_videos analyzer + buildVideoMatchQuery，但**不加可见性 filter**，
 *     管理员需找的恰是待审/草稿/隐藏/受限），**禁止调公开 SearchService.search()**（其写死四过滤）
 */
import type { Client } from '@elastic/elasticsearch'
import type { Pool } from 'pg'
import type {
  AdminSearchResult,
  AdminSearchGroup,
  AdminSearchResponseData,
  AdminSearchKind,
  AdminSearchReason,
  AdminSearchVideoResult,
  AdminSearchSourceResult,
  AdminSearchUserResult,
  AdminSearchTaskResult,
  VideoType,
  VideoStatus,
  ReviewStatus,
  VisibilityStatus,
} from '@resovo/types'
import { ES_INDEX } from '@/api/lib/elasticsearch'
import { buildVideoMatchQuery } from './buildVideoMatchQuery'
import { searchAdminSources, type AdminSourceSearchRow } from '@/api/db/queries/sources'
import { searchAdminUsers, type AdminUserSearchRow } from '@/api/db/queries/users'
import { searchTaskRuns, TASK_RUN_STATUS_MAP, type TaskRunRow } from '@/api/db/queries/taskRuns'

// ── 内部 ES 查询类型（用 Record 避免 ES SDK 复杂 overload，与 SearchService 内部约定一致）──
type EsBody = Record<string, unknown>
function makeSearchParams(index: string, body: EsBody): Parameters<Client['search']>[0] {
  return { index, ...body } as Parameters<Client['search']>[0]
}

/** 固定 kind 优先级（跨 kind 不按 score 混排，ADR-200 D-200-2） */
const KIND_PRIORITY: readonly AdminSearchKind[] = ['video', 'source', 'user', 'task', 'submission']

/** reason 排序权重（组内精确命中置顶，ADR-200 D-200-2） */
const REASON_RANK: Record<AdminSearchReason, number> = {
  'exact-id': 0,
  'exact-short-id': 0,
  'title-prefix': 1,
  'title-match': 2,
  'field-match': 3,
  fuzzy: 4,
}

/** videos ES 仅取 admin payload 所需字段（同步链 VideoIndexSyncService 全状态写入这些列） */
const ES_VIDEO_SOURCE_FIELDS = [
  'id',
  'short_id',
  'title',
  'type',
  'year',
  'status',
  'review_status',
  'visibility_status',
] as const

export interface AdminSearchOptions {
  readonly limit: number
  readonly role: 'admin' | 'moderator'
}

/** 单实体搜索器（ADR-200 D-200-4：kind + search；fan-out 由 service 编排、DTO 统一可切兜底实现） */
interface EntitySearcher {
  readonly kind: AdminSearchKind
  search(q: string, limit: number): Promise<AdminSearchResult[]>
}

export class AdminSearchService {
  constructor(
    private es: Client,
    private db: Pool,
  ) {}

  async search(rawQuery: string, opts: AdminSearchOptions): Promise<AdminSearchResponseData> {
    const q = rawQuery.trim()
    if (q === '') return { query: '', groups: [] }

    const searchers = this.resolveSearchers(opts.role)
    const settled = await Promise.allSettled(searchers.map((s) => s.search(q, opts.limit)))

    const byKind = new Map<AdminSearchKind, AdminSearchGroup>()
    settled.forEach((res, i) => {
      const kind = searchers[i]!.kind
      if (res.status === 'fulfilled') {
        byKind.set(kind, { kind, items: sortGroupItems(res.value).slice(0, opts.limit) })
      } else {
        byKind.set(kind, { kind, items: [], degraded: true })
      }
    })

    // 固定 kind 优先级排序；空组（无命中且非 degraded）不输出
    const groups: AdminSearchGroup[] = []
    for (const kind of KIND_PRIORITY) {
      const g = byKind.get(kind)
      if (g && (g.items.length > 0 || g.degraded === true)) groups.push(g)
    }
    return { query: q, groups }
  }

  /** 按角色解析启用的 searcher（D-200-5：moderator 不返 user，避免越权信息泄露） */
  private resolveSearchers(role: 'admin' | 'moderator'): EntitySearcher[] {
    const list: EntitySearcher[] = [
      { kind: 'video', search: (q, limit) => this.searchVideos(q, limit) },
      { kind: 'source', search: (q, limit) => this.searchSources(q, limit) },
    ]
    if (role === 'admin') {
      list.push({ kind: 'user', search: (q, limit) => this.searchUsers(q, limit) })
    }
    list.push({ kind: 'task', search: (q, limit) => this.searchTasks(q, limit) })
    return list
  }

  // ── videos = 后台可见性 ES（D-200-3：复用 analyzer + buildVideoMatchQuery，无可见性 filter）──
  private async searchVideos(q: string, limit: number): Promise<AdminSearchVideoResult[]> {
    const must = buildVideoMatchQuery(q)
    if (must.length === 0) return []
    const body: EsBody = {
      query: { bool: { must } },
      size: limit,
      _source: [...ES_VIDEO_SOURCE_FIELDS],
      highlight: {
        fields: {
          title: { pre_tags: ['<em>'], post_tags: ['</em>'] },
          title_en: { pre_tags: ['<em>'], post_tags: ['</em>'] },
        },
      },
    }
    const res = await this.es.search(makeSearchParams(ES_INDEX, body))
    return res.hits.hits.map((hit) => {
      const src = (hit._source ?? {}) as Record<string, unknown>
      const hl = (hit.highlight ?? {}) as Record<string, string[] | undefined>
      return buildVideoResult(src, hl.title?.[0] ?? hl.title_en?.[0], hit._score ?? 0, q)
    })
  }

  private async searchSources(q: string, limit: number): Promise<AdminSearchSourceResult[]> {
    const rows = await searchAdminSources(this.db, q, limit)
    return rows.map((row) => mapSourceRow(row, q))
  }

  private async searchUsers(q: string, limit: number): Promise<AdminSearchUserResult[]> {
    const rows = await searchAdminUsers(this.db, q, limit)
    return rows.map((row) => mapUserRow(row, q))
  }

  private async searchTasks(q: string, limit: number): Promise<AdminSearchTaskResult[]> {
    const rows = await searchTaskRuns(this.db, { q, limit })
    return rows.map((row) => mapTaskRow(row, q))
  }
}

// ── 组内排序：reason 优先 + score 降序（精确命中置顶，ADR-200 D-200-2）──
function sortGroupItems(items: readonly AdminSearchResult[]): AdminSearchResult[] {
  return [...items].sort((a, b) => {
    const r = REASON_RANK[a.reason] - REASON_RANK[b.reason]
    if (r !== 0) return r
    return b.score - a.score
  })
}

// ── 各 kind row → DTO 映射 ──────────────────────────────

function buildVideoResult(
  src: Record<string, unknown>,
  highlight: string | undefined,
  score: number,
  q: string,
): AdminSearchVideoResult {
  const id = String(src.id ?? '')
  const shortId = String(src.short_id ?? '')
  const title = String(src.title ?? '')
  return {
    kind: 'video',
    id,
    title,
    // videos 列表 urlNamespace='v'（VideoListClient），deep-link `v.f.q` 预过滤命中项
    href: `/admin/videos?v.f.q=${encodeURIComponent(title)}`,
    score,
    reason: detectVideoReason(q, shortId, id, title),
    highlight,
    payload: {
      shortId,
      type: src.type as VideoType,
      year: (src.year as number | null) ?? null,
      status: src.status as VideoStatus,
      reviewStatus: src.review_status as ReviewStatus,
      visibilityStatus: src.visibility_status as VisibilityStatus,
    },
  }
}

function mapSourceRow(row: AdminSourceSearchRow, q: string): AdminSearchSourceResult {
  const sourceName = row.source_name ?? ''
  const videoTitle = row.video_title ?? ''
  return {
    kind: 'source',
    id: row.id,
    title: sourceName || row.source_url,
    // sources 页 SourcesClient 用本地 keyword state（非 URL 同步），MVP 落列表页（Phase 2 深链）
    href: '/admin/sources',
    score: 0,
    // ILIKE 类 kind 无 ES highlight（D-200-6），前端按 query 客户端兜底
    reason: detectFieldReason(q, [sourceName, videoTitle, row.source_url]),
    payload: {
      sourceName,
      siteDisplayName: row.site_key,
      videoId: row.video_id,
      videoTitle,
      sourceUrl: row.source_url,
    },
  }
}

function mapUserRow(row: AdminUserSearchRow, q: string): AdminSearchUserResult {
  return {
    kind: 'user',
    id: row.id,
    title: row.username,
    href: `/admin/users?f.q=${encodeURIComponent(row.username)}`,
    score: 0,
    reason: detectFieldReason(q, [row.username, row.email]),
    payload: { username: row.username, email: row.email, role: row.role },
  }
}

function mapTaskRow(row: TaskRunRow, q: string): AdminSearchTaskResult {
  const lastRun = row.startedAt ?? row.createdAt ?? null
  return {
    kind: 'task',
    id: row.id,
    title: row.title || row.kind,
    href: '/admin/crawler/runs',
    score: 0,
    reason: detectFieldReason(q, [row.title ?? '']),
    payload: {
      status: TASK_RUN_STATUS_MAP[row.status] ?? 'pending',
      lastRunAt: lastRun ? lastRun.toISOString() : null,
    },
  }
}

// ── reason 推断（组内置顶依据；ILIKE 类无 ES 评分，仅靠 reason + DB 序）──

function detectVideoReason(q: string, shortId: string, id: string, title: string): AdminSearchReason {
  const ql = q.toLowerCase()
  if (shortId && shortId.toLowerCase() === ql) return 'exact-short-id'
  if (id && id.toLowerCase() === ql) return 'exact-id'
  const t = title.toLowerCase()
  if (t === ql || t.startsWith(ql)) return 'title-prefix'
  if (t.includes(ql)) return 'title-match'
  return 'fuzzy'
}

function detectFieldReason(q: string, fields: readonly string[]): AdminSearchReason {
  const ql = q.toLowerCase()
  for (const f of fields) {
    const fl = (f ?? '').toLowerCase()
    if (fl !== '' && (fl === ql || fl.startsWith(ql))) return 'title-prefix'
  }
  return 'field-match'
}
