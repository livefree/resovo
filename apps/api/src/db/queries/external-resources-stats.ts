// external-resources-stats.ts — 外部资源治理概览聚合查询（ADR-188 D-188-5/6）
// provider 数据规模 + 富集匹配分布（video_external_refs 按 provider）。
// 富集「离线/在线」由消费方据 match_method 派生（method 值不强约束，此处返回原始分布更稳）。

import type { Pool } from 'pg'

// ── 数据规模（dataScale）──────────────────────────────────────────────

export interface DoubanDataScale {
  /** 实时热门合集条目总数（douban_collection_items） */
  collectionItems: number
  /** 离线 dump 元数据条目总数（douban_entries） */
  doubanEntries: number
}

/** 豆瓣数据规模：合集切片 + dump 行数（概览 dataScale，ADR-188）。 */
export async function getDoubanDataScale(db: Pool): Promise<DoubanDataScale> {
  const result = await db.query<{ collection_items: string; douban_entries: string }>(
    `SELECT
       (SELECT COUNT(*) FROM external_data.douban_collection_items)::TEXT AS collection_items,
       (SELECT COUNT(*) FROM external_data.douban_entries)::TEXT AS douban_entries`,
  )
  const row = result.rows[0]
  return {
    collectionItems: Number.parseInt(row?.collection_items ?? '0', 10),
    doubanEntries: Number.parseInt(row?.douban_entries ?? '0', 10),
  }
}

export interface BangumiDataScale {
  /** 派生合集切片条目总数（bangumi_collection_items） */
  collectionItems: number
  /** 离线 dump 元数据条目总数（bangumi_entries） */
  dumpEntries: number
  /** dump 最近重导时间（bangumi_entries MAX(updated_at)；ADR-189 D-189-6 dump 可观测，无行→null） */
  dumpRefreshedAt: string | null
}

/** Bangumi 数据规模：派生合集 + dump 行数 + dump 重导时间（概览 dataScale + freshness，ADR-189 D-189-6）。 */
export async function getBangumiDataScale(db: Pool): Promise<BangumiDataScale> {
  const result = await db.query<{ collection_items: string; dump_entries: string; dump_refreshed_at: string | null }>(
    `SELECT
       (SELECT COUNT(*) FROM external_data.bangumi_collection_items)::TEXT AS collection_items,
       (SELECT COUNT(*) FROM external_data.bangumi_entries)::TEXT AS dump_entries,
       (SELECT MAX(updated_at)::TEXT FROM external_data.bangumi_entries) AS dump_refreshed_at`,
  )
  const row = result.rows[0]
  return {
    collectionItems: Number.parseInt(row?.collection_items ?? '0', 10),
    dumpEntries: Number.parseInt(row?.dump_entries ?? '0', 10),
    dumpRefreshedAt: row?.dump_refreshed_at ?? null,
  }
}

// ── 富集匹配分布（enrichStats）────────────────────────────────────────

export interface MatchBucket {
  readonly key: string
  readonly count: number
}

export interface ExternalRefMatchStats {
  readonly total: number
  /** 按 match_status（auto_matched/manual_confirmed/candidate/rejected）分桶 */
  readonly byStatus: MatchBucket[]
  /** 按 match_method（imdb_id/title/alias/network/manual…）分桶；消费方据此派生离线/在线 */
  readonly byMethod: MatchBucket[]
}

interface DbMatchBucketRow {
  key: string | null
  count: string
}

function mapMatchBuckets(rows: readonly DbMatchBucketRow[]): MatchBucket[] {
  return rows.map((r) => ({ key: r.key ?? '(unknown)', count: Number.parseInt(r.count, 10) }))
}

/**
 * 某 provider 在 video_external_refs 的匹配分布（概览 enrichStats，ADR-188）。
 * byMethod NULL 归 '(unknown)'；离线/在线由消费方据 method 派生。
 */
export async function aggregateExternalRefMatch(db: Pool, provider: string): Promise<ExternalRefMatchStats> {
  const totalRes = await db.query<{ count: string }>(
    `SELECT COUNT(*)::TEXT AS count FROM video_external_refs WHERE provider = $1`,
    [provider],
  )
  const byStatusRes = await db.query<DbMatchBucketRow>(
    `SELECT match_status AS key, COUNT(*)::TEXT AS count
       FROM video_external_refs WHERE provider = $1
      GROUP BY match_status ORDER BY COUNT(*) DESC`,
    [provider],
  )
  const byMethodRes = await db.query<DbMatchBucketRow>(
    `SELECT match_method AS key, COUNT(*)::TEXT AS count
       FROM video_external_refs WHERE provider = $1
      GROUP BY match_method ORDER BY COUNT(*) DESC`,
    [provider],
  )
  return {
    total: Number.parseInt(totalRes.rows[0]?.count ?? '0', 10),
    byStatus: mapMatchBuckets(byStatusRes.rows),
    byMethod: mapMatchBuckets(byMethodRes.rows),
  }
}
