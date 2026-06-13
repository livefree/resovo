/**
 * scripts/gov6-entity-surgery.ts — GOV-6（SEQ-20260612-03）：存量实体手术（用户已逐例批准）
 *
 * 取证真源：docs/audit/cross-season-merge-audit-20260612.md §GOV-6（2026-06-12 用户批准全部 4 项）。
 * 暂缓 3 例（偶滴歌神啊/恶搞之家/动物管制官）不在本脚本——等重爬站点观测累积。
 *
 * 手术 1（掌心饵，驯娇记）：VideoMergesService.split 全划分（dbzy.tv 2 行 → 新 S2 video /
 *   mtzy.me 2 行 → 新 S1 video；原 video 软删，留审计可 unmerge）→ 拆后季位修正：
 *   原 catalog season=1，S2 video 迁入 findOrCreate 的 (掌心饵驯娇记, S2) catalog。
 * 手术 2（宠妻成瘾动态漫画）：catalog season=2 落位（存活 sources 已纯为 S2，零拆分）。
 * 手术 6（星辰变）：catalog c8f89de3 改题「星辰变 第5季」+ season=5（留 S5 video）；
 *   S7 video 迁入 findOrCreate 的 (星辰变, S7) catalog。
 * 手术 7（师兄啊师兄）：第2季 video 迁入 findOrCreate 的 (师兄啊师兄, S2) catalog；
 *   正篇留原 catalog（season NULL = 连续话数正篇语义）。
 * 手术 8（魔法使俱乐部 OVA）：catalog/video 标题标准化「魔法使俱乐部 OVA」+
 *   normalized 改「魔法使俱乐部 ova」消除与正篇撞 key。
 *
 * 幂等防线：每例前置 guard（已执行则跳过）；生产执行前必须重跑 audit-cross-season-merge。
 */

import { Pool } from 'pg'
import { es } from '@/api/lib/elasticsearch'
import { VideoMergesService } from '@/api/services/VideoMergesService'
import { MediaCatalogService } from '@/api/services/MediaCatalogService'
import { VideoIndexSyncService } from '@/api/services/VideoIndexSyncService'

const ACTOR_ADMIN_ID = 'c21d10ff-5a8a-4bed-b76e-6b97e97a48b7' // dev 库 admin（审计 performed_by）

