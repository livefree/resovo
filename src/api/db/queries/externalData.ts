/**
 * externalData.ts — external_data schema 查询
 * 供 MetadataEnrichService 做本地毫秒级标题匹配
 * 不用于构建 media_catalog（那是 externalRaw.ts 的职责）
 */

import type { Pool } from 'pg'

// ── 类型 ──────────────────────────────────────────────────────────

export interface DoubanEntryMatch {
  doubanId: string
  title: string
  year: number | null
  rating: number | null
  description: string | null
  coverUrl: string | null
  directors: string[]
  cast: string[]
  writers: string[]
  genres: string[]
  country: string | null
}

export interface BangumiEntryMatch {
  bangumiId: number
  titleCn: string | null
  titleJp: string | null
  year: number | null
  rating: number | null
  summary: string | null
  airDate: string | null
}

// ── 豆瓣条目查询 ──────────────────────────────────────────────────

/**
 * 按 title_normalized 精确匹配豆瓣条目，结果按年份接近度排序
 * 最多返回 5 条（供调用方选择最优）
 */
export async function findDoubanByTitleNorm(
  db: Pool,
  titleNorm: string,
  year: number | null
): Promise<DoubanEntryMatch[]> {
  const result = await db.query<{
    douban_id: string; title: string; year: number | null
    rating: string | null; description: string | null; cover_url: string | null
    directors: string[]; cast: string[]; writers: string[]; genres: string[]; country: string | null
  }>(
    `SELECT douban_id, title, year, rating, description, cover_url,
            directors, cast, writers, genres, country
     FROM external_data.douban_entries
     WHERE title_normalized = $1
     ORDER BY
       CASE WHEN $2::INT IS NULL THEN 0
            WHEN year = $2::INT THEN 0
            WHEN year IS NOT NULL AND ABS(year - $2::INT) <= 1 THEN 1
            ELSE 2 END,
       rating DESC NULLS LAST
     LIMIT 5`,
    [titleNorm, year]
  )
  return result.rows.map((r) => ({
    doubanId: r.douban_id,
    title: r.title,
    year: r.year,
    rating: r.rating ? Number(r.rating) : null,
    description: r.description,
    coverUrl: r.cover_url,
    directors: r.directors ?? [],
    cast: r.cast ?? [],
    writers: r.writers ?? [],
    genres: r.genres ?? [],
    country: r.country,
  }))
}

// ── Bangumi 条目查询 ──────────────────────────────────────────────

/**
 * 按 title_normalized 匹配 Bangumi 动画条目
 * 最多返回 3 条
 */
export async function findBangumiByTitleNorm(
  db: Pool,
  titleNorm: string,
  year: number | null
): Promise<BangumiEntryMatch[]> {
  const result = await db.query<{
    bangumi_id: number; title_cn: string | null; title_jp: string | null
    year: number | null; rating: string | null; summary: string | null; air_date: string | null
  }>(
    `SELECT bangumi_id, title_cn, title_jp, year, rating, summary, air_date
     FROM external_data.bangumi_entries
     WHERE title_normalized = $1
     ORDER BY
       CASE WHEN $2::INT IS NULL THEN 0
            WHEN year = $2::INT THEN 0
            WHEN year IS NOT NULL AND ABS(year - $2::INT) <= 1 THEN 1
            ELSE 2 END,
       rating DESC NULLS LAST
     LIMIT 3`,
    [titleNorm, year]
  )
  return result.rows.map((r) => ({
    bangumiId: r.bangumi_id,
    titleCn: r.title_cn,
    titleJp: r.title_jp,
    year: r.year,
    rating: r.rating ? Number(r.rating) : null,
    summary: r.summary,
    airDate: r.air_date,
  }))
}
