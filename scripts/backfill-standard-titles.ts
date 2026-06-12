/**
 * scripts/backfill-standard-titles.ts — VIDEO-NAMING-STANDARD-B：存量显示标题清洗
 *
 * VIDEO-NAMING-STANDARD-A 把采集写入路径切到 buildStandardVideoTitle（季标带空格
 * 间隔 + 语言/画质/更新态噪声剥离），但存量行仍是旧格式（实测 videos 季标粘连 257 /
 * 噪声 15，media_catalog 粘连 232）。本脚本一次性收敛：
 *
 *   1. 圈定季标粘连（`...第N季` 前无空格）或含高置信噪声 token 的行；
 *   2. buildStandardVideoTitle 重派生显示标题（必须 TS 调用，纯 SQL 复刻必漂移，
 *      同 backfill-merge-key R5 口径）；
 *   3. **只更新 `videos.title` / `media_catalog.title` 显示标题**——不动
 *      `title_normalized`（归并键，ADR-174）/ `season_number` / `slug` / `short_id`，
 *      不拆旧三元组期误合并实体（后者归 VIDEO-NAMING-STANDARD-C 盘点）；
 *   4. videos 旧标题先 upsert 入 `video_aliases` 溯源（catalog 旧标题不另存：
 *      可经其下 videos 的 aliases/title_observations 溯源，catalog 别名体系
 *      〔D-175〕语义独立，不混入）；
 *   5. 改动的 videos 行走 VideoIndexSyncService.syncVideo ES 重同步 + refresh 后
 *      收敛断言（同 resync-es-short-id 口径）。
 *
 * 用法：
 *   node --env-file=.env.local --import tsx scripts/backfill-standard-titles.ts [--dry-run]
 *
 * dry-run：全程不写库不写 ES，逐行打印 `old → new` 供人工核对。
 *
 * 幂等可重入：UPDATE 仅在派生标题 IS DISTINCT FROM 现值时执行；重跑 updated=0。
 *
 * 已知副作用：media_catalog 行更新会经 trg_media_catalog_updated_at 触发器 bump
 * updated_at（无条件 NEW.updated_at = NOW()，不可绕过）——标题确为内容变更，语义成立。
 * videos 行受 trg_videos_state_machine 校验：本脚本不触碰状态列，但存量行若本身
 * 处于非法状态组合会在 touch 时抛错——按行捕获、汇总报告、不中断整批。
 */

import { Pool } from 'pg'
import { buildStandardVideoTitle } from '@/api/services/TitleIdentityParser'
import { upsertVideoAliases } from '@/api/db/queries/videos'
// GOV-4（SEQ-20260612-03 缺陷 B）：批量标题清洗 = 制造合并候选的时机——新标题写当前
// 版本观测使 blocking 召回可命中（每日 reconcile 重扫自动消化；急需则手动 inline 重扫）
import { insertObservationIfAbsent } from '@/api/db/queries/titleObservations'
import { buildTitleObservation } from '@/api/services/titleObservation.builder'
import { es, ES_INDEX } from '@/api/lib/elasticsearch'
import { VideoIndexSyncService } from '@/api/services/VideoIndexSyncService'

const DRY_RUN = process.argv.includes('--dry-run')

/** 季标粘连：`第N季/部/卷` 且前一字符存在又非空白（行首季标不算粘连，是退化标题）。 */
const GLUED_SEASON_SQL = `title ~ '[^[:space:]]第[一二三四五六七八九十百零〇0-9]+[季部卷]'`

/**
 * 高置信噪声 token（与 TitleIdentityParser 各规则表对齐的子集）。
 * 刻意不含 `英语`/`字幕` 等可能撞作品名的低置信词——选行收窄、派生交给 parser 全量规则。
 */
const NOISY_TITLE_SQL = `title ~* '(国语|國語|粤语|粵語|普通话|国配|中字|中英字幕|双语字幕|内嵌字幕|內嵌字幕|无字幕|無字幕|更新至|已完结|已完結|大结局|大結局|抢先版|搶先版|1080[pi]|720[pi]|2160p|4k)'`

interface TitleRow {
  id: string
  title: string
}

interface PlannedChange {
  id: string
  oldTitle: string
  newTitle: string
}

/** 派生退化守卫：空串 / 单字 / 以季标开头（原题大概率只剩季标）→ 跳过待人工。 */
function isDegenerate(derived: string): boolean {
  if (derived.trim().length < 2) return true
  return /^第[一二三四五六七八九十百零〇0-9]+[季部卷]/.test(derived.trim())
}

