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
  fallbackIndex: number
  quality?: string | null
}): string {
  const provider = normalizeProviderName(input.rawName)
  const base = provider ?? `线路${toAlphaIndex(parseLineOrdinal(input.rawName?.trim() ?? '') ?? input.fallbackIndex)}`
  const quality = input.quality?.trim()
  if (quality) return `${base} · ${quality}`
  return base
}

