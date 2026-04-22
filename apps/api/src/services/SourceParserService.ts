/**
 * SourceParserService.ts — 苹果CMS接口解析 + 字段映射
 * CRAWLER-02: XML/JSON 解析，字段映射，播放源拆分
 * ADR-008: 苹果CMS标准接口格式
 * ADR-009: cover_url 存外链，不下载
 */

import type { VideoType, VideoGenre, VideoStatus, SourceType, ContentFormat, EpisodePattern } from '@/types'
import { mapSourceCategory } from '@/api/lib/genreMapper'

// ── 接口原始数据类型 ───────────────────────────────────────────────

export interface RawVodItem {
  vod_id: string | number
  vod_name: string
  vod_en?: string
  vod_pic?: string
  type_id?: string | number    // CRAWLER-07: 苹果CMS 类型 ID（站点特定）
  type_name?: string
  vod_class?: string           // CRAWLER-07: 细分类标签（逗号/斜杠/竖线分隔），精度高于 type_name
  vod_year?: string | number
  vod_area?: string
  vod_lang?: string            // CRAWLER-07: 语言（普通话/粤语/日语/英语等）
  vod_actor?: string
  vod_director?: string
  vod_writer?: string
  vod_content?: string
  vod_remarks?: string
  vod_total?: string | number  // CRAWLER-07: 预计总集数（连载类）
  vod_serial?: string | number // CRAWLER-07: 当前已更新到第几集
  vod_version?: string         // CRAWLER-07: 版本（TC/HD/枪版/蓝光等）
  vod_state?: string           // CRAWLER-07: 剧集状态（正片/预告/花絮）
  vod_note?: string            // CRAWLER-07: 备注
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
  genre: VideoGenre | null          // 从 source_category 自动推断（Migration 020）
  contentRating: 'general' | 'adult' // 内容分级（Migration 020）
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
  episodeNumber: number  // 统一坐标系（ADR-016）：单集/电影为 1
  sourceUrl: string      // ADR-001: 第三方直链
  type: SourceType       // 根据 URL 后缀判断
}

// ── 类型映射表（ADR-017）─────────────────────────────────────────

// CRAWLER-07: 扩充覆盖苹果 CMS 常见细分类，以及 vod_class 常见值
const TYPE_MAP: Record<string, VideoType> = {
  // ── 电影 ──
  '电影': 'movie', 'movie': 'movie', 'Movie': 'movie',
  '剧情片': 'movie', '动作片': 'movie', '喜剧片': 'movie', '爱情片': 'movie',
  '科幻片': 'movie', '恐怖片': 'movie', '战争片': 'movie', '悬疑片': 'movie',
  '冒险片': 'movie', '惊悚片': 'movie', '灾难片': 'movie', '犯罪片': 'movie',
  '奇幻片': 'movie', '武侠片': 'movie', '歌舞片': 'movie', '伦理片': 'movie',
  '网络电影': 'movie', '微电影': 'movie',
  // ── 连续剧 / 电视剧 ──
  '电视剧': 'series', '连续剧': 'series', '国产剧': 'series', '剧集': 'series',
  '美剧': 'series', '韩剧': 'series', '日剧': 'series', '港剧': 'series', '台剧': 'series',
  '日韩剧': 'series', '欧美剧': 'series', '海外剧': 'series',
  '国语剧': 'series', '华语剧': 'series', '网络剧': 'series',
  'series': 'series', 'drama': 'series',
  // ── 动漫 ──
  '动漫': 'anime', '卡通': 'anime', '动画': 'anime', 'anime': 'anime',
  '国产动漫': 'anime', '日本动漫': 'anime', '日韩动漫': 'anime',
  '欧美动漫': 'anime', '港台动漫': 'anime', '动画片': 'anime',
  // ── 综艺（含游戏类综艺）──
  '综艺': 'variety', '真人秀': 'variety', '晚会': 'variety', '综艺节目': 'variety',
  '游戏': 'variety', 'game_show': 'variety',
  '大陆综艺': 'variety', '国产综艺': 'variety', '港台综艺': 'variety',
  '日韩综艺': 'variety', '欧美综艺': 'variety', '海外综艺': 'variety',
  // ── 短剧 / 短片 ──
  '短剧': 'short', '微剧': 'short', 'short_drama': 'short', 'short': 'short',
  '国产短剧': 'short', '海外短剧': 'short', '短视频': 'short',
  // ── 体育 ──
  '体育': 'sports', 'sports': 'sports', '足球': 'sports', '篮球': 'sports', '赛事': 'sports',
  // ── 音乐 ──
  '音乐': 'music', 'MV': 'music', 'music': 'music',
  '音乐节目': 'music', '音乐会': 'music',
  // ── 纪录片 ──
  '纪录片': 'documentary', 'documentary': 'documentary', '纪实': 'documentary', '记录': 'documentary',
  // ── 少儿 ──
  '少儿': 'kids', '儿童': 'kids', 'children': 'kids', 'kids': 'kids', '少儿节目': 'kids',
  // ── 新闻 ──
  '新闻': 'news', 'news': 'news', '资讯': 'news',
}

