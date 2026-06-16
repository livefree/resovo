/**
 * catalog-multilingual-cleanup.ts — 多语种清洗三步脚本（ADR-175 / CHG-VIR-11-C / Phase 4c）
 *
 *   pinyin            title_en 拼音/罗马音迁出（R5/红线-2：catalog 层独立调 isPinyin，
 *                     不复用 video 层 title_en_is_pinyin）→ kind='romanization' alias
 *                     （lang='zh' script='Latn'）+ title_en 置 NULL（单事务/行）
 *   original-language original_language 确定性保守回填（Y-175-1：假名→ja / 谚文→ko /
 *                     纯 ASCII 非拼音→en / 汉字无假名按 country 映射 / 置信不足留 NULL）
 *   aliases-array     media_catalog.aliases[] 数组列→media_catalog_aliases 表迁移
 *                     （D-175-5 表为单一真源；数组列保留为只读缓存不清空；
 *                      lang/script/region NULL = Y-175-2 维度未就绪不选 primary）
 *
 * 锁尊重：软锁 locked_fields + 硬锁 video_metadata_locks(hard) 命中的行一律跳过。
 * 幂等：pinyin 迁出后 title_en=NULL 不再命中；alias upsert ON CONFLICT 升级口径（D-175-6）。
 *
 * 运行（默认 dry-run 只读报告）：
 *   node --env-file=.env.local --import tsx scripts/catalog-multilingual-cleanup.ts [--step=pinyin|original-language|aliases-array|all] [--apply]
 */

import { db } from '@/api/lib/postgres'
import { isPinyin, isPinyinTitle } from '@/api/services/PinyinDetector'
import { upsertStructuredCatalogAlias } from '@/api/db/queries/catalogAliases'

const STEPS = ['pinyin', 'original-language', 'aliases-array'] as const
type Step = (typeof STEPS)[number]

function parseArgs(): { steps: Step[]; apply: boolean } {
  const stepArg = process.argv.find((a) => a.startsWith('--step='))?.slice('--step='.length) ?? 'all'
  const apply = process.argv.includes('--apply')
  if (stepArg === 'all') return { steps: [...STEPS], apply }
  if ((STEPS as readonly string[]).includes(stepArg)) return { steps: [stepArg as Step], apply }
  console.error(`无效 --step=${stepArg}（可选：${STEPS.join(' / ')} / all）`)
  process.exit(1)
}

/** 软锁 + 硬锁过滤子句（$N = field name 参数位） */
const NOT_LOCKED = (fieldParam: string) => `
  NOT (${fieldParam} = ANY(mc.locked_fields))
  AND NOT EXISTS (
    SELECT 1 FROM video_metadata_locks vml
    WHERE vml.catalog_id = mc.id AND vml.field_name = ${fieldParam} AND vml.lock_mode = 'hard'
  )`

// ── Step 1：title_en 拼音迁出（R5）─────────────────────────────────

