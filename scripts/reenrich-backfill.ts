/**
 * scripts/reenrich-backfill.ts — 批量重富集 backfill 入队（META-15-C / SEQ-20260530-04）
 *
 * 把「从未富集 / 富集未命中」的存量视频重新入 enrichment-queue，让 douban(网络 step2) +
 * bangumi(META-17 REST 兜底) + 角色(META-19) 真正填充。复用 enrichmentQueue（保留 attempts/
 * backoff/removeOnComplete 配置 → 瞬时失败自动重试，对 bangumi REST 兜底语义关键）。
 *
 * 用法：
 *   node --env-file=.env.local --import tsx scripts/reenrich-backfill.ts [选项]
 * 选项：
 *   --mode <never|unmatched|missing-characters|tmdb-missing|all>  默认 all
 *       never=meta_quality NULL / unmatched=douban|bangumi 未命中 /
 *       missing-characters=anime 无 catalog_characters（含已 matched anime，补 META-19 角色）/
 *       tmdb-missing=catalog 无 tmdb_id 且类型可匹配 TMDB（META-51-B，TMDB 首次回填用）/
 *       all=前三者并集（不含 tmdb-missing）
 *   --type <anime|movie|tv|...>   仅某类型（可选）
 *   --limit <N>                   仅前 N 条（小批验证用）
 *   --dry-run                     只统计不入队
 *
 * 注意：需 Redis + enrichment worker 运行（apps/api server.ts:194）。worker concurrency=2 限流，
 *       全量 ~数千条会持续数十分钟逐步消化。
 *       jobId 用 `backfill-<runTs>-<id>`（每次运行唯一）—— **不复用爬虫的 `enrich-<id>`**，
 *       避免与残留（delayed/completed 保留 200/failed 保留 50）job 撞 id 被 Bull 静默跳过而漏跑。
 */

import { db } from '@/api/lib/postgres'
import { enrichmentQueue } from '@/api/lib/queue'
import { listVideosForBackfillEnrich, type BackfillEnrichMode } from '@/api/db/queries/videos'
import type { EnrichJobData } from '@/api/services/MetadataEnrichService'
import type { VideoType } from '@/types'

// ── CLI ────────────────────────────────────────────────────────────

function parseArgs(): { mode: BackfillEnrichMode; type: VideoType | undefined; limit: number | null; dryRun: boolean } {
  const args = process.argv.slice(2)
  const getOpt = (flag: string): string | null => {
    const i = args.indexOf(flag)
    return i !== -1 ? args[i + 1] ?? null : null
  }
  const rawMode = getOpt('--mode') ?? 'all'
  if (!['never', 'unmatched', 'missing-characters', 'tmdb-missing', 'all'].includes(rawMode)) {
    throw new Error(`--mode 非法：${rawMode}（应为 never|unmatched|missing-characters|tmdb-missing|all）`)
  }
  const rawLimit = getOpt('--limit')
  const limit = rawLimit != null ? Number.parseInt(rawLimit, 10) : null
  if (limit != null && (!Number.isFinite(limit) || limit <= 0)) {
    throw new Error(`--limit 非法：${rawLimit}`)
  }
  return {
    mode: rawMode as BackfillEnrichMode,
    type: (getOpt('--type') as VideoType | null) ?? undefined,
    limit,
    dryRun: args.includes('--dry-run'),
  }
}

// ── main ───────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const { mode, type, limit, dryRun } = parseArgs()
  process.stdout.write(
    `[reenrich-backfill] mode=${mode} type=${type ?? '*'} limit=${limit ?? '∞'} dryRun=${dryRun}\n`,
  )

  const rows = await listVideosForBackfillEnrich(db, { mode, type, limit: limit ?? undefined })
  process.stdout.write(`[reenrich-backfill] 命中待富集视频：${rows.length.toLocaleString()} 条\n`)

  if (dryRun) {
    const byType = new Map<string, number>()
    for (const r of rows) byType.set(r.type, (byType.get(r.type) ?? 0) + 1)
    const breakdown = [...byType.entries()].map(([t, n]) => `${t}:${n}`).join(' / ')
    process.stdout.write(`[reenrich-backfill] dry-run（未入队）类型分布：${breakdown || '—'}\n`)
    return
  }

  // 每次运行唯一前缀：避免与爬虫 `enrich-<id>` 及残留 job 撞 id 被 Bull 静默跳过（漏跑）。
  // 同一 run 内每视频唯一（query 返回去重视频）；enrich 幂等（COALESCE/safeUpdate），重复处理无害。
  const runTs = Date.now()
  let enqueued = 0
  for (const r of rows) {
    const data: EnrichJobData = {
      videoId: r.id,
      catalogId: r.catalog_id,
      title: r.title,
      year: r.year,
      type: r.type,
      trigger: 'backfill',
    }
    // 复用 enrichmentQueue defaultJobOptions（attempts/backoff/removeOnComplete）。
    // 无 delay（worker concurrency=2 自然限流）。
    await enrichmentQueue.add(data, { jobId: `backfill-${runTs}-${r.id}` })
    enqueued++
    if (enqueued % 200 === 0) {
      process.stdout.write(`\r[reenrich-backfill] 已入队：${enqueued.toLocaleString()} / ${rows.length.toLocaleString()}`)
    }
  }
  process.stdout.write(`\r[reenrich-backfill] 已入队：${enqueued.toLocaleString()} / ${rows.length.toLocaleString()} ✓\n`)
  process.stdout.write('[reenrich-backfill] 完成。worker (concurrency=2) 将逐步消化；查 enrichment-queue 日志跟踪。\n')
}

void main()
  .catch((err) => {
    const msg = err instanceof Error ? `${err.message}${err.stack ? `\n${err.stack}` : ''}` : JSON.stringify(err)
    process.stderr.write(`[reenrich-backfill] failed: ${msg}\n`)
    process.exitCode = 1
  })
  .finally(async () => {
    try { await enrichmentQueue.close() } catch { /* ignore close error */ }
    try { await db.end() } catch { /* ignore close error */ }
    // queue.ts 在 import 时创建多个 Bull 队列（各持 Redis 连接），显式退出避免进程悬挂。
    process.exit(process.exitCode ?? 0)
  })
