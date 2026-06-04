/**
 * catalogAliases.ts — media_catalog_aliases 结构化写入（ADR-175 D-175-2/5/6 / CHG-VIR-11-C）
 *
 * 表为别名结构化**单一真源**（R3）；`media_catalog.aliases[]` 数组列降级只读缓存。
 * 写入幂等基于既有 `UNIQUE(catalog_id, alias)`（黄线-1 保留）：ON CONFLICT 升级结构化列，
 * **不覆盖 manual 行 / 不降 confidence**（D-175-6 口径）。
 * primary 选举（is_primary_for_locale）不在写入路径做——遵 Y-175-2 先回填维度再选举。
 */

import type { Pool, PoolClient } from 'pg'

/** 结构化别名写入入参（D-175-2 列语义；kind 枚举代码常量真源 Y-175-3） */
export interface StructuredAliasInput {
  readonly catalogId: string
  readonly alias: string
  /** BCP47 language subtag（NULL=未知） */
  readonly lang: string | null
  /** BCP47 region subtag / ISO 3166-1（NULL=不限地区） */
  readonly region: string | null
  /** ISO 15924（Hans/Hant/Jpan/Latn/Kore；NULL=未知）。简繁区分关键，不归一（R1） */
  readonly script: string | null
  /** official/localized/romanization/abbreviation/aka/original（Y-175-3 代码常量真源） */
  readonly kind: string | null
  /** 置信度 [0,1]（无来源置信 NULL / Y-175-4） */
  readonly confidence: number | null
  /** douban/bangumi/tmdb/crawler/manual */
  readonly source: string
}

/** kind 枚举（Y-175-3：代码常量为真源，DB 不加 CHECK 以便扩展） */
export const ALIAS_KINDS = [
  'official', 'localized', 'romanization', 'abbreviation', 'aka', 'original',
] as const

/**
 * upsert 一条结构化别名：
 * - 新行直接插入；
 * - 撞 `UNIQUE(catalog_id, alias)` 时升级结构化列（仅填充缺失维度 / 提升 confidence），
 *   **不覆盖 manual 来源行**（D-175-6：manual 行结构化字段保持不变）。
 */
export async function upsertStructuredCatalogAlias(
  db: Pool | PoolClient,
  input: StructuredAliasInput,
): Promise<void> {
  await db.query(
    `INSERT INTO media_catalog_aliases
       (catalog_id, alias, lang, region, script, kind, confidence, source)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (catalog_id, alias)
     DO UPDATE SET
       lang       = COALESCE(media_catalog_aliases.lang, EXCLUDED.lang),
       region     = COALESCE(media_catalog_aliases.region, EXCLUDED.region),
       script     = COALESCE(media_catalog_aliases.script, EXCLUDED.script),
       kind       = COALESCE(media_catalog_aliases.kind, EXCLUDED.kind),
       confidence = CASE
                      WHEN media_catalog_aliases.confidence IS NULL
                       AND EXCLUDED.confidence IS NULL THEN NULL
                      ELSE GREATEST(
                        COALESCE(media_catalog_aliases.confidence, 0),
                        COALESCE(EXCLUDED.confidence, 0)
                      )
                    END
     WHERE media_catalog_aliases.source <> 'manual'`,
    [
      input.catalogId,
      input.alias,
      input.lang,
      input.region,
      input.script,
      input.kind,
      input.confidence,
      input.source,
    ],
  )
}
