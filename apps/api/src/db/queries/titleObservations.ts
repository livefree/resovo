/**
 * titleObservations.ts — title_observations shadow 观测表读写（SEQ-20260602-03 / CHG-VIR-6 / Phase 1b）
 *
 * schema 真源 = `docs/designs/video-identity-resolution-redesign_20260602.md` §1b（无独立 ADR）。
 * 写：采集链路 shadow 观测各源原始标题 + 解析 facets，去重聚合。
 * 读：拆分建议 facet 信号源（ADR-105 AMENDMENT 2026-06-03 D-105-1 / CHG-VIR-11-B，纯只读）。
 * **不参与任何归并决策**（设计 §1b / 复核 F1）。所有 SQL 参数化（db-rules.md）。
 *
 * 分层：本文件**仅 DB query**（不 import Service 层）。原始标题→观测入参的解析/哈希组装
 * （依赖 `TitleIdentityParser`）由 Service 层（`CrawlerService.buildTitleObservation`）完成，
 * 与「`normalizeMergeKey` 在 Service 层算好再传 string 给 query」的既有范式一致。
 */

import type { Pool } from 'pg'

/** 观测写入入参（去重键 = video_id + COALESCE(site_key,'') + COALESCE(source_name,'') + raw_title_hash + parser_version）。 */
export interface TitleObservationInput {
  videoId: string
  /** 采集站点 key；null 进去重键经 COALESCE('') */
  sourceSiteKey: string | null
  /** 播放源名；site 级标题观测通常为 null */
  sourceName: string | null
  rawTitle: string
  /** raw_title 的 sha256 hex（窄化去重键） */
  rawTitleHash: string
  /** TitleIdentityParser.TITLE_PARSER_VERSION */
  parserVersion: string
  /** {coreTitleKey, titleKind, confidence, facets}（解析快照，仅观测） */
  parsedFacets: Record<string, unknown>
}

/**
 * upsert 一条标题观测：命中去重唯一键则 `observed_count + 1` + 刷新 `last_seen_at` + 更新 facets 快照
 * （parser_version 同 → 同行；版本升级 → 不同 parser_version → 新行，旧观测保留）；否则插入新行。
 *
 * 去重唯一索引 `uq_title_observations_dedupe`（migration 085）以 COALESCE 表达式承载 nullable 维度，
 * ON CONFLICT 推断须复述相同表达式。
 */
export async function recordTitleObservation(db: Pool, input: TitleObservationInput): Promise<void> {
  await db.query(
    `INSERT INTO title_observations
       (video_id, source_site_key, source_name, raw_title, raw_title_hash, parser_version, parsed_facets_jsonb)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
     ON CONFLICT (
       video_id,
       COALESCE(source_site_key, ''),
       COALESCE(source_name, ''),
       raw_title_hash,
       parser_version
     )
     DO UPDATE SET
       observed_count      = title_observations.observed_count + 1,
       last_seen_at        = NOW(),
       parsed_facets_jsonb = EXCLUDED.parsed_facets_jsonb`,
    [
      input.videoId,
      input.sourceSiteKey,
      input.sourceName,
      input.rawTitle,
      input.rawTitleHash,
      input.parserVersion,
      JSON.stringify(input.parsedFacets),
    ],
  )
}

// ── 只读：拆分建议 facet 信号源（ADR-105 AMENDMENT 2026-06-03 D-105-1）──────────

/** 单 video 观测行（site 级口径：source_name 写入恒 NULL，COALESCE('') 聚合） */
export interface TitleObservationRow {
  /** COALESCE(source_site_key, '')（与去重键口径一致） */
  readonly siteKey: string
  readonly rawTitle: string
  readonly rawTitleHash: string
  readonly observedCount: number
  readonly lastSeenAt: string
  /** {coreTitleKey, titleKind, confidence, facets} 解析快照 */
  readonly parsedFacets: Record<string, unknown>
}

/**
 * 列出单 video 的全部观测行，dominant facets 确定性排序已在 SQL 落定
 * （observed_count DESC, last_seen_at DESC, raw_title_hash ASC / D-105-1）：
 * 同 site 首行即 dominant。idx_title_observations_video 反查（migration 085）。
 */
export async function listObservationsByVideoId(
  db: Pool,
  videoId: string,
): Promise<TitleObservationRow[]> {
  const result = await db.query<{
    site_key: string
    raw_title: string
    raw_title_hash: string
    observed_count: number
    last_seen_at: string
    parsed_facets_jsonb: Record<string, unknown>
  }>(
    `SELECT COALESCE(source_site_key, '') AS site_key,
            raw_title, raw_title_hash, observed_count,
            last_seen_at::text AS last_seen_at,
            parsed_facets_jsonb
       FROM title_observations
      WHERE video_id = $1
      ORDER BY COALESCE(source_site_key, '') ASC,
               observed_count DESC, last_seen_at DESC, raw_title_hash ASC`,
    [videoId],
  )
  return result.rows.map((r) => ({
    siteKey: r.site_key,
    rawTitle: r.raw_title,
    rawTitleHash: r.raw_title_hash,
    observedCount: r.observed_count,
    lastSeenAt: r.last_seen_at,
    parsedFacets: r.parsed_facets_jsonb,
  }))
}
