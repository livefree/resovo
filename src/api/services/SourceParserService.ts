/**
 * SourceParserService.ts — 苹果CMS接口解析 + 字段映射
 * CRAWLER-02: XML/JSON 解析，字段映射，播放源拆分
 * ADR-008: 苹果CMS标准接口格式
 * ADR-009: cover_url 存外链，不下载
 */

import type { VideoType, VideoStatus, SourceType } from '@/types'

// ── 接口原始数据类型 ───────────────────────────────────────────────

export interface RawVodItem {
  vod_id: string | number
  vod_name: string
  vod_en?: string
  vod_pic?: string
  type_name?: string
  vod_year?: string | number
  vod_area?: string
  vod_actor?: string
  vod_director?: string
  vod_writer?: string
  vod_content?: string
  vod_remarks?: string
  vod_play_from?: string  // 线路名称（逗号分隔，对应 vod_play_url 中的多线路）
  vod_play_url?: string   // JSON 格式：线路1$url1#线路2$url2
}

// ── 解析结果类型 ──────────────────────────────────────────────────

export interface ParsedVideo {
  title: string
  titleEn: string | null
  coverUrl: string | null   // ADR-009: 直接存外链
  type: VideoType
  sourceContentType: string | null  // 爬虫原始类型字符串（ADR-017）
  normalizedType: string | null     // 平台规范化分类（ADR-017）
  category: string | null
  year: number | null
  country: string | null
  cast: string[]
  director: string[]
  writers: string[]
  description: string | null
  status: VideoStatus
  sourceVodId: string
}

export interface ParsedSource {
  sourceName: string
  episodeNumber: number | null  // 电影为 NULL
  sourceUrl: string             // ADR-001: 第三方直链
  type: SourceType              // 根据 URL 后缀判断
}

// ── 类型映射表（ADR-017）─────────────────────────────────────────

const TYPE_MAP: Record<string, VideoType> = {
  // 电影
  '电影': 'movie', 'movie': 'movie', 'Movie': 'movie',
  // 电视剧（内部类型为 drama，URL 保持 /series/）
  '电视剧': 'drama', '连续剧': 'drama', '国产剧': 'drama', '剧集': 'drama',
  '美剧': 'drama', '韩剧': 'drama', '日剧': 'drama',
  'series': 'drama', 'drama': 'drama',
  // 动漫
  '动漫': 'anime', '卡通': 'anime', '动画': 'anime', 'anime': 'anime',
  // 综艺
  '综艺': 'variety', '真人秀': 'variety', '晚会': 'variety', '综艺节目': 'variety',
  // 短剧
  '短剧': 'short_drama', '微剧': 'short_drama', 'short_drama': 'short_drama',
  // 体育
  '体育': 'sports', 'sports': 'sports',
  // 音乐
  '音乐': 'music', 'MV': 'music', 'music': 'music',
  // 纪录片
  '纪录片': 'documentary', 'documentary': 'documentary',
  // 少儿
  '少儿': 'children', '儿童': 'children', 'children': 'children',
  // 新闻
  '新闻': 'news', 'news': 'news',
  // 游戏
  '游戏': 'game_show', 'game_show': 'game_show',
}

const COUNTRY_MAP: Record<string, string> = {
  '中国大陆': 'CN', '大陆': 'CN', '国产': 'CN', '华语': 'CN',
  '香港': 'HK', '港剧': 'HK',
  '台湾': 'TW',
  '日本': 'JP', '日剧': 'JP',
  '韩国': 'KR', '韩剧': 'KR',
  '美国': 'US', '美剧': 'US',
  '英国': 'GB',
  '泰国': 'TH',
}

// ── 辅助函数 ──────────────────────────────────────────────────────

/** 按中英文逗号或顿号拆分人名列表 */
export function splitNames(raw: string | undefined): string[] {
  if (!raw) return []
  return raw
    .split(/[,，、]/)
    .map((s) => s.trim())
    .filter(Boolean)
}

