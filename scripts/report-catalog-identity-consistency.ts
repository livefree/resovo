/**
 * report-catalog-identity-consistency.ts — catalog 身份层一致性只读报表
 * （ADR-177 AMENDMENT D-177-12 R-A2 三口径 + ADR-176 AMENDMENT D-176-9 R-A1 半回填态扫描
 *  / CHG-VIR-12-C / Phase 5c）
 *
 * Section 1 — catalog_external_refs ↔ 四列 cache 一致性三口径（R-A2 / 全 4 provider 通用）：
 *   HARD-1（exact↔cache 双向一致 / D-177-10「无未回填 exact」）：
 *     1a 存在 exact primary ref 但 cache 列 NULL 或值不一致 → 错误
 *     1b cache 非 NULL 且存在该 provider exact ref 但 external_id ≠ cache 值 → 错误
 *   REPORT-2（已知待升级清单 / douban 形态）：
 *     cache 非 NULL + 无 exact ref + 存在值一致 candidate ref → 列清单（非错误，
 *     升 exact 路径 = 上卷 job manual_confirmed 一致 / 人工确认）
 *   HARD-3（孤儿 cache / D-177-10「无孤儿 cache」）：
 *     cache 非 NULL + 映射表完全无该 (catalog, provider) 任何 ref → 迁移漏行/回填失败态，错误
 *
 * Section 2 — season_number 半回填态扫描（R-A1 / Y-B 结构化守卫）：
 *   同 (title_normalized, type) 簇内 season_number 部分 NULL / 部分非 NULL 的混存态。
 *   簇键不含 year（同系列各季 year 常不同；normalizeTitle 剥季 → 同系列同 normalized）——
 *   同名同 type 不同年的独立作品（翻拍）会进报告 = 已知 false positive，输出 year 明细
 *   供人工判读（报表宁可多报，不阻断）。
 *
 * 退出码：HARD 口径违规 > 0 → EXIT 1（可接 CI / runbook 前置检查）；REPORT 口径仅打印。
 *
 * 运行（纯只读）：
 *   node --env-file=.env.local --import tsx scripts/report-catalog-identity-consistency.ts
 */

import { db } from '@/api/lib/postgres'

/** provider → cache 列表达式（值取文本统一比较；bangumi/tmdb INT 转 text） */
const PROVIDER_CACHE: ReadonlyArray<readonly [provider: string, cacheExpr: string]> = [
  ['imdb', 'mc.imdb_id'],
  ['tmdb', 'mc.tmdb_id::text'],
  ['douban', 'mc.douban_id'],
  ['bangumi', 'mc.bangumi_subject_id::text'],
]

interface Row {
  catalog_id: string
  title: string
  detail: string
}

async function section1(): Promise<{ hard: number; report: number }> {
  let hard = 0
  let report = 0
  console.log('━━ Section 1：catalog_external_refs ↔ cache 一致性（三口径 / R-A2）━━')

  for (const [provider, cacheExpr] of PROVIDER_CACHE) {
    // HARD-1a：exact primary ref 但 cache NULL 或不一致（未回填 exact / cache 漂移）
    const h1a = await db.query<Row>(
      `SELECT r.catalog_id, mc.title,
              'exact ref=' || r.external_id || ' cache=' || COALESCE(${cacheExpr}, 'NULL') AS detail
         FROM catalog_external_refs r
         JOIN media_catalog mc ON mc.id = r.catalog_id
        WHERE r.provider = $1 AND r.relation = 'exact' AND r.is_primary
          AND (${cacheExpr} IS NULL OR ${cacheExpr} <> r.external_id)`,
      [provider]
    )
    // HARD-1b：cache 非 NULL 且存在 exact ref 但值不一致（cache 指向他值）
    const h1b = await db.query<Row>(
      `SELECT mc.id AS catalog_id, mc.title,
              'cache=' || ${cacheExpr} || ' exact ref=' || r.external_id AS detail
         FROM media_catalog mc
         JOIN catalog_external_refs r
           ON r.catalog_id = mc.id AND r.provider = $1 AND r.relation = 'exact'
        WHERE ${cacheExpr} IS NOT NULL AND r.external_id <> ${cacheExpr}`,
      [provider]
    )
    // REPORT-2：cache 非 NULL + 无 exact + 有值一致 candidate（待升级清单）
    const r2 = await db.query<{ n: number }>(
      `SELECT COUNT(*)::int AS n
         FROM media_catalog mc
        WHERE ${cacheExpr} IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM catalog_external_refs r
            WHERE r.catalog_id = mc.id AND r.provider = $1 AND r.relation = 'exact')
          AND EXISTS (
            SELECT 1 FROM catalog_external_refs r
            WHERE r.catalog_id = mc.id AND r.provider = $1
              AND r.relation = 'candidate' AND r.external_id = ${cacheExpr})`,
      [provider]
    )
    // HARD-3：孤儿 cache（映射表完全无任何 ref）
    const h3 = await db.query<Row>(
      `SELECT mc.id AS catalog_id, mc.title, 'orphan cache=' || ${cacheExpr} AS detail
         FROM media_catalog mc
        WHERE ${cacheExpr} IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM catalog_external_refs r
            WHERE r.catalog_id = mc.id AND r.provider = $1)`,
      [provider]
    )

    const hardRows = [...h1a.rows, ...h1b.rows, ...h3.rows]
    hard += hardRows.length
    report += r2.rows[0]?.n ?? 0
    console.log(
      `[${provider}] HARD-1a 未回填/漂移=${h1a.rowCount} HARD-1b cache 不一致=${h1b.rowCount} ` +
        `HARD-3 孤儿 cache=${h3.rowCount} REPORT-2 待升级=${r2.rows[0]?.n ?? 0}`
    )
    for (const row of hardRows.slice(0, 10)) {
      console.log(`  ✗ ${row.catalog_id.slice(0, 8)} "${row.title}" ${row.detail}`)
    }
  }
  return { hard, report }
}

