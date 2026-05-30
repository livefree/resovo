/**
 * BangumiService.ts — Bangumi 匹配 + 元数据丰富业务编排（ADR-161）
 *
 * 职责：本地 dump 召回 → 置信度评分 → 写 video_external_refs → auto 命中拉 REST 详情 + 逐集
 *       → safeUpdate(catalog, 'bangumi') + upsert catalog_episodes + 回填 videos.episode_count
 * 不含 HTTP 细节（在 lib/bangumi.ts）；不直连 SQL（经 db/queries）。
 */

import type { Pool, PoolClient } from 'pg'
import type { BangumiCandidate, BangumiStatus } from '@/types'
import { MediaCatalogService } from './MediaCatalogService'
import type { CatalogUpdateData } from './MediaCatalogService'
import * as externalDataQueries from '@/api/db/queries/externalData'
import type { BangumiEntryMatch } from '@/api/db/queries/externalData'
import * as catalogEpisodeQueries from '@/api/db/queries/catalogEpisodes'
import type { CatalogEpisodeInput } from '@/api/db/queries/catalogEpisodes'
import * as videosQueries from '@/api/db/queries/videos'
import { getSubject, getEpisodes, searchSubjects, isBangumiApiConfigured } from '@/api/lib/bangumi'
import { normalizeTitle } from './TitleNormalizer'
import {
  computeLocalBangumiConfidence,
  mapSubjectToCatalogFields,
  mapEpisodes,
} from './BangumiService.utils'

function parseYear(date: string | null | undefined): number | null {
  if (!date) return null
  const m = date.match(/^(\d{4})/)
  return m ? Number.parseInt(m[1], 10) : null
}

// ── 阈值（复用豆瓣范式）───────────────────────────────────────────
const CONFIDENCE_AUTO_MATCH = 0.85
const CONFIDENCE_CANDIDATE = 0.6

// ── 结果类型 ───────────────────────────────────────────────────────
export type BangumiEnrichResult =
  | { matched: 'auto'; bangumiSubjectId: number; confidence: number; episodes: number; degraded: boolean }
  | { matched: 'candidate'; bangumiSubjectId: number; confidence: number }
  | { matched: 'none'; reason: 'no_local_match' | 'low_confidence' }

export interface MatchAndEnrichInput {
  videoId: string
  catalogId: string
  titleNorm: string
  year: number | null
}

// gather/apply 两段拆分（Codex stop-time review FIX）：REST 收集在 Phase 1（无 DB 锁），
// catalog/episodes/episode_count + ref 写入在 Phase 2（事务内）。
interface EnrichmentData {
  fields: CatalogUpdateData | null
  episodes: CatalogEpisodeInput[]
  mainEpisodeCount: number
  degraded: boolean
}

export class BangumiService {
  private catalogService: MediaCatalogService

  /** catalogService 可注入复用（MetadataEnrichService 传入自身实例，避免重复构造） */
  constructor(private db: Pool, catalogService?: MediaCatalogService) {
    this.catalogService = catalogService ?? new MediaCatalogService(db)
  }