async function stepPinyin(apply: boolean): Promise<void> {
  const rows = await db.query<{ id: string; title_en: string }>(
    `SELECT mc.id, mc.title_en
       FROM media_catalog mc
      WHERE mc.title_en IS NOT NULL AND mc.title_en <> ''
        AND ${NOT_LOCKED('$1')}
      ORDER BY mc.id`,
    ['title_en'],
  )
  // CHG-VIR-11-E：统一正典口径 isPinyinTitle（= isPinyin ∪ isConcatenatedPinyin ∪ 剥数字后连写拼音），
  // 与入库门禁同源，消除红线-2 独立判定漂移；含季数/年份的数字拼音（"geleisidi6ji"）一并命中。
  const hits = rows.rows.filter((r) => r.title_en != null && isPinyinTitle(r.title_en))
  console.log(`[pinyin] title_en 非空候选 ${rows.rows.length}，catalog 层判定命中 ${hits.length}`)
  for (const h of hits.slice(0, 20)) console.log(`  样例: ${h.id.slice(0, 8)} "${h.title_en}"`)
  if (!apply) return

  let migrated = 0
  for (const h of hits) {
    const client = await db.connect()
    try {
      await client.query('BEGIN')
      // 拼音 = 中文标题的拉丁转写 → lang='zh' script='Latn'（确定性）；来源保守标 crawler
      await upsertStructuredCatalogAlias(client, {
        catalogId: h.id,
        alias: h.title_en,
        lang: 'zh',
        region: null,
        script: 'Latn',
        kind: 'romanization',
        confidence: null,
        source: 'crawler',
      })
      // 乐观幂等：title_en 已被并发改动则不动（影响 0 行，alias 已落无害）
      await client.query(
        `UPDATE media_catalog SET title_en = NULL, updated_at = NOW()
          WHERE id = $1 AND title_en = $2`,
        [h.id, h.title_en],
      )
      await client.query('COMMIT')
      migrated++
    } catch (err) {
      await client.query('ROLLBACK')
      console.error(`  迁出失败 ${h.id}: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      client.release()
    }
  }
  console.log(`[pinyin] 已迁出 ${migrated}/${hits.length}（alias kind='romanization' + title_en→NULL）`)
}

// ── Step 2：original_language 回填（Y-175-1 确定性保守）────────────

const KANA = /[぀-ヿ]/        // 平假名 + 片假名 → ja
const HANGUL = /[가-힯]/      // 谚文 → ko
const CJK_HAN = /[一-鿿]/     // 汉字（zh/ja 歧义，须 country 辅助）
// eslint-disable-next-line no-control-regex
const NON_ASCII = /[^\x00-\x7F]/

/** country → 汉字标题的语种映射（确定性；不在表内 → 不推断留 NULL） */
const HAN_COUNTRY_LANG: Record<string, string> = {
  '日本': 'ja',
  '中国大陆': 'zh-Hans',
  '中国': 'zh-Hans',
  '内地': 'zh-Hans',
  '香港': 'zh-Hant',
  '中国香港': 'zh-Hant',
  '台湾': 'zh-Hant',
  '中国台湾': 'zh-Hant',
}

/** 确定性保守推断（置信不足返回 null = 不回填） */
export function inferOriginalLanguage(titleOriginal: string, country: string | null): string | null {
  if (KANA.test(titleOriginal)) return 'ja'
  if (HANGUL.test(titleOriginal)) return 'ko'
  if (!NON_ASCII.test(titleOriginal)) {
    // 纯 ASCII：拼音/罗马音不是语种原标题（不回填）；其余拉丁 → en
    return isPinyin(titleOriginal) ? null : 'en'
  }
  if (CJK_HAN.test(titleOriginal)) {
    return HAN_COUNTRY_LANG[country ?? ''] ?? null
  }
  return null
}

async function stepOriginalLanguage(apply: boolean): Promise<void> {
  const rows = await db.query<{ id: string; title_original: string; country: string | null }>(
    `SELECT mc.id, mc.title_original, mc.country
       FROM media_catalog mc
      WHERE mc.original_language IS NULL
        AND mc.title_original IS NOT NULL AND mc.title_original <> ''
        AND ${NOT_LOCKED('$1')}
      ORDER BY mc.id`,
    ['original_language'],
  )
  const inferred = rows.rows
    .map((r) => ({ id: r.id, lang: inferOriginalLanguage(r.title_original, r.country), title: r.title_original }))
    .filter((r): r is { id: string; lang: string; title: string } => r.lang !== null)
  const byLang = new Map<string, number>()
  for (const r of inferred) byLang.set(r.lang, (byLang.get(r.lang) ?? 0) + 1)
  console.log(`[original-language] 候选 ${rows.rows.length}，可确定性推断 ${inferred.length}（${[...byLang.entries()].map(([k, v]) => `${k}=${v}`).join(' / ')}），置信不足留 NULL ${rows.rows.length - inferred.length}`)
  for (const s of inferred.slice(0, 10)) console.log(`  样例: ${s.id.slice(0, 8)} "${s.title.slice(0, 30)}" → ${s.lang}`)
  if (!apply) return

  let updated = 0
  for (const r of inferred) {
    const res = await db.query(
      `UPDATE media_catalog SET original_language = $2, updated_at = NOW()
        WHERE id = $1 AND original_language IS NULL`,
      [r.id, r.lang],
    )
    updated += res.rowCount ?? 0
  }
  console.log(`[original-language] 已回填 ${updated}/${inferred.length}`)
}

// ── Step 3：aliases[] 数组列 → 表迁移（D-175-5）────────────────────

async function stepAliasesArray(apply: boolean): Promise<void> {
  const rows = await db.query<{ id: string; aliases: string[] }>(
    `SELECT mc.id, mc.aliases
       FROM media_catalog mc
      WHERE mc.aliases IS NOT NULL AND array_length(mc.aliases, 1) > 0
      ORDER BY mc.id`,
  )
  const pairs = rows.rows.flatMap((r) =>
    r.aliases.filter((a) => a.trim() !== '').map((a) => ({ catalogId: r.id, alias: a.trim() })),
  )
  console.log(`[aliases-array] 数组列非空 catalog ${rows.rows.length}，待迁移别名 ${pairs.length}（数组列保留为只读缓存）`)
  if (!apply) return

  let migrated = 0
  for (const p of pairs) {
    // 未结构化原始别名：kind='aka' 最中性；维度 NULL（Y-175-2 未就绪不选 primary）；来源保守标 crawler
    await upsertStructuredCatalogAlias(db, {
      catalogId: p.catalogId,
      alias: p.alias,
      lang: null,
      region: null,
      script: null,
      kind: 'aka',
      confidence: null,
      source: 'crawler',
    })
    migrated++
  }
  console.log(`[aliases-array] 已迁移 ${migrated}/${pairs.length}`)
}

// ── main ──────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const { steps, apply } = parseArgs()
  console.log(`catalog-multilingual-cleanup — steps=[${steps.join(', ')}] mode=${apply ? 'APPLY' : 'dry-run'}`)
  for (const step of steps) {
    if (step === 'pinyin') await stepPinyin(apply)
    else if (step === 'original-language') await stepOriginalLanguage(apply)
    else await stepAliasesArray(apply)
  }
  await db.end()
}

void main().catch((err: unknown) => {
  console.error(err)
  process.exit(1)
})
