/**
 * line-matrix.ts — PLAYER-LINE-BOUND-EP（线路优先模型）
 *
 * 把视频"全集源"（VideoSource[]，后端已按 (hostTripped, effectiveScore DESC, created_at) 排序）
 * 派生为"线路优先"矩阵：每条稳定线路含其各集源。纯函数，无副作用。
 *
 * 设计依据（arch-reviewer claude-opus-4-8 CONDITIONAL → 红线/黄线吸收）：
 *  - 红线 2：分组键统一走 buildLineKey（line-display-name 唯一真源 / 与 matchActiveSourceIndex 复合口径一致）。
 *  - 黄线 2：线路顺序 = 输入中各 key **首次出现**序（复用后端权威评分，不引入新聚合启发式）。
 *  - 黄线 3：representative（喂 SourceBar 主题标签的代表源）取该线路 **effectiveScore 最高的集源**，
 *    避免"首集 dead 但其余健康"被整条线路误判 dead；多音轨语言后缀在 per-line 代表集合上判定。
 */

import type { VideoSource } from '@resovo/types'
import {
  buildLineKey,
  buildThemedSources,
  type RawSourceForTheme,
  type ThemedSource,
  type RouteTheme,
} from './line-display-name'

export interface VideoLine {
  readonly key: string
  readonly sourceName: string
  readonly siteDisplayName: string | null
  /** 升序去重的集号列表（该线路实际提供的集） */
  readonly episodeNumbers: number[]
  /** 集号 → 该集最优源（同线路同集去重保 effectiveScore 最高） */
  readonly episodes: Map<number, VideoSource>
  /** 该线路 effectiveScore 最高的集源（黄线 3：SourceBar dead/pending/语言/画质口径，非首集） */
  readonly representative: VideoSource
}

/** episodeNumber 归一：null（电影）视为第 1 集 */
function epOf(s: VideoSource): number {
  return s.episodeNumber ?? 1
}

function scoreOf(s: VideoSource): number {
  return s.effectiveScore ?? 0
}

/**
 * 构建线路矩阵：O(n) 单遍分组（黄线 1）。
 * 同线路同集去重保 effectiveScore 最高（其次保先出现者，稳定）。
 */
export function buildLineMatrix(sources: readonly VideoSource[]): VideoLine[] {
  interface Acc {
    key: string
    sourceName: string
    siteDisplayName: string | null
    order: number
    episodes: Map<number, VideoSource>
    representative: VideoSource
  }
  const map = new Map<string, Acc>()
  let order = 0
  for (const s of sources) {
    const key = buildLineKey(s)
    const ep = epOf(s)
    let acc = map.get(key)
    if (!acc) {
      acc = {
        key,
        sourceName: s.sourceName,
        siteDisplayName: s.siteDisplayName,
        order: order++,
        episodes: new Map(),
        representative: s,
      }
      map.set(key, acc)
    }
    const existing = acc.episodes.get(ep)
    if (!existing || scoreOf(s) > scoreOf(existing)) {
      acc.episodes.set(ep, s)
    }
    if (scoreOf(s) > scoreOf(acc.representative)) {
      acc.representative = s
    }
  }
  return [...map.values()]
    .sort((a, b) => a.order - b.order)
    .map((acc) => ({
      key: acc.key,
      sourceName: acc.sourceName,
      siteDisplayName: acc.siteDisplayName,
      episodeNumbers: [...acc.episodes.keys()].sort((x, y) => x - y),
      episodes: acc.episodes,
      representative: acc.representative,
    }))
}

/**
 * 把线路矩阵派生为 SourceBar 用 ThemedSource[]（与 lines[] 同序同长）。
 * 复用 buildThemedSources：每线路喂其 representative 源 → 主题标签 / dead / pending /
 * ADR-199 多音轨语言后缀（hasMultipleAudioLanguages 在 per-line 代表集合上判定）。
 *
 * 注：ThemedSource.src 为代表集 URL，SourceBar 不消费 src（仅 label/quality/isDead/isPending）；
 * 实际播放源由 PlayerShell 按 activeLine.episodes.get(currentEpisode) 取。
 */
export function buildThemedLines(
  lines: readonly VideoLine[],
  theme: RouteTheme,
): ThemedSource[] {
  const raw: RawSourceForTheme[] = lines.map((l) => ({
    sourceUrl: l.representative.sourceUrl,
    type: l.representative.type,
    sourceName: l.sourceName,
    siteDisplayName: l.siteDisplayName,
    quality: l.representative.quality,
    effectiveScore: l.representative.effectiveScore,
    audioLanguage: l.representative.audioLanguage ?? null,
  }))
  return buildThemedSources(raw, theme)
}
