/**
 * line-matrix.ts — 线路优先矩阵契约 + 分组纯逻辑（跨端唯一真源）
 *
 * PLAYER-12-A / SEQ-20260630-01（arch-reviewer claude-opus-4-8 CONDITIONAL PASS）：
 * 把「全集源」（VideoSource[]，后端按 (hostTripped 后置, effectiveScore DESC, created_at ASC)
 * 排序）在**服务端**聚合为精简「线路优先」矩阵——每线携带主题标签所需的投影 representative
 * + 当前聚焦集的完整可播放源 focusEpisodeSource + 集号列表，避免把 ~9MB 全集源经 RSC 下发。
 *
 * 沉淀落点（HIGH-1 方案 A）：分组键 buildLineKey + 聚合 groupSourcesIntoLineMatrix 落 @resovo/types，
 * apps/api（Service 聚合）与 apps/web-next（原 line-matrix / MiniPlayer 消费）双端共用唯一真源。
 *
 * 红线（arch-reviewer）：
 *  - BLOCKER-1：矩阵内联 focusEpisode + 每线 focusEpisodeSource（当前集源），非仅 representative。
 *  - BLOCKER-2：聚合走 JS reduce（复用后端权威排序 + effectiveScore/hostTripped），禁 SQL GROUP BY。
 *  - D1-b 新红线：representative（投影 LineRepresentative，**不可播放**，仅喂 SourceBar 主题标签）
 *    与 focusEpisodeSource（完整 VideoSource，**可播放**）类型级区分，防 -B/-C 误用 representative
 *    做播放源（重蹈「用最高分集误判当前集健康」覆辙）。
 */

import type { VideoSource } from './video.types'

/**
 * 线路稳定分组键（PLAYER-LINE-BOUND-EP / 跨端唯一真源）。
 *
 * 口径与 web-next matchActiveSourceIndex 复合匹配（优先级 1）一致：siteDisplayName 非空 →
 * 复合 `(siteDisplayName, sourceName)`；为 null/空 → 降级 sourceName 单键（兼容历史
 * siteDisplayName=null / 未配置 display_name）。用 U+0000 作分隔符（业务文案不会出现），
 * 避免 "site"+"name" 与 "sitename" 串台。VideoSource 不暴露 source_site_key，故以
 * siteDisplayName 为站点维度（前台唯一可用站点标识）。
 */
export function buildLineKey(source: {
  readonly siteDisplayName?: string | null
  readonly sourceName: string
}): string {
  const site = source.siteDisplayName?.trim()
  return site ? `${site}\u0000${source.sourceName}` : source.sourceName
}

/**
 * LineRepresentative — 线路代表源的**纯 label/health 投影**（D1-b + Codex 对抗审 MEDIUM /
 * arch-reviewer REVISE：**结构上不可播放**）。仅喂 SourceBar 主题标签 / dead / pending / 语言 /
 * 画质口径——label 派生只需 name/quality/effectiveScore/audioLanguage（siteDisplayName 供分组展示）。
 *
 * **刻意剔除 sourceUrl + type**（可播放定位的最小充分集）：TS 是结构化的，若携带这两字段，
 * 下游「只需 URL+type」代码即可误播 representative（错集，focusEpisodeSource 才是当前集可播放源）。
 * 移除后类型即文档地保证「representative 不可播放」，堵死 -B/-C 误用面。
 *
 * -B/-C 消费方约束：既有 buildThemedLines 从 representative 建 RawSourceForTheme 需 sourceUrl/type，
 * 但 label 层实际不消费（line-matrix.ts:99「SourceBar 不消费 src」）——迁移时应把
 * RawSourceForTheme.sourceUrl/type 降为可选，而非给 representative 加回字段（-B/-C 卡范围）。
 */
export interface LineRepresentative {
  readonly sourceName: string
  readonly siteDisplayName: string | null
  readonly quality: string | null
  readonly effectiveScore?: number
  readonly audioLanguage?: string | null
  /** representative 取自哪一集（诊断 / 健康判定溯源；representative=该线路最高分集源） */
  readonly episodeNumber: number | null
}

/** 单条线路（首现序中的一项） */
export interface VideoLineEntry {
  readonly key: string
  readonly sourceName: string
  readonly siteDisplayName: string | null
  /** 该线路实际提供的集号，升序去重 */
  readonly episodeNumbers: number[]
  /** 主题标签口径的投影代表源（最高分集源，不可播放，D1-b） */
  readonly representative: LineRepresentative
  /** focusEpisode 该线路的完整可播放源；线路缺该集 → null（BLOCKER-1） */
  readonly focusEpisodeSource: VideoSource | null
}