// ── 题材映射表（source_category → VideoGenre）────────────────────
// 仅映射 source_category 中能明确推断题材的类目；
// 大多数类目（短剧/少儿/动漫/综艺等）描述的是内容形式，不映射到 genre。

const GENRE_MAP: Record<string, VideoGenre> = {
  // 爱情 / 都市
  '爽文短剧': 'romance', '女频恋爱': 'romance', '现代都市': 'romance',
  // 犯罪
  '犯罪片': 'crime',
  // 战争
  '战争片': 'war',
  // 悬疑
  '悬疑片': 'mystery', '脑洞悬疑': 'mystery',
  // 动作
  '功夫片': 'action', '武侠片': 'martial_arts',
  // 其他（有明确含义但不在上述具体分类）
  '剧情片': 'other',
}

// ── 成人内容类目列表（source_category → content_rating='adult'）────
// 这些类目的内容设为 visibility_status='hidden'（Migration 021 回填）；
// 未来开辟成人专区时，可通过 content_rating='adult' 查询并切换可见性。

export const ADULT_CATEGORIES = new Set<string>([
  '亚洲情色', '亚洲有码', '日本有码', '日本无码', '无码专区',
  '国产自拍', '国产主播', '国产直播', '国产盗摄', '国产SM',
  '欧美性爱', '欧美精品',
  '中文字幕',
  '门事件', '强奸乱伦', '伦理三级', '倫理片',
  '抖阴视频', '自拍偷拍', '重口调教',
  '性感人妻', '主播视讯', '主播秀色',
  '口爆颜射', '换脸明星', '美乳巨乳', '巨乳美乳',
  '黑丝诱惑', '制服丝袜',
  '素人搭讪', '童颜巨乳', '群交淫乱', '多人群交',
  '大象传媒', '探花系列', '传媒原创',
  '女优系列',
])

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

/** CRAWLER-07: parseType 输入对象，支持 vod_class + type_name + type_id 联合推断 */
export interface ParseTypeInput {
  typeName?: string
  vodClass?: string
  typeId?: string | number
}

function pickFirstClassSegment(vodClass?: string): string | undefined {
  if (!vodClass) return undefined
  return vodClass
    .split(/[,，\/|｜、]/)
    .map((s) => s.trim())
    .filter(Boolean)[0]
}

function matchTypeFromName(name: string | undefined): VideoType | null {
  if (!name) return null
  const hit = TYPE_MAP[name.trim()]
  return hit ?? null
}

/**
 * 解析 VideoType（未匹配返回 'other'，ADR-017 / CRAWLER-07）
 *
 * 支持两种调用形式（向后兼容）：
 *   parseType(typeName)                         // 旧形式：仅 type_name
 *   parseType({ typeName, vodClass, typeId })   // 新形式：优先 vodClass 首项，回落 type_name
 *
 * 匹配优先级：
 *   1. vodClass 首项（细分类，精度最高）
 *   2. type_name（主分类）
 *   未来可基于 type_id 做站点级精确映射（schema 决策，另起任务）
 */
export function parseType(input: string | ParseTypeInput | undefined): VideoType {
  if (input === undefined || input === null) return 'other'
  if (typeof input === 'string') {
    return matchTypeFromName(input) ?? 'other'
  }
  const classFirst = pickFirstClassSegment(input.vodClass)
  const fromClass = matchTypeFromName(classFirst)
  if (fromClass) return fromClass
  return matchTypeFromName(input.typeName) ?? 'other'
}

/**
 * 从 source_category 推断 VideoGenre；无匹配返回 null（等待人工核验）。
 *
 * CRAWLER-08: 主链路切到 `@/api/lib/genreMapper` 的 `mapSourceCategory()`，
 * 其 SOURCE_CATEGORY_MAP 表更完整（覆盖豆瓣对齐后的题材）；
 * 本地 GENRE_MAP 保留仅作为兜底优先级（本地特有项如"爽文短剧"）。
 */
