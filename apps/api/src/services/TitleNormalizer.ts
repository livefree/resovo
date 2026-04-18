/**
 * TitleNormalizer.ts — 视频标题标准化服务
 * CHG-38: 规则 B — 去 HTML / 装饰括号 / 年份 / 季数词 / 画质标签，Unicode 小写
 * 用途：生成用于视频归并去重的 title_normalized 字段
 */

// ── 画质 / 版本标签 ───────────────────────────────────────────────

/** 需要从标题中剥离的画质与版本标签（大小写不敏感匹配） */
const QUALITY_TAGS = [
  '4k', 'uhd', '2160p',
  '1080p', '1080i',
  '720p', '720i',
  '480p', '360p',
  'hdr', 'hdr10', 'hdr10+', 'dolby vision', 'dv',
  'bluray', 'blu-ray', 'bdrip',
  'webrip', 'web-dl', 'webdl', 'web',
  'remux', 'dvdrip', 'dvd', 'ts',
  'hd', 'fhd', 'sd',
  'hevc', 'x265', 'h265', 'x264', 'h264',
  'aac', 'dd5.1', 'atmos',
  '国语', '粤语', '英语',
  '中字', '中英字幕', '无字幕', '字幕',
  '国配', '国配版',
  '正片', '完整版', '精编版', '加长版',
]

// ── 季数 / 集数关键词 ────────────────────────────────────────────

const SEASON_PATTERNS = [
  // 中文：第X季、第一季、第二季 … 第十季、第十一季 …
  /第[一二三四五六七八九十百千\d]+季/g,
  // 英文：Season 1, S1, S01, S1E01
  /\bseasons?\s*\d+/gi,
  /\bs\d{1,2}(?:e\d{1,2})?\b/gi,
  // Part/Vol
  /\bpart\s*\d+/gi,
  /\bvol\.?\s*\d+/gi,
]

// ── 年份模式 ─────────────────────────────────────────────────────

/** 括号包裹的四位年份：(2024)、（2024）、[2024]、【2024】 */
const YEAR_IN_BRACKET = /[(\[（【]\s*(?:19|20)\d{2}\s*[)\]）】]/g

// ── 括号装饰内容 ─────────────────────────────────────────────────

/** 去除全角/半角括号及其内容（包含画质/状态/平台等装饰信息） */
const FULL_BRACKET_CONTENT = /[（(【\[][^）)\]】]{0,30}[）)\]】]/g

// ── 主要清理逻辑 ──────────────────────────────────────────────────

/**
 * 标准化视频标题，返回用于归并去重的字符串。
 *
 * 处理步骤：
 * 1. 剥离 HTML 标签
 * 2. 去除括号包裹的年份
 * 3. 去除季数词
 * 4. 去除全角/半角括号及其内容（装饰性标签）
 * 5. 去除独立画质标签词
 * 6. 折叠空白、去首尾空格
 * 7. Unicode 小写
 */
export function normalizeTitle(title: string): string {
  let s = title

  // 1. 剥离 HTML 标签（<br>、<b>、&nbsp; 等）
  s = s.replace(/<[^>]*>/g, ' ')
  s = s.replace(/&[a-z]+;/gi, ' ')

  // 2. 去除括号包裹的年份
  s = s.replace(YEAR_IN_BRACKET, ' ')

  // 3. 去除季数词
  for (const pattern of SEASON_PATTERNS) {
    s = s.replace(pattern, ' ')
  }

  // 4. 去除全角/半角括号及其内容（剩余装饰信息）
  s = s.replace(FULL_BRACKET_CONTENT, ' ')

  // 5. 去除独立画质/版本标签（词边界或紧贴中文字符时匹配）
  for (const tag of QUALITY_TAGS) {
    // 使用大小写不敏感匹配，允许紧贴非字母字符（含中文）
    const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    s = s.replace(new RegExp(`(?<![\\w\\u4e00-\\u9fff])${escaped}(?![\\w\\u4e00-\\u9fff])`, 'gi'), ' ')
  }

  // 6. 折叠多余空白、去首尾
  s = s.replace(/\s+/g, ' ').trim()

  // 7. Unicode 小写（处理英文标题）
  s = s.toLowerCase()

  return s
}

/**
 * 计算归并匹配键（match_key）
 * 规则 A: 只有 (title_normalized, year, type) 三元组完全相同才合并
 *
 * @param title   原始标题
 * @param year    年份（null 也参与匹配）
 * @param type    视频类型（movie / series / anime / variety）
 */
export function buildMatchKey(
  title: string,
  year: number | null,
  type: string
): string {
  const normalized = normalizeTitle(title)
  return `${normalized}|${year ?? ''}|${type}`
}