/** 清理简单 HTML 标签（不引入外部依赖） */
export function stripTags(html: string | undefined): string | null {
  if (!html) return null
  return html.replace(/<[^>]+>/g, '').trim() || null
}

/** 解析 VideoType（未匹配返回 'other'，ADR-017） */
export function parseType(typeName: string | undefined): VideoType {
  if (!typeName) return 'other'
  return TYPE_MAP[typeName.trim()] ?? 'other'
}

/** 解析国家/地区 → ISO 代码 */
export function parseCountry(area: string | undefined): string | null {
  if (!area) return null
  return COUNTRY_MAP[area.trim()] ?? null
}

/** 解析年份 → number | null */
export function parseYear(raw: string | number | undefined): number | null {
  if (!raw) return null
  const n = parseInt(String(raw), 10)
  return isNaN(n) || n < 1900 || n > 2100 ? null : n
}

/** 解析播出状态 */
export function parseStatus(remarks: string | undefined): VideoStatus {
  if (!remarks) return 'ongoing'
  return remarks.includes('完结') ? 'completed' : 'ongoing'
}

/** 根据 URL 判断播放源类型 */
export function parseSourceType(url: string): SourceType {
  const lower = url.toLowerCase()
  if (lower.includes('.m3u8')) return 'hls'
  if (lower.includes('.mp4')) return 'mp4'
  return 'hls'  // 默认 HLS
}

/**
 * 解析播放源字符串 → ParsedSource[]
 * 格式：第01集$url1#第02集$url2（一个线路）
 * 多线路由 vod_play_from 定义（按 $ 分隔），vod_play_url 也按 $ 分隔对应
 *
 * @param playUrl   vod_play_url 单个线路的字符串
 * @param sourceName 线路名称
 * @param isMovie    是否为电影（episode_number 存 NULL）
 */
export function parsePlayUrl(
  playUrl: string,
  sourceName: string,
  isMovie: boolean
): ParsedSource[] {
  if (!playUrl.trim()) return []

  const episodes = playUrl.split('#').filter(Boolean)
  const results: ParsedSource[] = []

  for (const ep of episodes) {
    const parts = ep.split('$')
    if (parts.length < 2) continue

    const epLabel = parts[0].trim()
    const url = parts[parts.length - 1].trim()  // 最后一个 $ 后是 URL

    if (!url) continue

    // 从集名提取集数
    const numMatch = epLabel.match(/(\d+)/)
    const episodeNumber = isMovie ? null : (numMatch ? parseInt(numMatch[1], 10) : null)

    results.push({
      sourceName,
      episodeNumber,
      sourceUrl: url,
      type: parseSourceType(url),
    })
  }

  return results
}

// ── 主解析函数 ────────────────────────────────────────────────────

/** 将苹果CMS原始数据条目映射为结构化的 ParsedVideo + ParsedSource[] */
export function parseVodItem(item: RawVodItem): {
  video: ParsedVideo
  sources: ParsedSource[]
} {
  const typeName = (item.type_name ?? '').trim()
  const type = parseType(typeName)
  // 保留原始类型字符串；未知类型时 sourceContentType 记录原始值以便溯源
  const sourceContentType = typeName || null
  // 当前 normalizedType 与 type 保持一致；未来可做更细粒度映射
  const normalizedType: string = type

  const video: ParsedVideo = {
    title: (item.vod_name ?? '').trim(),
    titleEn: item.vod_en?.trim() || null,
    coverUrl: item.vod_pic?.trim() || null,  // ADR-009: 存外链
    type,
    sourceContentType,
    normalizedType,
    category: typeName || null,
    year: parseYear(item.vod_year),
    country: parseCountry(item.vod_area),
    cast: splitNames(item.vod_actor),
    director: splitNames(item.vod_director),
    writers: splitNames(item.vod_writer),
    description: stripTags(item.vod_content),
    status: parseStatus(item.vod_remarks),
    sourceVodId: String(item.vod_id),
  }

  // 解析播放源
  const sources: ParsedSource[] = []
  const isMovie = type === 'movie'

  if (item.vod_play_url && item.vod_play_from) {
    // 多线路：vod_play_from="线路1$线路2"，vod_play_url="url1#url2$url3#url4"
    const fromNames = item.vod_play_from.split('$').map((s) => s.trim())
    const urlGroups = item.vod_play_url.split('$$$')  // 某些站用 $$$ 分隔多线路

    for (let i = 0; i < fromNames.length; i++) {
      const group = urlGroups[i] ?? (i === 0 ? item.vod_play_url : '')
      if (!group) continue
      sources.push(...parsePlayUrl(group, fromNames[i] || `线路${i + 1}`, isMovie))
    }
  } else if (item.vod_play_url) {
    // 单线路
    const sourceName = item.vod_play_from?.split('$')[0]?.trim() || '线路1'
    sources.push(...parsePlayUrl(item.vod_play_url, sourceName, isMovie))
  }

  return { video, sources }
}