/** 线路优先矩阵 DTO（GET /videos/:id/sources?view=matrix 响应体，JSON 可序列化 / 无 Map） */
export interface VideoLineMatrix {
  /** 聚焦集（入参回显；矩阵 focusEpisodeSource 切片以此集为准） */
  readonly focusEpisode: number
  /** 全线路集号并集，升序去重（驱动剧集选择器） */
  readonly episodeNumbers: number[]
  /** 线路列表，首现序（复用后端权威排序中各 key 首次出现序） */
  readonly lines: VideoLineEntry[]
}

/** episodeNumber 归一：null（电影）视为第 1 集（与 web-next line-matrix epOf 同口径） */
function epOf(source: VideoSource): number {
  return source.episodeNumber ?? 1
}

function scoreOf(source: { effectiveScore?: number }): number {
  return source.effectiveScore ?? 0
}

function toRepresentative(source: VideoSource): LineRepresentative {
  // Codex MEDIUM / arch-reviewer REVISE：不投影 sourceUrl/type（可播放定位字段），representative 纯 label/health
  return {
    sourceName: source.sourceName,
    siteDisplayName: source.siteDisplayName,
    quality: source.quality,
    effectiveScore: source.effectiveScore,
    audioLanguage: source.audioLanguage ?? null,
    episodeNumber: source.episodeNumber,
  }
}

/**
 * 把「全集源」聚合为线路优先矩阵：O(n) 单遍分组（BLOCKER-2：JS reduce，禁 SQL GROUP BY）。
 *
 * - 线路顺序 = 输入中各 key **首次出现**序（复用后端权威评分排序，不引入新聚合启发式）。
 * - representative = 该线路 effectiveScore **最高**集源（同分保先出现者，稳定）——避免「首集 dead
 *   但其余健康」被整条线路误判 dead；喂 SourceBar 主题标签 / 语言后缀。
 * - focusEpisodeSource = focusEpisode 对应集源（同线路同集去重保最高分，稳定）；线路缺该集 → null。
 * - episodeNumbers（per-line）= 该线路各集号升序去重；顶层 episodeNumbers = 全线路并集升序去重。
 *
 * 越界 focusEpisode（无任何线路提供该集）→ 骨架仍在（各线 focusEpisodeSource=null），非 error。
 * 空输入 → { focusEpisode, episodeNumbers: [], lines: [] }（消费方须防御空矩阵）。
 *
 * @param sources 后端已排序的全集源（listSources(shortId, undefined) 结果）
 * @param focusEpisode 聚焦集号（≥1）
 */
export function groupSourcesIntoLineMatrix(
  sources: readonly VideoSource[],
  focusEpisode: number,
): VideoLineMatrix {
  interface Acc {
    key: string
    sourceName: string
    siteDisplayName: string | null
    order: number
    episodes: Set<number>
    representative: VideoSource
    focusEpisodeSource: VideoSource | null
  }
  const map = new Map<string, Acc>()
  const allEpisodes = new Set<number>()
  let order = 0

  for (const source of sources) {
    const key = buildLineKey(source)
    const ep = epOf(source)
    allEpisodes.add(ep)

    let acc = map.get(key)
    if (!acc) {
      acc = {
        key,
        sourceName: source.sourceName,
        siteDisplayName: source.siteDisplayName,
        order: order++,
        episodes: new Set(),
        representative: source,
        focusEpisodeSource: null,
      }
      map.set(key, acc)
    }

    acc.episodes.add(ep)
    if (scoreOf(source) > scoreOf(acc.representative)) {
      acc.representative = source
    }
    if (ep === focusEpisode) {
      if (!acc.focusEpisodeSource || scoreOf(source) > scoreOf(acc.focusEpisodeSource)) {
        acc.focusEpisodeSource = source
      }
    }
  }

  const lines: VideoLineEntry[] = [...map.values()]
    .sort((a, b) => a.order - b.order)
    .map((acc) => ({
      key: acc.key,
      sourceName: acc.sourceName,
      siteDisplayName: acc.siteDisplayName,
      episodeNumbers: [...acc.episodes].sort((x, y) => x - y),
      representative: toRepresentative(acc.representative),
      focusEpisodeSource: acc.focusEpisodeSource,
    }))

  return {
    focusEpisode,
    episodeNumbers: [...allEpisodes].sort((x, y) => x - y),
    lines,
  }
}
