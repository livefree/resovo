/**
 * format-play-count.ts — 播放次数展示格式化（ADR-216 STATS-05-A）
 *
 * 3 处展示（VideoCard / DetailHero / PlayerShell）共用 → 提取单一真源（DRY）。
 * ≥1万 → "x.x万"（跟随卡片既有"集"中文风格）；否则原数。0 也正常返回 "0"（无统计行显示 0）。
 */
export function formatPlayCount(n: number): string {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}万`
  return String(n)
}
