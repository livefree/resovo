/**
 * line-display-name.ts — 播放线路显示名归一化
 * 目标：将 subyun / 线路2 等技术名转换为用户可读文案。
 */

const PROVIDER_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /sub[\s_-]*yun|sub云/i, label: 'SUB云' },
  { pattern: /ali[\s_-]*yun|aliyun/i, label: '阿里云' },
  { pattern: /tx[\s_-]*yun|tencent/i, label: '腾讯云' },
  { pattern: /quark/i, label: '夸克云' },
  { pattern: /bili|bilibili/i, label: '哔哩源' },
  // CHG-405: 爬虫源站 key 映射（避免原始 key 暴露给用户）
  { pattern: /bfzy|bfzym3u8|暴风/i, label: '暴风资源' },
  { pattern: /1080zyk|1080p?zy/i, label: '1080P资源' },
  { pattern: /lzzy|量子/i, label: '量子资源' },
  { pattern: /jyzy|金鹰/i, label: '金鹰资源' },
  { pattern: /wolongzy|卧龙/i, label: '卧龙资源' },
  { pattern: /subo|速播/i, label: '速播资源' },
  { pattern: /modu|魔都/i, label: '魔都资源' },
  { pattern: /youzzy|优质/i, label: '优质资源' },
]

const GENERIC_LINE_PATTERN = /^(line|线路|默认线路|备用线路|备用|route|source)\s*([0-9]+)?$/i

function toAlphaIndex(index: number): string {
  let n = Math.max(0, index)
  let output = ''
  do {
    output = String.fromCharCode(65 + (n % 26)) + output
    n = Math.floor(n / 26) - 1
  } while (n >= 0)
  return output
}

function parseLineOrdinal(raw: string): number | null {
  const direct = raw.match(/(?:line|线路|route|备用)\s*([0-9]+)/i)
  if (!direct) return null
  const n = Number.parseInt(direct[1], 10)
  if (!Number.isFinite(n) || n <= 0) return null
  return n - 1
}

export function normalizeProviderName(rawName: string | null | undefined): string | null {
  const raw = rawName?.trim()
  if (!raw) return null

  for (const { pattern, label } of PROVIDER_PATTERNS) {
    if (pattern.test(raw)) return label
  }

  if (GENERIC_LINE_PATTERN.test(raw)) return null
  return raw
}

export function buildLineDisplayName(input: {
  rawName?: string | null
  /** CHG-412: crawler_sites.display_name，优先级高于 normalizeProviderName(rawName) */
  siteDisplayName?: string | null
  fallbackIndex: number
  quality?: string | null
}): string {
  const provider = input.siteDisplayName?.trim()
    ? input.siteDisplayName.trim()
    : normalizeProviderName(input.rawName)
  const base = provider ?? `线路${toAlphaIndex(parseLineOrdinal(input.rawName?.trim() ?? '') ?? input.fallbackIndex)}`
  const quality = input.quality?.trim()
  if (quality) return `${base} · ${quality}`
  return base
}

/**
 * CHG-405: 优先使用 crawler_sites.display_name，
 * 否则 fallback 到 normalizeProviderName(sourceName)，
 * 最终 fallback 为 '未知线路'。
 */
export function resolveSourceDisplayName(
  siteDisplayName: string | null | undefined,
  sourceName: string | null | undefined,
): string {
  if (siteDisplayName?.trim()) return siteDisplayName.trim()
  return normalizeProviderName(sourceName) ?? '未知线路'
}

/**
 * CHG-413: 对 label 重复的项追加 -1/-2 序号，保证每条线路 label 全局唯一。
 * 仅对出现超过一次的 label 编号（唯一的 label 保持原样）。
 */
export function deduplicateLabels<T extends { label: string }>(items: T[]): T[] {
  const counts = new Map<string, number>()
  const seen = new Map<string, number>()
  for (const it of items) counts.set(it.label, (counts.get(it.label) ?? 0) + 1)
  return items.map((it) => {
    if ((counts.get(it.label) ?? 1) <= 1) return it
    const n = (seen.get(it.label) ?? 0) + 1
    seen.set(it.label, n)
    return { ...it, label: `${it.label}-${n}` }
  })
}

