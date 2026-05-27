/**
 * bangumi.ts — Bangumi.tv v0 REST API 客户端（ADR-159）
 *
 * 约束（对标 lib/douban.ts 降级哲学）：
 * - Bearer Token 鉴权（config.BANGUMI_API_TOKEN）；Token 缺失时仍可访问公开数据，
 *   但失败/超时一律返回 null/[]，由调用方降级（不抛）
 * - Bangumi 要求描述性 User-Agent（config.BANGUMI_USER_AGENT）
 * - 仅按需调用（auto 命中 / 后台手动）；批量场景走本地 dump 索引，避免限流
 */

// 直接读 process.env（与 lib/queue.ts 同模式，避免引入 config 单例的启动期 fail-fast）。
// config.ts 仍声明这组变量做启动校验/文档；此处运行时按需读取，便于测试注入。
const API_BASE = 'https://api.bgm.tv'

function apiToken(): string | undefined {
  return process.env.BANGUMI_API_TOKEN || undefined
}
function timeoutMs(): number {
  const n = Number(process.env.BANGUMI_API_TIMEOUT_MS)
  return Number.isFinite(n) && n > 0 ? n : 8000
}
function userAgent(): string {
  return process.env.BANGUMI_USER_AGENT || 'resovo/1.0 (+https://github.com/resovo)'
}

// ── 类型（v0 schema 子集，仅取本项目消费字段）─────────────────────

export interface BangumiImages {
  large?: string
  common?: string
  medium?: string
  small?: string
  grid?: string
}

export interface BangumiRating {
  rank: number
  total: number
  score: number
}

export interface BangumiTag {
  name: string
  count: number
}

/** infobox 项：value 可能是字符串，或 { k?, v }[] 列表 */
export interface BangumiInfoboxItem {
  key: string
  value: string | Array<{ k?: string; v: string }>
}

export interface BangumiSubject {
  id: number
  type: number
  name: string
  name_cn: string
  summary: string
  nsfw: boolean
  date: string | null
  platform: string
  images: BangumiImages | null
  infobox: BangumiInfoboxItem[]
  rating: BangumiRating | null
  tags: BangumiTag[]
  total_episodes: number
  eps: number
}

export interface BangumiEpisode {
  id: number
  type: number // 0 本篇 / 1 SP / 2 OP / 3 ED
  name: string
  name_cn: string
  sort: number
  ep: number | null
  airdate: string
  duration: string
  duration_seconds: number | null
  desc: string
}

/** 搜索结果条目（POST /v0/search/subjects 的 data 元素，字段较 subject 精简） */
export interface BangumiSearchItem {
  id: number
  name: string
  name_cn: string
  date: string | null
  images: BangumiImages | null
  rating: BangumiRating | null
}

// ── HTTP 封装 ─────────────────────────────────────────────────────

function buildHeaders(extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = {
    'User-Agent': userAgent(),
    Accept: 'application/json',
    ...extra,
  }
  const token = apiToken()
  if (token) headers.Authorization = `Bearer ${token}`
  return headers
}

async function bgmGet<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      headers: buildHeaders(),
      signal: AbortSignal.timeout(timeoutMs()),
    })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}

// ── 公开 API ──────────────────────────────────────────────────────

/** GET /v0/subjects/{id} — 单条作品 rich 详情；失败返回 null */
export async function getSubject(id: number): Promise<BangumiSubject | null> {
  return bgmGet<BangumiSubject>(`/v0/subjects/${id}`)
}

/**
 * GET /v0/episodes — 拉取某作品全部本篇逐集（分页，单页 100，上限 50 页防无界，ADR-159 A4）。
 * 失败/无数据返回 []。
 */
export async function getEpisodes(subjectId: number): Promise<BangumiEpisode[]> {
  const PAGE = 100
  const MAX_PAGES = 50
  const all: BangumiEpisode[] = []
  for (let page = 0; page < MAX_PAGES; page++) {
    const offset = page * PAGE
    const resp = await bgmGet<{ data: BangumiEpisode[]; total: number }>(
      `/v0/episodes?subject_id=${subjectId}&limit=${PAGE}&offset=${offset}`,
    )
    if (!resp || !Array.isArray(resp.data) || resp.data.length === 0) break
    all.push(...resp.data)
    if (all.length >= resp.total) break
  }
  return all
}

/**
 * POST /v0/search/subjects — 关键词搜索动画（type=2）候选。失败返回 []。
 */
export async function searchSubjects(keyword: string, limit = 10): Promise<BangumiSearchItem[]> {
  try {
    const res = await fetch(`${API_BASE}/v0/search/subjects?limit=${limit}`, {
      method: 'POST',
      headers: buildHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ keyword, filter: { type: [2] } }),
      signal: AbortSignal.timeout(timeoutMs()),
    })
    if (!res.ok) return []
    const data = (await res.json()) as { data?: BangumiSearchItem[] }
    return Array.isArray(data.data) ? data.data : []
  } catch {
    return []
  }
}

/** Token 是否已配置（调用方据此决定走 REST 详情还是仅本地 dump 降级） */
export function isBangumiApiConfigured(): boolean {
  return Boolean(apiToken())
}