// ── XML 解析 ──────────────────────────────────────────────────────

/**
 * 从苹果CMS XML 响应中提取 vod 列表。
 * XML 结构：<rss><list><video>...</video></list></rss>
 * 使用正则解析，不引入 DOM parser（Node.js 环境）
 */
export function parseXmlResponse(xml: string): RawVodItem[] {
  const items: RawVodItem[] = []

  // 提取所有 <video> 块
  const videoPattern = /<video>([\s\S]*?)<\/video>/g
  let match: RegExpExecArray | null

  while ((match = videoPattern.exec(xml)) !== null) {
    const block = match[1]
    const item: RawVodItem = {
      vod_id: extractXmlValue(block, 'vod_id') ?? '',
      vod_name: extractXmlValue(block, 'vod_name') ?? '',
      vod_en: extractXmlValue(block, 'vod_en') ?? undefined,
      vod_pic: extractXmlValue(block, 'vod_pic') ?? undefined,
      type_name: extractXmlValue(block, 'type_name') ?? undefined,
      vod_year: extractXmlValue(block, 'vod_year') ?? undefined,
      vod_area: extractXmlValue(block, 'vod_area') ?? undefined,
      vod_actor: extractXmlValue(block, 'vod_actor') ?? undefined,
      vod_director: extractXmlValue(block, 'vod_director') ?? undefined,
      vod_writer: extractXmlValue(block, 'vod_writer') ?? undefined,
      vod_content: extractXmlValue(block, 'vod_content') ?? undefined,
      vod_remarks: extractXmlValue(block, 'vod_remarks') ?? undefined,
      vod_play_from: extractXmlValue(block, 'vod_play_from') ?? undefined,
      vod_play_url: extractXmlCdata(block, 'vod_play_url')
        ?? extractXmlTag(block, 'vod_play_url')
        ?? undefined,
    }
    if (item.vod_id && item.vod_name) {
      items.push(item)
    }
  }

  return items
}

/** 提取 XML 标签值，优先 CDATA，回退到纯文本 */
function extractXmlValue(block: string, tag: string): string | null {
  return extractXmlCdata(block, tag) ?? extractXmlTag(block, tag)
}

function extractXmlTag(block: string, tag: string): string | null {
  const m = block.match(new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, 'i'))
  return m ? decodeXmlEntities(m[1].trim()) : null
}

function extractXmlCdata(block: string, tag: string): string | null {
  const m = block.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>`, 'i'))
  return m ? m[1].trim() : null
}

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
}

// ── JSON 解析 ─────────────────────────────────────────────────────

interface ApiJsonResponse {
  code?: number
  list?: RawVodItem[]
  data?: RawVodItem[]
}

/** 从苹果CMS JSON 响应中提取 vod 列表 */
export function parseJsonResponse(json: string): RawVodItem[] {
  try {
    const data = JSON.parse(json) as ApiJsonResponse
    return (data.list ?? data.data ?? []).filter(
      (item): item is RawVodItem => Boolean(item.vod_id && item.vod_name)
    )
  } catch {
    return []
  }
}