async function section2(): Promise<number> {
  console.log('━━ Section 2：season_number 半回填态扫描（R-A1 / Y-B）━━')
  const r = await db.query<{
    title_normalized: string
    type: string
    null_rows: number
    season_rows: number
    detail: string
  }>(
    `SELECT title_normalized, type,
            COUNT(*) FILTER (WHERE season_number IS NULL)::int AS null_rows,
            COUNT(*) FILTER (WHERE season_number IS NOT NULL)::int AS season_rows,
            string_agg(
              COALESCE(year::text, '?') || '/S' || COALESCE(season_number::text, '-'),
              ', ' ORDER BY year NULLS LAST, season_number NULLS FIRST
            ) AS detail
       FROM media_catalog
      GROUP BY title_normalized, type
     HAVING COUNT(*) FILTER (WHERE season_number IS NULL) > 0
        AND COUNT(*) FILTER (WHERE season_number IS NOT NULL) > 0
      ORDER BY title_normalized`
  )
  console.log(`半回填态簇：${r.rowCount} 个（同 (title_normalized, type) 簇 NULL 与非 NULL 混存）`)
  for (const row of r.rows.slice(0, 30)) {
    console.log(
      `  ⚠ "${row.title_normalized}" [${row.type}] NULL=${row.null_rows} 显式季=${row.season_rows}` +
        `（year/S 明细: ${row.detail}）→ 需系列归位裁定（D-176-9）`
    )
  }
  return r.rowCount ?? 0
}

async function section3(): Promise<number> {
  // Y-A3（CHG-VIR-12-E）：冲突 candidate 可观测出口 —— 同 (provider, external_id) 被多个
  // catalog 共享 candidate = 跨 catalog exact 冲突 / D-177-4 归并信号簇（喂 12-F 合并候选）。
  console.log('━━ Section 3：冲突 candidate 簇（Y-A3 / same_work 合并候选输入）━━')
  const r = await db.query<{
    provider: string
    external_id: string
    catalogs: number
    rules: string
    titles: string
  }>(
    `SELECT r.provider, r.external_id,
            COUNT(DISTINCT r.catalog_id)::int AS catalogs,
            string_agg(DISTINCT COALESCE(r.rollup_rule, '-'), ',') AS rules,
            string_agg(DISTINCT mc.title, ' / ' ORDER BY mc.title) AS titles
       FROM catalog_external_refs r
       JOIN media_catalog mc ON mc.id = r.catalog_id
      WHERE r.relation = 'candidate'
      GROUP BY r.provider, r.external_id
     HAVING COUNT(DISTINCT r.catalog_id) > 1
      ORDER BY catalogs DESC, r.provider, r.external_id`
  )
  console.log(`冲突簇：${r.rowCount} 个（多 catalog 共享同 candidate 外部 ID）`)
  for (const row of r.rows.slice(0, 30)) {
    console.log(
      `  ⚑ ${row.provider}:${row.external_id} × ${row.catalogs} catalog（rule: ${row.rules}）"${row.titles}"`
    )
  }
  return r.rowCount ?? 0
}

async function main(): Promise<void> {
  console.log('report-catalog-identity-consistency — 只读报表')
  const { hard, report } = await section1()
  const mixed = await section2()
  const clusters = await section3()
  console.log('━━ 汇总 ━━')
  console.log(`HARD 违规=${hard}（exact↔cache 不一致 + 孤儿 cache）`)
  console.log(`REPORT 待升级=${report}（cache 有值仅 candidate，升 exact 走上卷/人工）`)
  console.log(`半回填态簇=${mixed}（报告性质，需人工系列归位；翻拍同名为已知 false positive）`)
  console.log(`冲突 candidate 簇=${clusters}（same_work 合并候选信号，12-F 输入）`)
  await db.end()
  if (hard > 0) {
    console.error('✗ HARD 口径违规 > 0 — 迁移漏行 / cache 漂移，须处置后重跑')
    process.exit(1)
  }
  console.log('✓ HARD 口径全绿')
}

void main().catch((err: unknown) => {
  console.error(err)
  process.exit(1)
})