function planChanges(rows: TitleRow[], suspects: PlannedChange[]): PlannedChange[] {
  const changes: PlannedChange[] = []
  for (const row of rows) {
    const derived = buildStandardVideoTitle(row.title).displayTitle
    if (derived === row.title) continue
    if (isDegenerate(derived)) {
      suspects.push({ id: row.id, oldTitle: row.title, newTitle: derived })
      continue
    }
    changes.push({ id: row.id, oldTitle: row.title, newTitle: derived })
  }
  return changes
}

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) throw new Error('DATABASE_URL 未设置，请检查 .env.local')
  const pool = new Pool({ connectionString: databaseUrl })
  const syncService = new VideoIndexSyncService(pool, es)

  try {
    const { rows: videoRows } = await pool.query<TitleRow>(
      `SELECT id, title FROM videos
       WHERE deleted_at IS NULL AND (${GLUED_SEASON_SQL} OR ${NOISY_TITLE_SQL})
       ORDER BY created_at`,
    )
    const { rows: catalogRows } = await pool.query<TitleRow>(
      `SELECT id, title FROM media_catalog
       WHERE ${GLUED_SEASON_SQL} OR ${NOISY_TITLE_SQL}
       ORDER BY created_at`,
    )

    const suspects: PlannedChange[] = []
    const videoChanges = planChanges(videoRows, suspects)
    const catalogChanges = planChanges(catalogRows, suspects)

    console.log(
      `[backfill-standard-titles] 圈定 videos ${videoRows.length} 行（待改 ${videoChanges.length}）` +
      ` / media_catalog ${catalogRows.length} 行（待改 ${catalogChanges.length}）` +
      ` / 退化跳过 ${suspects.length}`,
    )
    for (const s of suspects) {
      console.warn(`  [退化跳过] ${s.id} 「${s.oldTitle}」→「${s.newTitle}」（待人工处理）`)
    }

    if (DRY_RUN) {
      for (const c of videoChanges) console.log(`  [video]   ${c.id} 「${c.oldTitle}」→「${c.newTitle}」`)
      for (const c of catalogChanges) console.log(`  [catalog] ${c.id} 「${c.oldTitle}」→「${c.newTitle}」`)
      console.log('[backfill-standard-titles] --dry-run，不写库不写 ES')
      return
    }

    // ── videos：旧标题入 aliases → 更新 title（按行执行，状态机触发器异常不中断整批）──
    let videosUpdated = 0
    const videoFailures: Array<{ id: string; error: string }> = []
    for (const c of videoChanges) {
      try {
        await upsertVideoAliases(pool, c.id, [c.oldTitle])
        await pool.query(
          `UPDATE videos SET title = $2 WHERE id = $1 AND title IS DISTINCT FROM $2`,
          [c.id, c.newTitle],
        )
        // GOV-4：新标题观测（identity blocking 召回数据源；DO NOTHING 幂等）
        await insertObservationIfAbsent(pool, buildTitleObservation(c.id, c.newTitle, null))
        videosUpdated++
      } catch (err) {
        videoFailures.push({ id: c.id, error: err instanceof Error ? err.message : String(err) })
      }
    }

    // ── media_catalog：更新 title（updated_at 由触发器 bump，见头注）──
    let catalogsUpdated = 0
    const catalogFailures: Array<{ id: string; error: string }> = []
    for (const c of catalogChanges) {
      try {
        await pool.query(
          `UPDATE media_catalog SET title = $2 WHERE id = $1 AND title IS DISTINCT FROM $2`,
          [c.id, c.newTitle],
        )
        catalogsUpdated++
      } catch (err) {
        catalogFailures.push({ id: c.id, error: err instanceof Error ? err.message : String(err) })
      }
    }

    console.log(
      `[backfill-standard-titles] 写库完成：videos ${videosUpdated}/${videoChanges.length}` +
      ` / media_catalog ${catalogsUpdated}/${catalogChanges.length}`,
    )
    for (const f of [...videoFailures, ...catalogFailures]) {
      console.error(`  [失败] ${f.id}: ${f.error}`)
    }

    // ── ES 重同步（仅改动的 videos 行；syncVideo 失败只 warn 不抛，靠下方断言兜底）──
    let synced = 0
    for (const c of videoChanges) {
      await syncService.syncVideo(c.id)
      synced++
    }
    console.log(`[backfill-standard-titles] ES syncVideo ${synced} 条`)

    // ── 收敛断言：重扫应零待改（refresh 防 ES near-real-time 读旧 segment）──
    await es.indices.refresh({ index: ES_INDEX }).catch(() => undefined)
    const { rows: residualVideos } = await pool.query<TitleRow>(
      `SELECT id, title FROM videos
       WHERE deleted_at IS NULL AND (${GLUED_SEASON_SQL} OR ${NOISY_TITLE_SQL})`,
    )
    const residualSuspects: PlannedChange[] = []
    const residualChanges = planChanges(residualVideos, residualSuspects)
    if (residualChanges.length > 0 || videoFailures.length > 0 || catalogFailures.length > 0) {
      console.error(
        `[backfill-standard-titles] ⚠️ 未收敛：残留待改 ${residualChanges.length}` +
        ` / 写库失败 ${videoFailures.length + catalogFailures.length}（退化跳过 ${residualSuspects.length} 为预期）`,
      )
      process.exitCode = 1
    } else {
      console.log(
        `[backfill-standard-titles] 收敛断言通过（退化跳过 ${residualSuspects.length} 为预期，已逐行打印）`,
      )
    }
    // GOV-4：标题清洗后合并候选消化提示（观测已随更新写入；候选经每日 reconcile 自动重扫，
    // 急需立即可见则手动 run-identity-rescore-inline）
    if (videosUpdated > 0) {
      console.log(
        `[backfill-standard-titles] 提示：${videosUpdated} 个新标题观测已写入；合并候选将由每日` +
        ' identity-reconcile 重扫消化（立即消化：node --env-file=.env.local --import tsx scripts/run-identity-rescore-inline.ts）',
      )
    }
  } finally {
    await pool.end()
    await es.close()
  }
}

main().catch((err) => {
  console.error('[backfill-standard-titles] 失败：', err)
  process.exitCode = 2
})
