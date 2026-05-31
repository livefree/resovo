/**
 * bangumi.ts — Bangumi.tv v0 REST API 客户端（ADR-161）
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

/**
 * ADR-168 D-168-5：凭证可注入配置。来源优先级 = cfg 字段 > process.env > 默认。
 * BangumiService 经 system_settings 读取后注入；缺省（cfg 省略或字段 undefined）回退 env（向后兼容 / 测试注入不破坏）。
 */
export interface BangumiClientConfig {
  token?: string
  userAgent?: string
  timeoutMs?: number
}

function apiToken(cfg?: BangumiClientConfig): string | undefined {
  return cfg?.token || process.env.BANGUMI_API_TOKEN || undefined
}
function timeoutMs(cfg?: BangumiClientConfig): number {
  const raw = cfg?.timeoutMs ?? Number(process.env.BANGUMI_API_TIMEOUT_MS)
  return Number.isFinite(raw) && (raw as number) > 0 ? (raw as number) : 8000
}
function userAgent(cfg?: BangumiClientConfig): string {
  return cfg?.userAgent || process.env.BANGUMI_USER_AGENT || 'resovo/1.0 (+https://github.com/resovo)'
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

function buildHeaders(cfg?: BangumiClientConfig, extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = {
    'User-Agent': userAgent(cfg),
    Accept: 'application/json',
    ...extra,
  }
  const token = apiToken(cfg)
  if (token) headers.Authorization = `Bearer ${token}`
  return headers
}

async function bgmGet<T>(path: string, cfg?: BangumiClientConfig): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      headers: buildHeaders(cfg),
      signal: AbortSignal.timeout(timeoutMs(cfg)),
    })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}

// ── 公开 API ──────────────────────────────────────────────────────

/** GET /v0/subjects/{id} — 单条作品 rich 详情；失败返回 null */
export async function getSubject(id: number, cfg?: BangumiClientConfig): Promise<BangumiSubject | null> {
  return bgmGet<BangumiSubject>(`/v0/subjects/${id}`, cfg)
}

/**
 * GET /v0/episodes — 拉取某作品全部本篇逐集（分页，单页 100，上限 50 页防无界，ADR-161 A4）。
 * 失败/无数据返回 []。
 */
export async function getEpisodes(subjectId: number, cfg?: BangumiClientConfig): Promise<BangumiEpisode[]> {
  const PAGE = 100
  const MAX_PAGES = 50
  const all: BangumiEpisode[] = []
  for (let page = 0; page < MAX_PAGES; page++) {
    const offset = page * PAGE
    const resp = await bgmGet<{ data: BangumiEpisode[]; total: number }>(
      `/v0/episodes?subject_id=${subjectId}&limit=${PAGE}&offset=${offset}`,
      cfg,
    )
    if (!resp || !Array.isArray(resp.data) || resp.data.length === 0) break
    all.push(...resp.data)
    if (all.length >= resp.total) break
  }
  return all
}

/**
 * POST /v0/search/subjects — 关键词搜索动画（type=2）候选。
 *
 * **严格版**：网络错误 / 超时 / 非 2xx 一律**抛出**（不吞）。
 * 用于自动富集匹配路径（BangumiService.matchViaRest）—— 调用方需区分「真无结果（[]）」与
 * 「瞬时失败（throw）」，避免把 API 瞬时故障误写成终态 unmatched（Codex stop-time review）。
 * 成功且 data 缺省 → 返回 []（真无结果）。
 */
export async function searchSubjectsStrict(keyword: string, limit = 10, cfg?: BangumiClientConfig): Promise<BangumiSearchItem[]> {
  const res = await fetch(`${API_BASE}/v0/search/subjects?limit=${limit}`, {
    method: 'POST',
    headers: buildHeaders(cfg, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({ keyword, filter: { type: [2] } }),
    signal: AbortSignal.timeout(timeoutMs(cfg)),
  })
  if (!res.ok) throw new Error(`bangumi searchSubjects failed: HTTP ${res.status}`)
  const data = (await res.json()) as { data?: BangumiSearchItem[] }
  return Array.isArray(data.data) ? data.data : []
}

/**
 * POST /v0/search/subjects — 关键词搜索动画（type=2）候选。**宽容版**：失败返回 []。
 * 用于手动后台候选搜索（searchCandidates）—— API 故障时优雅降级为「无候选」，不阻断 UI。
 */
export async function searchSubjects(keyword: string, limit = 10, cfg?: BangumiClientConfig): Promise<BangumiSearchItem[]> {
  try {
    return await searchSubjectsStrict(keyword, limit, cfg)
  } catch {
    return []
  }
}

/** Token 是否已配置（调用方据此决定走 REST 详情还是仅本地 dump 降级） */
export function isBangumiApiConfigured(cfg?: BangumiClientConfig): boolean {
  return Boolean(apiToken(cfg))
}