export function parseGenre(sourceCategory: string | null | undefined): VideoGenre | null {
  if (!sourceCategory) return null
  const trimmed = sourceCategory.trim()
  // 先查本地 GENRE_MAP（含本地扩展项）
  const local = GENRE_MAP[trimmed]
  if (local) return local
  // 回落到 genreMapper.mapSourceCategory（对齐豆瓣题材）
  const mapped = mapSourceCategory(trimmed)
  return mapped[0] ?? null
}

/** 从 source_category 判断内容分级；成人内容返回 'adult'，其余返回 'general' */
export function parseContentRating(sourceCategory: string | null | undefined): 'general' | 'adult' {
  if (!sourceCategory) return 'general'
  return ADULT_CATEGORIES.has(sourceCategory.trim()) ? 'adult' : 'general'
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
 * @param isMovie    是否为电影（ADR-016: 电影 episode_number 存 1）
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

    // 从集名提取集数；电影/单集统一为 1（ADR-016）
    const numMatch = epLabel.match(/(\d+)/)
    const episodeNumber = isMovie ? 1 : (numMatch ? parseInt(numMatch[1], 10) : 1)

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
  // CRAWLER-07: 传入 { typeName, vodClass, typeId }，优先 vodClass 首项匹配细分类
  const type = parseType({ typeName, vodClass: item.vod_class, typeId: item.type_id })
  // 保留原始类型字符串；未知类型时 sourceContentType 记录原始值以便溯源
  const sourceContentType = typeName || null
  // 当前 normalizedType 与 type 保持一致；未来可做更细粒度映射
  const normalizedType: string = type

  // CRAWLER-08: source_category 优先取 vod_class（首项），回落 type_name
  //             细分类信息对后续类型矫正 / 题材推断 / 审核辅助更有用
  const classSegments = (item.vod_class ?? '')
    .split(/[,，\/|｜、]/)
    .map((s) => s.trim())
    .filter(Boolean)
  const rawCategory = classSegments[0] ?? (typeName || null)
  const video: ParsedVideo = {
    title: (item.vod_name ?? '').trim(),
    titleEn: item.vod_en?.trim() || null,
    coverUrl: item.vod_pic?.trim() || null,  // ADR-009: 存外链
    type,
    sourceContentType,
    normalizedType,
    category: rawCategory,
    genre: parseGenre(rawCategory),
    contentRating: parseContentRating(rawCategory),
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

// ── 类型判定推断（ADR-017）────────────────────────────────────────

/**
 * 根据 type + episodeCount 推断 ContentFormat
 * - movie 类型或 episodeCount=1 → 'movie'
 * - 否则 → 'episodic'
 */
export function inferContentFormat(
  type: VideoType,
  episodeCount: number
): ContentFormat {
  if (type === 'movie' || episodeCount <= 1) return 'movie'
  return 'episodic'
}

/**
 * 根据 episodeCount + status 推断 EpisodePattern
 * - episodeCount=1 → 'single'
 * - episodeCount>1 + completed → 'multi'
 * - episodeCount>1 + ongoing → 'ongoing'
 * - 其他 → 'unknown'
 */
export function inferEpisodePattern(
  episodeCount: number,
  status: VideoStatus
): EpisodePattern {
  if (episodeCount <= 1) return 'single'
  if (status === 'completed') return 'multi'
  if (status === 'ongoing') return 'ongoing'
  return 'unknown'
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
      type_id: extractXmlValue(block, 'type_id') ?? undefined,
      type_name: extractXmlValue(block, 'type_name') ?? undefined,
      vod_class: extractXmlValue(block, 'vod_class') ?? undefined,
      vod_year: extractXmlValue(block, 'vod_year') ?? undefined,
      vod_area: extractXmlValue(block, 'vod_area') ?? undefined,
      vod_lang: extractXmlValue(block, 'vod_lang') ?? undefined,
      vod_actor: extractXmlValue(block, 'vod_actor') ?? undefined,
      vod_director: extractXmlValue(block, 'vod_director') ?? undefined,
      vod_writer: extractXmlValue(block, 'vod_writer') ?? undefined,
      vod_content: extractXmlValue(block, 'vod_content') ?? undefined,
      vod_remarks: extractXmlValue(block, 'vod_remarks') ?? undefined,
      vod_total: extractXmlValue(block, 'vod_total') ?? undefined,
      vod_serial: extractXmlValue(block, 'vod_serial') ?? undefined,
      vod_version: extractXmlValue(block, 'vod_version') ?? undefined,
      vod_state: extractXmlValue(block, 'vod_state') ?? undefined,
      vod_note: extractXmlValue(block, 'vod_note') ?? undefined,
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