  /**
   * 对单视频做 Bangumi 匹配 + 丰富（供 MetadataEnrichService.step3 与后台手动调用）。
   * 仅本地 dump 召回；auto 命中后按需拉 REST 详情（Token 缺失/失败则降级用本地 dump 字段）。
   */
  async matchAndEnrich({ videoId, catalogId, titleNorm, year }: MatchAndEnrichInput): Promise<BangumiEnrichResult> {
    // ADR-170 D-170-4：状态投影下沉本方法，统一覆盖 step3 自动流 / bangumi-sync 直调 / 改类型→anime 三路径。
    const matches = await externalDataQueries.findBangumiByTitleNorm(this.db, titleNorm, year)
    if (matches.length === 0) {
      await this.writeBangumiStatus(videoId, 'unmatched')
      return { matched: 'none', reason: 'no_local_match' }
    }

    const best = matches[0]
    const { confidence, breakdown } = computeLocalBangumiConfidence(best, year)
    if (confidence < CONFIDENCE_CANDIDATE) {
      await this.writeBangumiStatus(videoId, 'unmatched')
      return { matched: 'none', reason: 'low_confidence' }
    }

    const status = confidence >= CONFIDENCE_AUTO_MATCH ? 'auto_matched' : 'candidate'

    if (status === 'candidate') {
      // candidate：仅记 ref（无 catalog 写入 → 无脏态风险，沿用 best-effort writeRef）
      await this.writeRef(videoId, best.bangumiId, 'candidate', confidence, breakdown)
      // 无事务（无 catalog 写）→ Pool 写 status（best-effort，记录不静默吞 / ADR-170 D-170-4）
      await this.writeBangumiStatus(videoId, 'candidate')
      return { matched: 'candidate', bangumiSubjectId: best.bangumiId, confidence }
    }

    // auto_matched：Phase 1 REST（无 DB 锁）→ Phase 2 catalog/episodes/episode_count + ref
    // 原子事务（与 confirmMatch 同构 / Codex stop-time review：防 catalog 写失败遗留
    // 已提交的 auto_matched/primary ref 脏态）。REST 已在 gatherEnrichmentData 完成，事务内无网络等待；
    // job 失败时整体 ROLLBACK，由上层 enrichmentQueue 重试（幂等收敛，但不留孤儿 ref）。
    const data = await this.gatherEnrichmentData(best.bangumiId, best)
    const episodesWritten = await this.applyAutoMatchAtomic(
      videoId, catalogId, best.bangumiId, confidence, breakdown, data,
    )
    return {
      matched: 'auto',
      bangumiSubjectId: best.bangumiId,
      confidence,
      episodes: episodesWritten,
      degraded: data.degraded,
    }
  }

  /**
   * 后台人工确认：按显式 bangumiId 走 rich 抓取写 catalog（bangumi 源，不锁字段，ADR-161 Y2）。
   * 即使该 subject 不在本地 dump，也用 bangumiId 调 REST 详情；确实没写入任何内容时返回 updated:false，
   * 并且只有写入成功才记 manual_confirmed ref（避免对不存在 subject 的"假成功"，ADR-161 P1 修订）。
   *
   * 原子性（Codex stop-time review FIX）：
   * - Phase 1 (REST, no DB lock)：gatherEnrichmentData → 拉 REST 详情/逐集，与 dump 降级合并字段
   * - Phase 2 (DB tx)：BEGIN → applyEnrichmentDb（catalog+episodes+episode_count）→ ref(manual_confirmed) → COMMIT
   *   任一失败 ROLLBACK；DB 不会留下"catalog 已带 bangumi 数据但 ref 仍是 auto_matched/不存在"的脏态。
   * REST 全程在事务外，不会持事务空闲等网络（Codex FIX-1：避免 idle-in-transaction 占满 pool）。
   */
  async confirmMatch(videoId: string, catalogId: string, bangumiId: number): Promise<{ updated: boolean }> {
    const entry = await externalDataQueries.findBangumiById(this.db, bangumiId)
    // Phase 1：REST 在事务外，避免长持锁
    const data = await this.gatherEnrichmentData(bangumiId, entry)
    if (!data.fields) return { updated: false }

    // Phase 2：DB 写入原子事务
    const client = await this.db.connect()
    try {
      await client.query('BEGIN')
      const result = await this.applyEnrichmentDb(client, videoId, catalogId, bangumiId, data)
      if (!result.wrote) {
        await client.query('ROLLBACK')
        return { updated: false }
      }
      await externalDataQueries.upsertVideoExternalRef(client, {
        videoId,
        provider: 'bangumi',
        externalId: String(bangumiId),
        matchStatus: 'manual_confirmed',
        matchMethod: 'manual',
        confidence: 1,
        isPrimary: true,
        linkedBy: 'moderator',
      })
      // ADR-170 D-170-4：手动确认 → matched（与 catalog+ref 同事务）
      await videosQueries.updateVideoBangumiStatus(client, videoId, 'matched')
      await client.query('COMMIT')
      return { updated: true }
    } catch (err) {
      try { await client.query('ROLLBACK') } catch { /* connection may already be lost */ }
      throw err
    } finally {
      client.release()
    }
  }