const CASE1_VIDEO = '43f37d42-b5a5-4815-a22a-141f9ad715c5'
const CASE1_CATALOG = 'cf01f484-a096-40ed-bc1b-45b5f689f294'
const CASE1_DBZY_SOURCES = ['0245ab5d-d1cb-4757-9c57-fe0d6ad4a18c', 'd9889bf0-5021-4b2e-8084-1f63c0026d73']
const CASE2_CATALOG = '258bb189-0933-4884-8dad-aa505a7f65eb'
const CASE6_CATALOG = 'c8f89de3-edeb-405b-a70d-e6ccab67314a'
const CASE6_S7_VIDEO = 'fb4e0fb3-f485-4c61-8027-4e7ecda869d6'
const CASE7_CATALOG = 'dd85fa38-e37f-4a0d-9bb5-17aecbf86c54'
const CASE7_S2_VIDEO = '6e611cc6-2696-4b7a-94cd-119e87fed35c'
const CASE8_CATALOG = '6fca1485-01ec-4411-9133-f50c3519c54b'
const CASE8_VIDEO = '5fda8802-d22e-4a15-af17-6f11cbbe0f61'

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) throw new Error('DATABASE_URL 未设置')
  const pool = new Pool({ connectionString: databaseUrl })
  const mergesSvc = new VideoMergesService(pool)
  const catalogSvc = new MediaCatalogService(pool)
  const indexSync = new VideoIndexSyncService(pool, es)

  /** 迁 video 至按季 findOrCreate 的独立 catalog，返回 catalog id。 */
  async function moveVideoToSeasonCatalog(input: {
    videoId: string
    title: string
    titleNormalized: string
    type: string
    year: number | null
    seasonNumber: number
  }): Promise<string> {
    const { catalog } = await catalogSvc.findOrCreateWithMatch({
      title: input.title,
      titleNormalized: input.titleNormalized,
      type: input.type,
      year: input.year,
      seasonNumber: input.seasonNumber,
      metadataSource: 'manual',
    })
    await pool.query(`UPDATE videos SET catalog_id = $2 WHERE id = $1`, [input.videoId, catalog.id])
    await indexSync.syncVideo(input.videoId)
    return catalog.id
  }

  try {
    // ── 手术 1：掌心饵，驯娇记 拆分 ──
    const { rows: [c1Video] } = await pool.query<{ deleted: boolean }>(
      `SELECT deleted_at IS NOT NULL AS deleted FROM videos WHERE id = $1`, [CASE1_VIDEO],
    )
    if (!c1Video || c1Video.deleted) {
      console.log('[手术1] 原 video 已软删/不存在 → split 跳过（已执行过）')
    } else {
      const { rows: allSources } = await pool.query<{ id: string }>(
        `SELECT id FROM video_sources WHERE video_id = $1 AND deleted_at IS NULL`, [CASE1_VIDEO],
      )
      const dbzySet = new Set(CASE1_DBZY_SOURCES)
      const s1SourceIds = allSources.map((r) => r.id).filter((id) => !dbzySet.has(id))
      const result = await mergesSvc.split({
        videoId: CASE1_VIDEO,
        groups: [
          { sourceIds: s1SourceIds, newVideoMeta: { title: '掌心饵，驯娇记 第1季', year: 2026, type: 'short' } },
          { sourceIds: [...CASE1_DBZY_SOURCES], newVideoMeta: { title: '掌心饵，驯娇记 第2季', year: 2026, type: 'short' } },
        ],
      }, ACTOR_ADMIN_ID)
      console.log(`[手术1] split 完成 audit=${result.auditId} 新 videos=${result.newVideoIds.join(',')}`)
    }

    // 拆后季位修正**独立于 split guard 执行**（Codex 拦截：split 成功但修正中断后重跑，
    // split guard 会整段跳过 → 修正永久缺失。各自幂等 guard 自行收口）
    await pool.query(
      `UPDATE media_catalog SET season_number = 1 WHERE id = $1 AND season_number IS NULL`, [CASE1_CATALOG],
    )
    // S2 查找限定在原 catalog（split 的 findOrCreate 按旧三元组命中原 catalog）：
    // 已迁出 → 查不到 → 跳过；全局标题匹配会误伤同名无关视频（Codex 拦截一并修）
    const { rows: [s2Video] } = await pool.query<{ id: string }>(
      `SELECT id FROM videos
       WHERE catalog_id = $1 AND title = '掌心饵，驯娇记 第2季' AND deleted_at IS NULL LIMIT 1`,
      [CASE1_CATALOG],
    )
    if (s2Video) {
      const catId = await moveVideoToSeasonCatalog({
        videoId: s2Video.id, title: '掌心饵，驯娇记 第2季',
        titleNormalized: '掌心饵驯娇记', type: 'short', year: 2026, seasonNumber: 2,
      })
      console.log(`[手术1] S2 video ${s2Video.id} → catalog ${catId}（season=2）`)
    } else {
      console.log('[手术1] 无待迁 S2 video（已迁出或 split 未产出）→ 修正跳过')
    }

    // ── 手术 2：宠妻成瘾动态漫画 season=2 落位 ──
    const c2 = await pool.query(
      `UPDATE media_catalog SET season_number = 2 WHERE id = $1 AND season_number IS NULL`, [CASE2_CATALOG],
    )
    console.log(`[手术2] 宠妻成瘾 catalog season=2 落位（${c2.rowCount} 行；0=已执行过）`)

    // ── 手术 6：星辰变 catalog 重排 ──
    const c6 = await pool.query(
      `UPDATE media_catalog SET title = '星辰变 第5季', season_number = 5
       WHERE id = $1 AND season_number IS NULL`, [CASE6_CATALOG],
    )
    console.log(`[手术6] 星辰变 catalog → 第5季/season=5（${c6.rowCount} 行）`)
    const { rows: [s7Owner] } = await pool.query<{ catalog_id: string }>(
      `SELECT catalog_id FROM videos WHERE id = $1`, [CASE6_S7_VIDEO],
    )
    if (s7Owner?.catalog_id === CASE6_CATALOG) {
      const catId = await moveVideoToSeasonCatalog({
        videoId: CASE6_S7_VIDEO, title: '星辰变 第7季',
        titleNormalized: '星辰变', type: 'anime', year: 2025, seasonNumber: 7,
      })
      console.log(`[手术6] S7 video → catalog ${catId}（season=7）`)
    } else {
      console.log('[手术6] S7 video 已迁出 → 跳过')
    }

    // ── 手术 7：师兄啊师兄 第2季迁独立 catalog ──
    const { rows: [xz2Owner] } = await pool.query<{ catalog_id: string }>(
      `SELECT catalog_id FROM videos WHERE id = $1`, [CASE7_S2_VIDEO],
    )
    if (xz2Owner?.catalog_id === CASE7_CATALOG) {
      const catId = await moveVideoToSeasonCatalog({
        videoId: CASE7_S2_VIDEO, title: '师兄啊师兄 第2季',
        titleNormalized: '师兄啊师兄', type: 'anime', year: 2023, seasonNumber: 2,
      })
      console.log(`[手术7] 第2季 video → catalog ${catId}（season=2）；正篇留原 catalog（NULL=连续话数）`)
    } else {
      console.log('[手术7] 第2季 video 已迁出 → 跳过')
    }

    // ── 手术 8：魔法使俱乐部 OVA normalized 修正 ──
    const c8a = await pool.query(
      `UPDATE media_catalog SET title = '魔法使俱乐部 OVA', title_normalized = '魔法使俱乐部 ova'
       WHERE id = $1 AND title_normalized = '魔法使俱乐部'`, [CASE8_CATALOG],
    )
    const c8b = await pool.query(
      `UPDATE videos SET title = '魔法使俱乐部 OVA' WHERE id = $1 AND title = '魔法使俱乐部(OVA)'`, [CASE8_VIDEO],
    )
    // ES 同步无条件执行（Codex 拦截：title UPDATE 成功后 sync 前中断 → 重跑 rowCount=0
    // 不再 sync → ES 永久陈旧。单视频 sync 幂等且廉价，恒跑收口）
    await indexSync.syncVideo(CASE8_VIDEO)
    console.log(`[手术8] OVA catalog/video 修正（catalog ${c8a.rowCount} / video ${c8b.rowCount} 行；ES 恒同步）`)

    console.log('[gov6-entity-surgery] 全部手术完成；请复跑 audit-cross-season-merge 验证收敛')
  } finally {
    await pool.end()
    await es.close()
  }
}

main().catch((err) => {
  console.error('[gov6-entity-surgery] 失败：', err)
  process.exitCode = 2
})
