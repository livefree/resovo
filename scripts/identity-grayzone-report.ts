/**
 * scripts/identity-grayzone-report.ts — GOV-7（SEQ-20260612-03）：候选阈值灰区 + 召回缺口评估
 *
 * **纯只读**：镜像 offlineRescore 的 blocking 遍历（core_title_key ∪ external_id 桶，
 * MAX_BUCKET 护栏 + 全局 seen 去重），逐 pair scorePair **不持久化**，产出：
 *   1. identityScore 分布直方（含 ≥CANDIDATE_MIN_THRESHOLD 即既有候选区 / 灰区 / 低分区）
 *   2. 灰区 [0.55, 0.75) 近阈值 top 清单（标题 + 分值 + 强负原因）——阈值调优的事实输入
 *   3. titleEn 召回缺口：共享英文名但 coreTitleKey 桶不同的 catalog 组（等值桶永不互见）
 *
 * 不动评分管线 / 阈值 / 依赖（简繁折叠需 OpenCC = 技术栈外依赖，BLOCKER 级决策不在本脚本）。
 *
 * 用法：node --env-file=.env.local --import tsx scripts/identity-grayzone-report.ts
 */

import { Pool } from 'pg'
import { TITLE_PARSER_VERSION } from '@/api/services/TitleIdentityParser'
import { fetchCoreKeyBuckets, fetchExternalIdBuckets, type BlockingBucket } from '@/api/services/identity/blockingRecall'
import { buildSides } from '@/api/services/identity/pairScoringPersist'
import { scorePair } from '@/api/services/identity/scorePair'
import { CANDIDATE_MIN_THRESHOLD } from '@/api/services/identity/weights'

const BATCH_SIZE = 500
const MAX_BUCKET = 50
const GRAY_MIN = 0.55
const TOP_N = 20

interface GrayPair {
  left: string
  right: string
  score: number
  strongNegative: readonly string[]
}