  /**
   * 后台人工候选搜索（ADR-161 端点 2）。
   * 本地 dump 召回（有置信度，毫秒级）为主；keyword 显式搜索时 REST 兜底（confidence=0 标识非本地召回）。
   */
  async searchCandidates(input: {
    titleNorm: string
    year: number | null
    keyword?: string
  }): Promise<BangumiCandidate[]> {
    const out = new Map<number, BangumiCandidate>()

    const localNorm = input.keyword ? normalizeTitle(input.keyword) : input.titleNorm
    const locals = await externalDataQueries.findBangumiByTitleNorm(this.db, localNorm, input.year)
    for (const e of locals) {
      const { confidence } = computeLocalBangumiConfidence(e, input.year)
      out.set(e.bangumiId, {
        bangumiSubjectId: e.bangumiId,
        nameCn: e.titleCn,
        nameJp: e.titleJp,
        year: e.year,
        rating: e.rating,
        coverUrl: e.coverUrl,
        confidence,
      })
    }

    if (input.keyword && isBangumiApiConfigured()) {
      const items = await searchSubjects(input.keyword)
      for (const it of items) {
        if (out.has(it.id)) continue
        out.set(it.id, {
          bangumiSubjectId: it.id,
          nameCn: it.name_cn?.trim() || null,
          nameJp: it.name?.trim() || null,
          year: parseYear(it.date),
          rating: it.rating?.score ?? null,
          coverUrl: it.images?.large ?? it.images?.common ?? null,
          confidence: 0,
        })
      }
    }

    return [...out.values()].sort((a, b) => b.confidence - a.confidence)
  }

  // ── 内部 ─────────────────────────────────────────────────────────

  /**
   * Phase 1（无 DB 写入）：纯 REST + dump 字段聚合。
   * 优先按 bangumiId 调 REST rich 详情；Token 缺失/抓取失败时降级用本地 dump entry
   * （entry 为 null 则无可写内容）。供 confirmMatch 在 BEGIN 前调用，避免事务空闲等网络。
   */
  private async gatherEnrichmentData(
    bangumiId: number,
    entry: BangumiEntryMatch | null,
  ): Promise<EnrichmentData> {
    let fields: CatalogUpdateData | null = null
    let episodes: CatalogEpisodeInput[] = []
    let mainEpisodeCount = 0
    let degraded = true

    if (isBangumiApiConfigured()) {
      const subject = await getSubject(bangumiId)
      if (subject) {
        fields = mapSubjectToCatalogFields(subject)
        degraded = false
        const eps = await getEpisodes(bangumiId)
        if (eps.length > 0) episodes = mapEpisodes(eps)
        // 本篇集数（ADR-161 P1）：优先 wiki eps（本篇数）；否则数 type===0 本篇；
        // 不用 total_episodes（含 SP/OP/ED 章节，会高估用户侧剧集数）
        mainEpisodeCount = subject.eps && subject.eps > 0
          ? subject.eps
          : eps.filter((e) => e.type === 0).length
      }
    }

    // 降级：用本地 dump entry 拼最小字段集（entry 为 null 时无可写内容）
    if (!fields && entry) {
      fields = { bangumiSubjectId: entry.bangumiId }
      const title = entry.titleCn || entry.titleJp
      if (title) fields.title = title
      if (entry.titleJp) fields.titleOriginal = entry.titleJp
      if (entry.summary) fields.description = entry.summary
      if (entry.rating !== null) fields.rating = entry.rating
      if (entry.coverUrl) fields.coverUrl = entry.coverUrl
    }

    return { fields, episodes, mainEpisodeCount, degraded }
  }

