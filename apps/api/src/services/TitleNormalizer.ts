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

// ── 外部源匹配：标点 / 符号剥离 ───────────────────────────────────

/**
 * 剥离 Unicode 标点（`\p{P}`）与符号（`\p{S}`）—— 顿号、全角感叹/问号、书名号、
 * 中点、星号、音符、ASCII `-`/`:` 等，修复「当前、正被打扰中！」类因标点差异漏配。
 *
 * 刻意**只剥标点/符号**，不用 dump 侧的 `[^\p{L}\p{N}]`（剥全部非字母数字）：
 * - 保留字母数字 —— 含 々(U+3005 / Lm)、〇(U+3007 / Nl)、苏杭数字(Nl)，否则误删
 *   破坏「人々」「佐々木」匹配（META-22 二次修订教训）。
 * - **保留空格/标记，降低有损塌缩面** —— 避免「不同作品塌缩同键 → 高置信误绑外部
 *   记录」（META-22 三次修订，Codex stop-time review）。CJK 标题无空格，剥标点后
 *   与 dump `[^\p{L}\p{N}]` 仍逐字符一致（零召回损失）；含空格标题保持 pre-META-22
 *   行为（安全 under-match，绝不误绑）。歧义命中另由匹配层 isAmbiguousLocalMatch 守卫。
 */
const PUNCT_SYMBOLS = /[\p{P}\p{S}]/gu

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
 *
 * 注意：本函数**保留 CJK 标点**，是 `normalizeMergeKey`（持久化归并键 / ADR-174）与
 * `normalizeForExternalMatch`（外部源匹配键 / META-22）的共享前置步骤，也直接供
 * CrawlerRefetchService 相似度计算（保留标点的分辨力）。**勿改本函数语义**：改它会同时
 * 改掉相似度阈值输入分布（ADR-174 D-174-1 / META-22 曾误改致归并键回归）。
 * 归并键请用 `normalizeMergeKey`，外部匹配请用 `normalizeForExternalMatch`（二者均剥标点）。
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
 * 把已归一化字符串剥离标点/符号为外部源匹配键（META-22）。
 *
 * 输入应为 `normalizeTitle` 的输出或同等已归一字符串（如持久化 `title_normalized`）；
 * 剥 `\p{P}`/`\p{S}` 并折叠残留空白（保留字母数字含 々〇 与词间空格），
 * 用于外部源富集匹配边界，不参与持久化归并键生成。
 */
export function stripExternalMatchPunct(normalized: string): string {
  return normalized.replace(PUNCT_SYMBOLS, '').replace(/\s+/g, ' ').trim()
}

/**
 * 外部源富集匹配专用归一化（META-22）：`normalizeTitle` 全流程 + 标点/符号剥离。
 *
 * 用途：视频标题↔豆瓣/Bangumi dump（`title_normalized` 经 `[^\p{L}\p{N}]` 存储）
 * 及 Bangumi REST 候选名的标点不敏感比较，修复「当前、正被打扰中！」类漏配。
 */
export function normalizeForExternalMatch(rawTitle: string): string {
  return stripExternalMatchPunct(normalizeTitle(rawTitle))
}

/**
 * 持久化归并键归一化（ADR-174 / D-174-1）：`normalizeTitle` 全流程 + 标点/符号剥离。
 *
 * 用途：`media_catalog.title_normalized` 的**唯一**生成入口（CrawlerService /
 * VideoService / VideoMergesService / BangumiSeedService / buildMatchKey 及 catalog
 * 三元组去重查询入参均经本函数），使「当前，正被打扰中！」与「当前正被打扰中」归并为同一作品，
 * 根治同番裂多 catalog 行 → 抢绑同一外部 subject 撞唯一约束（ADR-174 背景）。
 *
 * 与 `normalizeForExternalMatch` 实现等价但**语义分立**：本函数产出持久化归并键，
 * 后者产出外部源匹配运行时键；二者共用 `stripExternalMatchPunct` 私有实现。分立避免
 * 「只想动外部匹配行为却意外改掉持久化键生成规则」的同构回归（META-22 教训）。
 *
 * 不变量（ADR-174 R1）：CJK 标题与 dump 侧 `[^\p{L}\p{N}]` 逐字符一致（零召回损失）；
 * 含空格标题保留词间空格（under-match 安全，不塌缩不同作品误绑）。
 */
export function normalizeMergeKey(rawTitle: string): string {
  return stripExternalMatchPunct(normalizeTitle(rawTitle))
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
  const normalized = normalizeMergeKey(title)
  return `${normalized}|${year ?? ''}|${type}`
}