/** GRAY-SLICE 谓词模拟（Opus 裁决事实输入）：同 coreTitleKey + 无强负 + 阈下。 */
interface SlicePair extends GrayPair {
  blockingReasons: readonly string[]
}

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) throw new Error('DATABASE_URL 未设置')
  const pool = new Pool({ connectionString: databaseUrl })

  try {
    const seen = new Set<string>()
    let pairsScored = 0
    let blocked = 0
    let candidateZone = 0 // ≥ 0.75（既有候选区）
    const bins = new Map<number, number>() // 整数化分箱（×100 / 5 步长，修浮点误差）
    const grayPairs: GrayPair[] = []
    const slicePairs: SlicePair[] = [] // 切片谓词命中（阈下 + 同 key + 无强负）
    let oversizeBuckets = 0

    const processBuckets = async (buckets: BlockingBucket[]): Promise<void> => {
      for (const bucket of buckets) {
        if (bucket.videoIds.length > MAX_BUCKET) {
          oversizeBuckets++
          continue
        }
        const pairs: [string, string][] = []
        const ids = [...bucket.videoIds].sort()
        for (let i = 0; i < ids.length; i++) {
          for (let j = i + 1; j < ids.length; j++) {
            const key = `${ids[i]}|${ids[j]}`
            if (seen.has(key)) continue
            seen.add(key)
            pairs.push([ids[i]!, ids[j]!])
          }
        }
        if (pairs.length === 0) continue
        const sideMap = await buildSides(pool, [...new Set(pairs.flat())])
        for (const [l, r] of pairs) {
          const left = sideMap.get(l)
          const right = sideMap.get(r)
          if (!left || !right) continue
          const s = scorePair(left, right)
          pairsScored++
          if (s.strongNegativeReasons.length > 0) blocked++
          // 整数化分箱（修 0.60/0.05 浮点 floor 误降箱）
          const binKey = Math.floor(Math.round(s.identityScore * 100) / 5) * 5
          bins.set(binKey, (bins.get(binKey) ?? 0) + 1)
          if (s.identityScore >= CANDIDATE_MIN_THRESHOLD) candidateZone++
          else if (s.identityScore >= GRAY_MIN) {
            grayPairs.push({ left: l, right: r, score: s.identityScore, strongNegative: s.strongNegativeReasons })
          }
          // GRAY-SLICE 谓词模拟：阈下 + core_title_key_equal + 无强负（year 冲突已被强负覆盖）
          if (
            s.identityScore < CANDIDATE_MIN_THRESHOLD
            && s.strongNegativeReasons.length === 0
            && s.blockingReasons.includes('core_title_key_equal')
          ) {
            slicePairs.push({
              left: l, right: r, score: s.identityScore,
              strongNegative: s.strongNegativeReasons, blockingReasons: s.blockingReasons,
            })
          }
        }
      }
    }

    let cursor = ''
    for (;;) {
      const buckets = await fetchCoreKeyBuckets(pool, TITLE_PARSER_VERSION, cursor, BATCH_SIZE)
      if (buckets.length === 0) break
      await processBuckets(buckets)
      cursor = buckets[buckets.length - 1]!.bucketKey
    }
    let extCursor = ''
    for (;;) {
      const buckets = await fetchExternalIdBuckets(pool, extCursor, BATCH_SIZE)
      if (buckets.length === 0) break
      await processBuckets(buckets)
      extCursor = buckets[buckets.length - 1]!.bucketKey
    }

    console.log('═══ 1. identityScore 分布（blocking 可达 pair 全集，只读不持久化）═══')
    console.log(`pair 总数=${pairsScored} / 强负拦截=${blocked} / 候选区 ≥${CANDIDATE_MIN_THRESHOLD}=${candidateZone} / 灰区 [${GRAY_MIN},${CANDIDATE_MIN_THRESHOLD})=${grayPairs.length}`)
    for (const [bin, n] of [...bins.entries()].sort((a, b) => b[0] - a[0])) {
      console.log(`  [${(bin / 100).toFixed(2)}, ${((bin + 5) / 100).toFixed(2)}): ${n}`)
    }

    console.log('\n═══ 1b. GRAY-SLICE 谓词模拟（阈下 + 同 coreTitleKey + 无强负）═══')
    const byScore = new Map<number, SlicePair[]>()
    for (const p of slicePairs) {
      const k = Math.round(p.score * 100)
      const list = byScore.get(k)
      if (list) list.push(p)
      else byScore.set(k, [p])
    }
    console.log(`谓词命中总数=${slicePairs.length}`)
    const sliceTitleIds = [...new Set(slicePairs.flatMap((p) => [p.left, p.right]))]
    const sliceTitleMap = new Map<string, string>()
    for (let i = 0; i < sliceTitleIds.length; i += 500) {
      const { rows } = await pool.query<{ id: string; title: string }>(
        `SELECT id, title FROM videos WHERE id = ANY($1::uuid[])`, [sliceTitleIds.slice(i, i + 500)],
      )
      for (const r of rows) sliceTitleMap.set(r.id, r.title)
    }
    for (const [k, list] of [...byScore.entries()].sort((a, b) => b[0] - a[0])) {
      console.log(`  score=${(k / 100).toFixed(2)}：${list.length} 对；证据形态=${list[0]!.blockingReasons.join('+')}`)
      for (const p of list.slice(0, 5)) {
        console.log(`    「${sliceTitleMap.get(p.left) ?? p.left}」↔「${sliceTitleMap.get(p.right) ?? p.right}」`)
      }
    }

    console.log(`\n═══ 2. 灰区近阈值 top ${TOP_N}（阈值调优事实输入）═══`)
    grayPairs.sort((a, b) => b.score - a.score)
    const topPairs = grayPairs.slice(0, TOP_N)
    const titleIds = [...new Set(topPairs.flatMap((p) => [p.left, p.right]))]
    const titleMap = new Map<string, string>()
    if (titleIds.length > 0) {
      const { rows } = await pool.query<{ id: string; title: string }>(
        `SELECT id, title FROM videos WHERE id = ANY($1::uuid[])`, [titleIds],
      )
      for (const r of rows) titleMap.set(r.id, r.title)
    }
    for (const p of topPairs) {
      const sn = p.strongNegative.length > 0 ? ` 强负=${p.strongNegative.join(',')}` : ''
      console.log(`  ${p.score.toFixed(2)} 「${titleMap.get(p.left) ?? p.left}」↔「${titleMap.get(p.right) ?? p.right}」${sn}`)
    }

    console.log('\n═══ 3. titleEn 召回缺口（共享英文名但 coreTitleKey 桶不互见）═══')
    const { rows: enGap } = await pool.query<{ title_en: string; titles: string[] }>(
      `SELECT lower(trim(mc.title_en)) AS title_en, array_agg(DISTINCT mc.title) AS titles
       FROM media_catalog mc
       JOIN videos v ON v.catalog_id = mc.id AND v.deleted_at IS NULL
       WHERE mc.title_en IS NOT NULL AND trim(mc.title_en) <> ''
       GROUP BY 1
       HAVING COUNT(DISTINCT mc.title_normalized) > 1
       ORDER BY 1 LIMIT 30`,
    )
    console.log(`共享 title_en 但 title_normalized 不同的组：${enGap.length}${enGap.length === 30 ? '+（截断 30）' : ''}`)
    for (const g of enGap.slice(0, 10)) {
      console.log(`  「${g.title_en}」: ${g.titles.map((t) => `「${t}」`).join(' ')}`)
    }
  } finally {
    await pool.end()
  }
}

main().catch((err) => {
  console.error('[identity-grayzone-report] 失败：', err)
  process.exitCode = 2
})