  /**
   * Phase 2（纯 DB 写入）：把 gatherEnrichmentData 收集的字段写到 catalog + 逐集 + 集数回填。
   * - 传 PoolClient：所有写入复用该连接（confirmMatch 原子事务场景）
   * - 传 Pool：每个 query 各自管连接（matchAndEnrich 后台 job，eventually consistent + idempotent）
   * 返回逐集写入数与是否实际写入 catalog。
   */
  private async applyEnrichmentDb(
    db: Pool | PoolClient,
    videoId: string,
    catalogId: string,
    bangumiId: number,
    data: EnrichmentData,
  ): Promise<{ episodes: number; wrote: boolean }> {
    if (!data.fields) return { episodes: 0, wrote: false }

    const episodesWritten = data.episodes.length > 0
      ? await catalogEpisodeQueries.upsertCatalogEpisodes(db, catalogId, data.episodes)
      : 0

    if (data.mainEpisodeCount > 0) {
      await videosQueries.updateEpisodeCount(db, videoId, data.mainEpisodeCount)
    }

    // safeUpdate 接受 PoolClient（共享事务）或不传（走 service 自带 this.db）
    const isClient = 'release' in db && typeof (db as PoolClient).release === 'function'
    const { updated } = await this.catalogService.safeUpdate(catalogId, data.fields, 'bangumi', {
      sourceRef: String(bangumiId),
      db: isClient ? (db as PoolClient) : undefined,
    })
    return { episodes: episodesWritten, wrote: updated !== null }
  }

  /**
   * auto_matched Phase 2（DB tx）：BEGIN → applyEnrichmentDb（catalog + 逐集 + episode_count）
   * → upsert ref(auto_matched, primary) → COMMIT；任一步骤失败 ROLLBACK 并抛出。
   * 防 catalog 写失败时遗留已提交的 auto_matched/primary ref 脏态（Codex stop-time review）。
   * REST 已在 Phase 1（gatherEnrichmentData）完成，事务内无网络等待（不占 idle-in-transaction）。
   * 返回逐集写入数。
   */
  private async applyAutoMatchAtomic(
    videoId: string,
    catalogId: string,
    bangumiId: number,
    confidence: number,
    breakdown: Record<string, number>,
    data: EnrichmentData,
  ): Promise<number> {
    const client = await this.db.connect()
    try {
      await client.query('BEGIN')
      const result = await this.applyEnrichmentDb(client, videoId, catalogId, bangumiId, data)
      await externalDataQueries.upsertVideoExternalRef(client, {
        videoId,
        provider: 'bangumi',
        externalId: String(bangumiId),
        matchStatus: 'auto_matched',
        matchMethod: 'title_norm',
        confidence,
        isPrimary: true,
        linkedBy: 'auto',
        notes: JSON.stringify(breakdown),
      })
      // ADR-170 R-3：status 写入与 catalog+ref 同事务（消除「已提交但 status 未写」窗口）
      await videosQueries.updateVideoBangumiStatus(client, videoId, 'matched')
      await client.query('COMMIT')
      return result.episodes
    } catch (err) {
      try { await client.query('ROLLBACK') } catch { /* connection may already be lost */ }
      throw err
    } finally {
      client.release()
    }
  }

  private async writeRef(
    videoId: string,
    bangumiId: number,
    matchStatus: 'auto_matched' | 'candidate',
    confidence: number,
    breakdown: Record<string, number>,
  ): Promise<void> {
    try {
      await externalDataQueries.upsertVideoExternalRef(this.db, {
        videoId,
        provider: 'bangumi',
        externalId: String(bangumiId),
        matchStatus,
        matchMethod: 'title_norm',
        confidence,
        isPrimary: matchStatus === 'auto_matched',
        linkedBy: 'auto',
        notes: JSON.stringify(breakdown),
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      process.stderr.write(`[BangumiService] writeRef failed for ${videoId}: ${msg}\n`)
    }
  }

  /**
   * 写 videos.bangumi_status（无事务路径：none/candidate 分支）。
   * best-effort：失败记录到 stderr 不抛（不阻断 enrich 主流程），但**不静默吞**（ADR-170 D-170-4 / Y-2）。
   * auto/confirm 路径不走此助手——它们在各自事务内直接 updateVideoBangumiStatus(client, ...) 以保原子性。
   */
  private async writeBangumiStatus(videoId: string, status: BangumiStatus): Promise<void> {
    try {
      await videosQueries.updateVideoBangumiStatus(this.db, videoId, status)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      process.stderr.write(`[BangumiService] updateVideoBangumiStatus(${status}) failed for ${videoId}: ${msg}\n`)
    }
  }
}
