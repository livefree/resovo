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
import * as externalRefQueries from '@/api/db/queries/catalogExternalRefs'
import * as catalogEpisodeQueries from '@/api/db/queries/catalogEpisodes'
import type { CatalogEpisodeInput } from '@/api/db/queries/catalogEpisodes'
import * as catalogCharacterQueries from '@/api/db/queries/catalogCharacters'
import type { CatalogCharacterInput } from '@/api/db/queries/catalogCharacters'
import * as videosQueries from '@/api/db/queries/videos'
import * as systemSettingsQueries from '@/api/db/queries/systemSettings'
import { getSubject, getEpisodes, getCharacters, searchSubjects, searchSubjectsStrict, isBangumiApiConfigured } from '@/api/lib/bangumi'
import type { BangumiClientConfig } from '@/api/lib/bangumi'
import type { FetchSource } from '@/api/db/queries/external-fetch-log'
import { normalizeForExternalMatch, stripExternalMatchPunct } from './TitleNormalizer'
import {
  computeLocalBangumiConfidence,
  computeRestBangumiConfidence,
  computeAliasBangumiConfidence,
  isAmbiguousLocalMatch,
  mapSubjectToCatalogFields,
  mapEpisodes,
  mapCharacters,
} from './BangumiService.utils'

function parseYear(date: string | null | undefined): number | null {
  if (!date) return null
  const m = date.match(/^(\d{4})/)
  return m ? Number.parseInt(m[1], 10) : null
}

// ── 阈值（复用豆瓣范式）───────────────────────────────────────────
const CONFIDENCE_AUTO_MATCH = 0.85
const CONFIDENCE_CANDIDATE = 0.6
// 别名感知 B（META-20）：name 未命中时 getSubject 查别名的候选上限（控 REST 调用量）
const ALIAS_CHECK_TOP_N = 5

// ── ADR-168 D-168-5：Bangumi 凭证进程内缓存（避免每 job 查 system_settings）──
const BANGUMI_CONFIG_TTL_MS = 60_000
let bangumiConfigCache: { value: BangumiClientConfig; expiresAt: number } | null = null
/** 测试钩子：清空凭证缓存（生产无需，60s TTL 自然过期）。 */
export function clearBangumiConfigCache(): void {
  bangumiConfigCache = null
}

