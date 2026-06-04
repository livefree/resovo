/**
 * catalog-external-refs-backfill.ts — media_catalog 四外部 ID 列回填映射表
 * （ADR-177 D-177-10 + AMENDMENT D-177-12 / CHG-VIR-12-C / Phase 5c）
 *
 * 迁移分级（D-177-12 / dev 事实基线 2026-06-03）：
 *   bangumi  cache 非 NULL（169）→ relation='exact' external_kind='subject' is_primary=true
 *            （UNIQUE 约束保证一对一，逐值不破坏 / D-177-10 既定）
 *   douban   cache 非 NULL（75）→ relation='candidate' external_kind='subject' is_primary=false
 *            （YY-D 保守底线维持：写入源 auto 富集，candidate 误绑零成本 vs exact 误绑
 *             占用索引①全局槽位 —— 升 exact 路径 = 上卷 job manual_confirmed 一致 / 人工）
 *   imdb/tmdb cache 非 NULL（实测 0）→ **仅报告不迁移**：external_kind（show/season/movie）
 *            事后推断不可靠（YY-D），非 0 时交富集实装卡在写入时按数据形态判定，本脚本不猜测
 *
 * 不变量：
 *   - 纯 INSERT，**不动四列 cache 现值**（过渡期 findOrCreate 读 cache 行为逐值零变更）
 *   - source 按 locked_fields 取 manual/auto（D-177-10「source 按字段 provenance/locked」）
 *   - 幂等：WHERE NOT EXISTS（同 catalog_id+provider+external_id+external_kind+relation），
 *     candidate 不进 partial unique 故不能依赖 ON CONFLICT —— 统一 NOT EXISTS 口径
 *   - 单事务（apply 模式整批 BEGIN/COMMIT，失败整体回滚）
 *
 * 运行（默认 dry-run 只读报告）：
 *   node --env-file=.env.local --import tsx scripts/catalog-external-refs-backfill.ts [--apply]
 *
 * 迁移后核验：scripts/report-catalog-identity-consistency.ts（三口径 + 半回填态扫描）
 */

import { db } from '@/api/lib/postgres'

const ROLLUP_RULE = 'cache-column-backfill-12c'
const LINKED_BY = 'backfill-script'

interface ProviderSpec {
  provider: 'bangumi' | 'douban'
  cacheCol: string
  /** cache 列是 INT（bangumi）时转文本（external_id 统一 TEXT / D-177-1） */
  castText: boolean
  externalKind: 'subject'
  relation: 'exact' | 'candidate'
  isPrimary: boolean
}

/** D-177-12 迁移分级真源（imdb/tmdb 不在列 = 仅报告不迁移） */
const MIGRATE_SPECS: ProviderSpec[] = [
  { provider: 'bangumi', cacheCol: 'bangumi_subject_id', castText: true, externalKind: 'subject', relation: 'exact', isPrimary: true },
  { provider: 'douban', cacheCol: 'douban_id', castText: false, externalKind: 'subject', relation: 'candidate', isPrimary: false },
]

/** 仅报告（kind 推断不可靠，不猜测）的 provider → cache 列 */
const REPORT_ONLY: ReadonlyArray<readonly [string, string]> = [
  ['imdb', 'imdb_id'],
  ['tmdb', 'tmdb_id'],
]

function buildInsertSql(spec: ProviderSpec): { insertSql: string; countSql: string; params: unknown[] } {
  const extExpr = spec.castText ? `mc.${spec.cacheCol}::text` : `mc.${spec.cacheCol}`
  // source：locked_fields 命中 → manual，否则 auto（locked 实测 0，按契约写）
  const fromWhere = `
    FROM media_catalog mc
    WHERE mc.${spec.cacheCol} IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM catalog_external_refs r
        WHERE r.catalog_id = mc.id
          AND r.provider = $1
          AND r.external_id = ${extExpr}
          AND r.external_kind = $2
          AND r.relation = $3
      )`
  return {
    insertSql: `
      INSERT INTO catalog_external_refs
        (catalog_id, provider, external_id, external_kind, relation,
         confidence, source, is_primary, linked_by, rollup_rule)
      SELECT mc.id, $1, ${extExpr}, $2, $3,
             NULL,
             CASE WHEN $4 = ANY(mc.locked_fields) THEN 'manual' ELSE 'auto' END,
             $5, $6, $7
      ${fromWhere}`,
    countSql: `SELECT COUNT(*)::int AS n ${fromWhere}`,
    params: [spec.provider, spec.externalKind, spec.relation],
  }
}

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply')
  console.log(`catalog-external-refs-backfill — mode=${apply ? 'APPLY' : 'dry-run'}`)

  // 仅报告 provider（imdb/tmdb）：非 0 即显式告警留人工（不迁移不猜测 kind）
  for (const [provider, col] of REPORT_ONLY) {
    const r = await db.query<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM media_catalog WHERE ${col} IS NOT NULL`
    )
    const n = r.rows[0]?.n ?? 0
    if (n > 0) {
      console.warn(
        `[${provider}] cache 列 ${col} 非 NULL ${n} 行 — external_kind 事后推断不可靠（YY-D），` +
          `本脚本不迁移；交富集实装卡按写入时数据形态判定`
      )
    } else {
      console.log(`[${provider}] cache 列空，no-op（D-177-12 既定）`)
    }
  }

  const client = await db.connect()
  try {
    if (apply) await client.query('BEGIN')
    for (const spec of MIGRATE_SPECS) {
      const { insertSql, countSql, params } = buildInsertSql(spec)
      const pending = await client.query<{ n: number }>(countSql, params)
      const n = pending.rows[0]?.n ?? 0
      console.log(
        `[${spec.provider}] 待回填 ${n} 行 → relation='${spec.relation}' kind='${spec.externalKind}'` +
          `${spec.isPrimary ? ' primary' : ''}（幂等 NOT EXISTS 口径）`
      )
      if (!apply || n === 0) continue
      const inserted = await client.query(insertSql, [
        ...params,
        spec.cacheCol, // $4 locked_fields 判定
        spec.isPrimary, // $5
        LINKED_BY, // $6
        ROLLUP_RULE, // $7
      ])
      console.log(`[${spec.provider}] 已插入 ${inserted.rowCount} 行（cache 列未触碰）`)
    }
    if (apply) await client.query('COMMIT')
  } catch (err) {
    if (apply) await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
  await db.end()
}

void main().catch((err: unknown) => {
  console.error(err)
  process.exit(1)
})
