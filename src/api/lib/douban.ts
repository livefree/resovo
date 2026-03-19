/**
 * douban.ts — 豆瓣 HTTP 客户端（非官方）
 * CHG-23: 管理员手动触发的元数据同步
 *
 * 约束：
 * - 无官方 API，依赖 HTML JSON-LD 解析，不引入 cheerio/puppeteer
 * - 只能手动触发，不可批量自动执行
 * - 抓取失败时返回 null，由调用方降级处理
 */

// ── 类型 ──────────────────────────────────────────────────────────

export interface DoubanSubject {
  id: string
  title: string
  year: number | null
  rating: number | null
  summary: string | null
  directors: string[]
  casts: string[]
  posterUrl: string | null
}

// ── UA 轮换（防反爬） ─────────────────────────────────────────────

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_2) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
]

function pickUA(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]
}

/** 随机延迟 200~500ms（礼貌抓取） */
function delay(): Promise<void> {
  return new Promise((r) => setTimeout(r, 200 + Math.random() * 300))
}

// ── 搜索 ──────────────────────────────────────────────────────────

interface SuggestItem {
  id: string
  title: string
  year: string
  sub_title: string
}

/**
 * 搜索豆瓣影视
 * 使用 Douban subject_suggest JSON API，返回候选列表
 */
export async function searchDouban(
  title: string,
  year?: number
): Promise<SuggestItem[]> {
  await delay()

  const query = year ? `${title} ${year}` : title
  const url = `https://www.douban.com/j/subject_suggest?q=${encodeURIComponent(query)}`

  const res = await fetch(url, {
    headers: {
      'User-Agent': pickUA(),
      Referer: 'https://www.douban.com/',
      Accept: 'application/json, text/plain, */*',
    },
    signal: AbortSignal.timeout(8000),
  })

  if (!res.ok) return []

  const data = await res.json() as SuggestItem[]
  return Array.isArray(data) ? data.filter((item) => item.id && item.title) : []
}

// ── 详情 ──────────────────────────────────────────────────────────

/**
 * 获取豆瓣影视详情（解析 JSON-LD 结构）
 * JSON-LD 位于 <script type="application/ld+json">
 */
export async function getDoubanDetail(doubanId: string): Promise<DoubanSubject | null> {
  await delay()

  const url = `https://movie.douban.com/subject/${doubanId}/`

  let html: string
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': pickUA(),
        Referer: 'https://www.douban.com/',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return null
    html = await res.text()
  } catch {
    return null
  }

  // 提取 JSON-LD
  const ldMatch = html.match(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/i)
  if (!ldMatch) return null

  let ld: Record<string, unknown>
  try {
    ld = JSON.parse(ldMatch[1]) as Record<string, unknown>
  } catch {
    return null
  }

  // 解析评分
  let rating: number | null = null
  const aggRating = ld['aggregateRating'] as Record<string, unknown> | undefined
  if (aggRating?.ratingValue) {
    const r = parseFloat(String(aggRating.ratingValue))
    if (!isNaN(r)) rating = r
  }

  // 解析导演
  const directorRaw = ld['director']
  const directors = extractNames(directorRaw)

  // 解析主演
  const actorRaw = ld['actor']
  const casts = extractNames(actorRaw)

  // 解析海报
  const posterUrl = typeof ld['image'] === 'string' ? ld['image'] : null

  // 解析年份（从 datePublished 或 name 后缀）
  let year: number | null = null
  if (typeof ld['datePublished'] === 'string') {
    const y = parseInt(ld['datePublished'].slice(0, 4))
    if (!isNaN(y)) year = y
  }

  // 解析摘要
  const summary = typeof ld['description'] === 'string' ? ld['description'].trim() : null

  const name = typeof ld['name'] === 'string' ? ld['name'] : ''

  return {
    id: doubanId,
    title: name,
    year,
    rating,
    summary,
    directors,
    casts,
    posterUrl,
  }
}

// ── 辅助 ─────────────────────────────────────────────────────────

function extractNames(raw: unknown): string[] {
  if (!raw) return []
  if (Array.isArray(raw)) {
    return raw
      .map((item) => (typeof item === 'object' && item !== null ? (item as Record<string, unknown>)['name'] : item))
      .filter((n): n is string => typeof n === 'string' && n.length > 0)
  }
  if (typeof raw === 'object' && raw !== null) {
    const n = (raw as Record<string, unknown>)['name']
    return typeof n === 'string' ? [n] : []
  }
  return []
}