// ── 结果类型 ───────────────────────────────────────────────────────
// auto.catalogId（ADR-174 D-174-3）：富集实际写入的有效 catalog —— 正常等于入参 catalogId，
// 真去重 redirect 时为重指向后的 existing catalog。调用方（MetadataEnrichService.step5MetaScore）
// 必须用它而非入参 catalogId，否则在 redirect 后会对已弃置的 orphan catalog 算 meta_score。
export type BangumiEnrichResult =
  | { matched: 'auto'; bangumiSubjectId: number; confidence: number; episodes: number; degraded: boolean; catalogId: string }
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
  // ADR-161 AMENDMENT / META-19：角色 + CV。
  // characters = 本次抓到的集合（可能 []）；charactersFetched = getCharacters 是否成功（区分失败 vs 成功空）。
  // 仅 charactersFetched 才全量替换（成功返回空也替换 → 清陈旧；失败跳过 → 不误删）。
  characters: CatalogCharacterInput[]
  charactersFetched: boolean
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
   * ADR-168 D-168-5：从 system_settings 解析 Bangumi 凭证（token/UA/timeout），进程内 60s 缓存。
   * 仅注入 DB 有值的字段 → lib/bangumi 对缺省字段回退 process.env（向后兼容）。
   */
  private async getBangumiConfig(): Promise<BangumiClientConfig> {
    const now = Date.now()
    if (bangumiConfigCache && bangumiConfigCache.expiresAt > now) return bangumiConfigCache.value
    const raw = await systemSettingsQueries.getAllSettings(this.db)
    const cfg: BangumiClientConfig = {}
    if (raw.bangumi_api_token) cfg.token = raw.bangumi_api_token
    if (raw.bangumi_user_agent) cfg.userAgent = raw.bangumi_user_agent
    const t = Number(raw.bangumi_api_timeout_ms)
    if (Number.isFinite(t) && t > 0) cfg.timeoutMs = t
    bangumiConfigCache = { value: cfg, expiresAt: now + BANGUMI_CONFIG_TTL_MS }
    return cfg
  }

  /**
   * 对单视频做 Bangumi 匹配 + 丰富（供 MetadataEnrichService.step3 与后台手动调用）。
   * 仅本地 dump 召回；auto 命中后按需拉 REST 详情（Token 缺失/失败则降级用本地 dump 字段）。
   */
  async matchAndEnrich({ videoId, catalogId, titleNorm, year }: MatchAndEnrichInput): Promise<BangumiEnrichResult> {
    // ADR-170 D-170-4：状态投影下沉本方法，统一覆盖 step3 自动流 / bangumi-sync 直调 / 改类型→anime 三路径。
    // 命中来源双轨：① 本地 dump 精确召回（毫秒级）② META-17 方案 A：dump 空/低置信时 REST 精确兜底。
    const cfg = await this.getBangumiConfig()   // ADR-168：凭证（DB system_settings 优先，回退 env）

    // META-15-C FIX（Codex stop-time review）：已有 primary bangumi 绑定（auto_matched/manual_confirmed）
    // → **只刷新不重配**。防批量重富集（missing-characters 等）重跑匹配把既有绑定降级（matched→
    // unmatched/candidate）、覆盖人工校正（manual_confirmed→auto）、或改绑到不同 subject。
    // unmatched/never 视频无 primary ref → 落空，走下方正常匹配（unmatched mode 重试匹配的语义不变）。
    const existingPrimary = await externalDataQueries.findPrimaryVideoExternalRef(this.db, videoId, 'bangumi')
    if (
      existingPrimary &&
      (existingPrimary.matchStatus === 'auto_matched' || existingPrimary.matchStatus === 'manual_confirmed')
    ) {
      const boundId = Number(existingPrimary.externalId)
      if (Number.isFinite(boundId) && boundId > 0) {
        return await this.refreshExistingMatch(videoId, catalogId, boundId, existingPrimary.confidence, cfg)
      }
    }

    // META-22：入参 titleNorm 双来源（step3 新算 normalizeForExternalMatch / bangumi-sync 端点
    // 直传持久化 title_normalized）→ 在匹配边界统一剥 CJK 标点，与 dump 存储 + REST 候选侧对齐。
    const matchNorm = stripExternalMatchPunct(titleNorm)
    const matches = await externalDataQueries.findBangumiByTitleNorm(this.db, matchNorm, year)
    let resolved: { bangumiId: number; confidence: number; breakdown: Record<string, number>; localEntry: BangumiEntryMatch | null } | null = null
    // META-22：本地有损键命中多条不同 subject 且年份同档 → 歧义，禁止 auto 绑定（降级候选人工确认）
    let localAmbiguous = false

    if (matches.length > 0) {
      const best = matches[0]
      const { confidence, breakdown } = computeLocalBangumiConfidence(best, year)
      if (confidence >= CONFIDENCE_CANDIDATE) {
        resolved = { bangumiId: best.bangumiId, confidence, breakdown, localEntry: best }
        localAmbiguous = isAmbiguousLocalMatch(matches, year)
      }
    }

    // META-17 方案 A：本地未命中（或低置信）+ token 配置 → REST 精确兜底（REST 不涉本地有损歧义）
    if (resolved === null && isBangumiApiConfigured(cfg)) {
      resolved = await this.matchViaRest(matchNorm, year, cfg)
    }

    if (resolved === null) {
      await this.writeBangumiStatus(videoId, 'unmatched')
      return { matched: 'none', reason: matches.length > 0 ? 'low_confidence' : 'no_local_match' }
    }

    const { bangumiId, confidence, breakdown, localEntry } = resolved
    const status = (confidence >= CONFIDENCE_AUTO_MATCH && !localAmbiguous) ? 'auto_matched' : 'candidate'

    if (status === 'candidate') {
      // candidate：仅记 ref（无 catalog 写入 → 无脏态风险，沿用 best-effort writeRef）
      await this.writeRef(videoId, bangumiId, 'candidate', confidence, breakdown)
      // 无事务（无 catalog 写）→ Pool 写 status（best-effort，记录不静默吞 / ADR-170 D-170-4）
      await this.writeBangumiStatus(videoId, 'candidate')
      return { matched: 'candidate', bangumiSubjectId: bangumiId, confidence }
    }

    // auto_matched：Phase 1 REST（无 DB 锁）→ Phase 2 catalog/episodes/episode_count + ref
    // 原子事务（与 confirmMatch 同构 / Codex stop-time review：防 catalog 写失败遗留
    // 已提交的 auto_matched/primary ref 脏态）。REST 已在 gatherEnrichmentData 完成，事务内无网络等待；
    // job 失败时整体 ROLLBACK，由上层 enrichmentQueue 重试（幂等收敛，但不留孤儿 ref）。
    // localEntry=null（REST 兜底命中）时 gatherEnrichmentData 纯走 REST（与 confirmMatch 同路径）。
    const data = await this.gatherEnrichmentData(bangumiId, localEntry, cfg)
    // Codex stop-time review 修复：REST 兜底命中（localEntry=null）但 getSubject 详情瞬时失败 → fields=null
    // （无 dump 降级可用）。此时**不可**提交「matched 但无数据」终态 → 抛出让 Bull 重试 / 端点报错。
    // 本地 dump 命中（localEntry≠null）时 fields 恒由 dump 兜底为非空，不受此守卫影响。
    if (data.fields === null) {
      throw new Error(`bangumi enrich: subject ${bangumiId} detail fetch failed (no fields, transient) — retry`)
    }
    const apply = await this.applyAutoMatchAtomic(
      videoId, catalogId, bangumiId, confidence, breakdown, data,
    )
    if (apply.dedupConflict) {
      // D-174-3 ③：subject 已被他行占用且重指向不安全 → 已在事务内降级 candidate ref + unmatched
      return { matched: 'candidate', bangumiSubjectId: bangumiId, confidence }
    }
    return {
      matched: 'auto',
      bangumiSubjectId: bangumiId,
      confidence,
      episodes: apply.episodes,
      degraded: data.degraded,
      catalogId: apply.effectiveCatalogId,
    }
  }

  /**
   * META-15-C FIX（Codex stop-time review）：已有 primary bangumi 绑定时的「只刷新不重配」路径。
   * **不重新匹配 / 不动 ref**（保留既有 manual_confirmed/auto_matched 绑定，防降级·改绑·清空）；
   * 仅按既有 subject 拉数据刷新 catalog(COALESCE)/逐集/角色，并重申 bangumi_status='matched'（幂等·
   * 兼修历史 buggy 重富集留下的「有绑定却 unmatched」不一致）。REST 详情瞬时失败且无 dump 兜底 →
   * 抛出让 Bull 重试，绝不清空既有数据。
   */
  private async refreshExistingMatch(
    videoId: string,
    catalogId: string,
    bangumiId: number,
    existingConfidence: number | null,
    cfg: BangumiClientConfig,
  ): Promise<BangumiEnrichResult> {
    const entry = await externalDataQueries.findBangumiById(this.db, bangumiId)
    const data = await this.gatherEnrichmentData(bangumiId, entry, cfg)
    if (data.fields === null) {
      throw new Error(`bangumi refresh: subject ${bangumiId} detail fetch failed (transient) — retry`)
    }
    const client = await this.db.connect()
    try {
      await client.query('BEGIN')
      const result = await this.applyEnrichmentDb(client, videoId, catalogId, bangumiId, data)
      // 不 upsert ref（保留既有绑定）；重申 matched（绑定恒为 matched，幂等修不一致）
      await videosQueries.updateVideoBangumiStatus(client, videoId, 'matched')
      await client.query('COMMIT')
      return {
        matched: 'auto',
        bangumiSubjectId: bangumiId,
        confidence: existingConfidence ?? 1,
        episodes: result.episodes,
        degraded: data.degraded,
        catalogId: result.effectiveCatalogId,
      }
    } catch (err) {
      try { await client.query('ROLLBACK') } catch { /* connection may already be lost */ }
      throw err
    } finally {
      client.release()
    }
  }

  /**
   * META-17 方案 A：REST 精确兜底匹配（本地 dump 未命中时）。
   * searchSubjectsStrict 模糊搜索 → 仅取 `name_cn`/`name` 规范化精确等于 titleNorm 的候选（computeRestBangumiConfidence），
   * 取置信度最高者。非精确一律拒绝（避免「海贼王→海贼王子」假阳性）。返回 localEntry=null（无本地条目）。
   *
   * **严格搜索**（Codex stop-time review 修复）：用 searchSubjectsStrict —— API 瞬时失败（超时/429/5xx/网络）
   * **抛出**而非返回 []，使 matchAndEnrich 将其上抛（enrichment job 由 Bull 重试 / bangumi-sync 端点报错），
   * 避免把瞬时故障误写成终态 unmatched（不可重试）。真无结果（200 + 空）才返回 null（→ 终态 unmatched 正确）。
   *
   * **别名感知 B**（META-20）：name 未精确命中时，对 top-N 候选拉 getSubject 查 infobox「别名」
   * （curated，仅精确才认）—— 召回 name 与本地标题不一致但别名命中的作品（海贼王↔航海王）。
   * getSubject null（瞬时/404）跳过：别名 pass 仅在 name-exact 基线（→unmatched）之上**增召回**，
   * 不引入新退化（瞬时未召回 = 与未做别名前同为 unmatched，下次 backfill 重试）。
   */
  private async matchViaRest(
    titleNorm: string,
    year: number | null,
    cfg?: BangumiClientConfig,
    source: FetchSource = 'enrich_worker',
  ): Promise<{ bangumiId: number; confidence: number; breakdown: Record<string, number>; localEntry: null } | null> {
    const items = await searchSubjectsStrict(titleNorm, 10, cfg, source)
    let best: { bangumiId: number; confidence: number; breakdown: Record<string, number>; localEntry: null } | null = null
    // pass 1：name_cn/name 精确（无额外 REST 调用，保留 META-17 快路径）
    for (const item of items) {
      const { confidence, breakdown } = computeRestBangumiConfidence(item, titleNorm, year)
      if (confidence >= CONFIDENCE_CANDIDATE && (best === null || confidence > best.confidence)) {
        best = { bangumiId: item.id, confidence, breakdown, localEntry: null }
      }
    }
    if (best !== null) return best

    // pass 2（别名感知）：name 未命中 → top-N getSubject 查 infobox 别名
    for (const item of items.slice(0, ALIAS_CHECK_TOP_N)) {
      const subject = await getSubject(item.id, cfg, source)
      if (!subject) continue
      const { confidence, breakdown } = computeAliasBangumiConfidence(subject, titleNorm, year)
      if (confidence >= CONFIDENCE_CANDIDATE && (best === null || confidence > best.confidence)) {
        best = { bangumiId: item.id, confidence, breakdown, localEntry: null }
      }
    }
    return best
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
    const cfg = await this.getBangumiConfig()   // ADR-168
    const entry = await externalDataQueries.findBangumiById(this.db, bangumiId)
    // Phase 1：REST 在事务外，避免长持锁
    const data = await this.gatherEnrichmentData(bangumiId, entry, cfg)
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

    // META-22：keyword 走匹配领域归一化（标点不敏感）；titleNorm 入参（可能是持久化归并键）统一剥标点对齐
    const localNorm = input.keyword ? normalizeForExternalMatch(input.keyword) : stripExternalMatchPunct(input.titleNorm)
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

    if (input.keyword) {
      const cfg = await this.getBangumiConfig()   // ADR-168
      if (isBangumiApiConfigured(cfg)) {
        const items = await searchSubjects(input.keyword, 10, cfg, 'admin_search')
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
    cfg?: BangumiClientConfig,
    source: FetchSource = 'enrich_worker',
  ): Promise<EnrichmentData> {
    let fields: CatalogUpdateData | null = null
    let episodes: CatalogEpisodeInput[] = []
    let characters: CatalogCharacterInput[] = []
    let charactersFetched = false
    let mainEpisodeCount = 0
    let degraded = true

    if (isBangumiApiConfigured(cfg)) {
      const subject = await getSubject(bangumiId, cfg, source)
      if (subject) {
        fields = mapSubjectToCatalogFields(subject)
        degraded = false
        const eps = await getEpisodes(bangumiId, cfg, source)
        if (eps.length > 0) episodes = mapEpisodes(eps)
        // 本篇集数（ADR-161 P1）：优先 wiki eps（本篇数）；否则数 type===0 本篇；
        // 不用 total_episodes（含 SP/OP/ED 章节，会高估用户侧剧集数）
        mainEpisodeCount = subject.eps && subject.eps > 0
          ? subject.eps
          : eps.filter((e) => e.type === 0).length
        // ADR-161 AMENDMENT / META-19：角色 + CV。getCharacters 与 subject 解耦，独立失败返 null。
        // 区分「抓取失败(null)」与「成功返回空([])」：仅成功(非 null)标 charactersFetched，
        // apply 侧据此全量替换（成功空也替换 → 清陈旧角色；失败跳过 → 不误删 / D-161-AMD-3）。
        const chars = await getCharacters(bangumiId, cfg, source)
        if (chars !== null) {
          charactersFetched = true
          characters = mapCharacters(chars)
        }
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

    return { fields, episodes, characters, charactersFetched, mainEpisodeCount, degraded }
  }

  /**
   * Phase 2（纯 DB 写入）：把 gatherEnrichmentData 收集的字段写到 catalog + 逐集 + 集数回填。
   * - 传 PoolClient：所有写入复用该连接（confirmMatch 原子事务场景）
   * - 传 Pool：每个 query 各自管连接（matchAndEnrich 后台 job，eventually consistent + idempotent）
   *
   * ADR-174 D-174-3 唯一约束兜底真去重：写 bangumi_subject_id 前先经 resolveBangumiBinding 判定该
   * subject 是否已被他行占用 —— safe → 写当前 catalog；redirect → 重指向 video 到 existing 并写 existing
   * （运行时即时去重，避免撞 media_catalog_bangumi_subject_id_key）；conflict（type/year 不安全）→
   * 不写 catalog，返回 dedupConflict 让调用方降级（绝不抛 duplicate key 炸事务）。
   * 注：pre-check 是去重主体；并发窗口内仍可能撞唯一约束 → 事务 ROLLBACK 后由 Bull 重试收敛
   * （重试时 existing 已存在 → 走 redirect / safe），ON CONFLICT 非语义主体（D-174-3）。
   *
   * 返回逐集写入数、是否实际写入 catalog、是否因去重不安全降级。
   */
  private async applyEnrichmentDb(
    db: Pool | PoolClient,
    videoId: string,
    catalogId: string,
    bangumiId: number,
    data: EnrichmentData,
  ): Promise<{ episodes: number; wrote: boolean; dedupConflict: boolean; effectiveCatalogId: string }> {
    if (!data.fields) return { episodes: 0, wrote: false, dedupConflict: false, effectiveCatalogId: catalogId }

    // safeUpdate 接受 PoolClient（共享事务）或不传（走 service 自带 this.db）
    const isClient = 'release' in db && typeof (db as PoolClient).release === 'function'

    // D-174-3：唯一约束兜底真去重判定（只读，redirect 的 linkVideo 在本事务内执行保原子性）
    const resolution = await this.catalogService.resolveBangumiBinding(db, catalogId, bangumiId)
    if (resolution.kind === 'conflict') {
      // ADR-177 D-177-7/D-177-13 双写起点（CHG-VIR-12-D）：catalog 层冲突落 catalog 级
      // candidate（Y-177-1 conflict 分支 → catalog_id = 当前入参 catalog，待人工裁定是否
      // 并入占用方）；video 级 candidate 降级路径（applyAutoMatchAtomic）零改（R7）。
      // redirect 分支不写（D-177-7：video 已归 existing，existing 已是 canonical）。
      await externalRefQueries.insertCandidateRef(db, {
        catalogId,
        provider: 'bangumi',
        externalId: String(bangumiId),
        externalKind: 'subject',
        source: 'auto',
        linkedBy: 'bangumi-enrich-conflict',
      })
      // 冲突未重指向 → video 仍属入参 catalogId
      return { episodes: 0, wrote: false, dedupConflict: true, effectiveCatalogId: catalogId }
    }
    const targetCatalogId = resolution.kind === 'redirect' ? resolution.targetCatalogId : catalogId
    if (resolution.kind === 'redirect') {
      // 运行时即时真去重：当前 video 改指到已占用该 subject 的 existing catalog（共享 db 连接）
      await this.catalogService.linkVideo(videoId, targetCatalogId, db)
    }

    const episodesWritten = data.episodes.length > 0
      ? await catalogEpisodeQueries.upsertCatalogEpisodes(db, targetCatalogId, data.episodes)
      : 0

    if (data.mainEpisodeCount > 0) {
      await videosQueries.updateEpisodeCount(db, videoId, data.mainEpisodeCount)
    }

    // ADR-161 AMENDMENT / META-19：角色 + CV 全量替换（delete-then-insert，仅事务内 PoolClient）。
    // 守卫 charactersFetched（D-161-AMD-3）：getCharacters 成功（含返回空）才替换 —— 成功返回空也
    // 清陈旧角色（避免保留过时数据）；抓取失败(null) 时 charactersFetched=false → 跳过，不误删。
    // 两路径（applyAutoMatchAtomic / confirmMatch）均传 client，恒满足 isClient。
    if (data.charactersFetched && isClient) {
      await catalogCharacterQueries.replaceCatalogCharacters(
        db as PoolClient, targetCatalogId, 'bangumi', data.characters,
      )
    }

    const { updated } = await this.catalogService.safeUpdate(targetCatalogId, data.fields, 'bangumi', {
      sourceRef: String(bangumiId),
      db: isClient ? (db as PoolClient) : undefined,
    })
    return { episodes: episodesWritten, wrote: updated !== null, dedupConflict: false, effectiveCatalogId: targetCatalogId }
  }

  /**
   * auto_matched Phase 2（DB tx）：BEGIN → applyEnrichmentDb（catalog + 逐集 + episode_count）
   * → upsert ref(auto_matched, primary) → COMMIT；任一步骤失败 ROLLBACK 并抛出。
   * 防 catalog 写失败时遗留已提交的 auto_matched/primary ref 脏态（Codex stop-time review）。
   * REST 已在 Phase 1（gatherEnrichmentData）完成，事务内无网络等待（不占 idle-in-transaction）。
   *
   * ADR-174 D-174-3 ③：applyEnrichmentDb 报 dedupConflict（subject 已被他行占用且重指向不安全）时
   * 降级 —— 写 candidate ref（非 primary）+ 保留 bangumi_status=unmatched，仍正常 COMMIT
   * （绝不让单冲突 video 炸整个 matchAndEnrich）；审核台据 candidate ref 人工裁定。
   * 返回逐集写入数与是否降级。
   */
  private async applyAutoMatchAtomic(
    videoId: string,
    catalogId: string,
    bangumiId: number,
    confidence: number,
    breakdown: Record<string, number>,
    data: EnrichmentData,
  ): Promise<{ episodes: number; dedupConflict: boolean; effectiveCatalogId: string }> {
    const client = await this.db.connect()
    try {
      await client.query('BEGIN')
      const result = await this.applyEnrichmentDb(client, videoId, catalogId, bangumiId, data)
      const conflict = result.dedupConflict
      // conflict → candidate/非 primary/unmatched（降级）；否则 auto_matched/primary/matched（正常）
      await externalDataQueries.upsertVideoExternalRef(client, {
        videoId,
        provider: 'bangumi',
        externalId: String(bangumiId),
        matchStatus: conflict ? 'candidate' : 'auto_matched',
        matchMethod: 'title_norm',
        confidence,
        isPrimary: !conflict,
        linkedBy: 'auto',
        notes: JSON.stringify(breakdown),
      })
      // ADR-170 R-3：status 写入与 catalog+ref 同事务（消除「已提交但 status 未写」窗口）
      await videosQueries.updateVideoBangumiStatus(client, videoId, conflict ? 'unmatched' : 'matched')
      await client.query('COMMIT')
      return { episodes: conflict ? 0 : result.episodes, dedupConflict: conflict, effectiveCatalogId: result.effectiveCatalogId }
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
