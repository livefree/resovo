/**
 * textMatch.ts — 通用文本/年份相似度工具（跨 provider 富集匹配复用）
 *
 * 从 DoubanService.utils.ts 下沉（META-47）：三者均为通用字符串/年份算法，非 douban 特化。
 * 现有消费方：DoubanService.utils（candidateScore）/ TmdbConfirmService（tmdbCandidateScore，META-47）。
 * 放中立 lib 层避免「tmdb 富集 → DoubanService.utils」坏依赖方向，且不重复实现同款相似度。
 */

/** 简易 Jaccard 字符二元组相似度（0–1；完全相等返 1，空串返 0）。 */
export function similarity(a: string, b: string): number {
  if (!a || !b) return 0
  const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, '')
  const na = normalize(a)
  const nb = normalize(b)
  if (na === nb) return 1

  const bigrams = (s: string) => {
    const set = new Set<string>()
    for (let i = 0; i < s.length - 1; i++) set.add(s.slice(i, i + 2))
    return set
  }
  const sa = bigrams(na)
  const sb = bigrams(nb)
  let intersection = 0
  for (const g of sa) if (sb.has(g)) intersection++
  return (2 * intersection) / (sa.size + sb.size)
}

/** 归一化用于匹配：小写 + 去括号内容 + 仅保留字母数字（剔标点/空白/符号）。 */
export function normalizeForMatch(input: string): string {
  return input
    .toLowerCase()
    .replace(/[（(][^）)]*[）)]/g, '')
    .replace(/[^\p{L}\p{N}]/gu, '')
}

/** 从任意值抽取首个 4 位年份（无则 null）。 */
export function parseYear(value: string | number | null | undefined): number | null {
  if (value == null) return null
  const match = String(value).match(/\d{4}/)
  if (!match) return null
  const year = Number.parseInt(match[0], 10)
  return Number.isFinite(year) ? year : null
}
