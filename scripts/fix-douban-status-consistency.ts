/**
 * scripts/fix-douban-status-consistency.ts — 存量矫正：douban_status=matched 但 catalog.douban_id 空
 * SEQ-20260607-01 / CHG-ENRICH-DOUBAN-CONSISTENCY-B（ADR-186 INV-1/INV-2 存量兜底）
 *
 * 背景：ADR-186 之前 MetadataEnrichService 三处 safeUpdate 不检查返回值无条件 return 'matched'，
 *   而 safeUpdate 有 4 条静默拒绝写 doubanId 路径（优先级整体拦截〔A 卡已修为 fill-if-empty〕/
 *   字段锁 / exact ref 冲突降级 / catalog 重绑脱钩）→ 列表豆瓣图标 matched 但编辑 douban_id 空。
 *
 * 矫正策略（数据安全网，不尝试自动补写——补写须走 enrich 完整逻辑 + 网络）：
 *   把虚标 matched 改为如实反映落地状态——
 *   - 该 video 存在 match_status='candidate' 的 douban ref → 重置 douban_status='candidate'
 *     （INV-2：保留人工确认锚点）。**仅当 candidate ref 实际存在时才降级 candidate**：审核台
 *     douban-candidate = DoubanService.getCandidateData 只查 match_status='candidate' 的 ref，
 *     若降级 candidate 却无 candidate ref，则列表显示候选黄点但点开无候选可确认 = unusable
 *     candidate 态（Codex stop-time review 修正）。
 *   - 否则（无 candidate ref：仅 auto_matched 虚标 ref / rejected / 孤儿 redirect 脱钩）→
 *     重置 douban_status='unmatched'（下次 enrich A 卡 fill-if-empty 生效时重新评估并写正确 ref）。
 *   矫正后这些 video 在下次 enrich 或人工 confirm 时正确收敛。
 *
 * 用法：
 *   node --env-file=.env.local --import tsx scripts/fix-douban-status-consistency.ts [--limit N] [--dry-run]
 *   --dry-run：仅圈定 + 打印拟变更（不写 DB）
 *
 * 仅处理 douban；bangumi_status 同构（follow-up：需要时复制本脚本改 provider/列名）。
 */

import { Pool } from 'pg'

// ── CLI ────────────────────────────────────────────────────────────

function parseArgs(): { limit: number | null; dryRun: boolean } {
  const args = process.argv.slice(2)
  const idx = args.indexOf('--limit')
  const limitRaw = idx !== -1 ? args[idx + 1] ?? null : null
  return {
    limit: limitRaw ? Number.parseInt(limitRaw, 10) : null,
    dryRun: args.includes('--dry-run'),
  }
}

// ── 圈定行 ──────────────────────────────────────────────────────────

interface OrphanRow {
  readonly id: string
  readonly douban_status: string
  /**
   * 该 video 是否存在 match_status='candidate' 的 douban ref。仅此为 true 才可安全降级
   * candidate——审核台 getCandidateData 查 candidate ref，否则候选态不可操作（unusable）。
   */
  readonly has_candidate_ref: boolean
}

/**
 * 圈定 douban_status=matched 但当前有效 catalog.douban_id IS NULL 的 video（INV-1 违反实例）。
 * has_candidate_ref：是否存在 match_status='candidate' 的 douban ref，区分降级目标
 * （candidate vs unmatched），保证降级 candidate 后审核台可操作（避免 unusable candidate 态）。
 */
async function findOrphans(db: Pool, limit: number | null): Promise<OrphanRow[]> {
  const result = await db.query<OrphanRow>(
    `SELECT v.id,
            v.douban_status,
            EXISTS(
              SELECT 1 FROM video_external_refs ver
               WHERE ver.video_id = v.id
                 AND ver.provider = 'douban'
                 AND ver.match_status = 'candidate'
            ) AS has_candidate_ref
       FROM videos v
       JOIN media_catalog mc ON mc.id = v.catalog_id
      WHERE v.douban_status = 'matched'
        AND mc.douban_id IS NULL
        AND v.deleted_at IS NULL
      ORDER BY v.created_at DESC
      ${limit !== null ? `LIMIT ${limit}` : ''}`,
  )
  return result.rows
}

/**
 * 降级目标：存在 candidate ref → candidate（审核台可操作，INV-2）；
 * 否则（仅 auto_matched 虚标 / rejected / 孤儿）→ unmatched（避免 unusable candidate 态）。
 */
function targetStatus(row: OrphanRow): 'candidate' | 'unmatched' {
  return row.has_candidate_ref ? 'candidate' : 'unmatched'
}

// ── 主流程 ──────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const { limit, dryRun } = parseArgs()

  const DATABASE_URL = process.env.DATABASE_URL
  if (!DATABASE_URL) {
    process.stderr.write('❌  DATABASE_URL 未设置\n')
    process.exit(1)
  }

  process.stdout.write('矫正：douban_status=matched 但 catalog.douban_id 空（ADR-186 INV-1）\n')
  if (limit) process.stdout.write(`限制行数：${limit}\n`)
  if (dryRun) process.stdout.write('模式：dry-run（仅圈定，不写 DB）\n')

  const db = new Pool({ connectionString: DATABASE_URL })
  try {
    const orphans = await findOrphans(db, limit)
    process.stdout.write(`\n圈定 ${orphans.length} 个 video（matched + catalog.douban_id 空）\n`)

    let toCandidate = 0
    let toUnmatched = 0
    for (const row of orphans) {
      const next = targetStatus(row)
      if (next === 'candidate') toCandidate++
      else toUnmatched++
      if (dryRun) {
        process.stdout.write(
          `  ${row.id}  matched → ${next}  (candidate_ref=${row.has_candidate_ref ? '有' : '无'})\n`,
        )
      }
    }

    if (dryRun) {
      process.stdout.write(
        `\n✅ dry-run 完成：→candidate ${toCandidate} / →unmatched ${toUnmatched}\n`,
      )
      return
    }

    // 执行：按降级目标分两批 UPDATE（candidate / unmatched），参数化 id 数组
    const candidateIds = orphans.filter((r) => targetStatus(r) === 'candidate').map((r) => r.id)
    const unmatchedIds = orphans.filter((r) => targetStatus(r) === 'unmatched').map((r) => r.id)

    const client = await db.connect()
    try {
      await client.query('BEGIN')
      if (candidateIds.length > 0) {
        await client.query(
          `UPDATE videos SET douban_status = 'candidate', updated_at = NOW() WHERE id = ANY($1::uuid[])`,
          [candidateIds],
        )
      }
      if (unmatchedIds.length > 0) {
        await client.query(
          `UPDATE videos SET douban_status = 'unmatched', updated_at = NOW() WHERE id = ANY($1::uuid[])`,
          [unmatchedIds],
        )
      }
      await client.query('COMMIT')
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }

    process.stdout.write(
      `✅ 完成：→candidate ${toCandidate} / →unmatched ${toUnmatched}\n`,
    )
  } catch (err) {
    process.stderr.write(`\n❌ 错误：${err instanceof Error ? err.message : String(err)}\n`)
    process.exit(1)
  } finally {
    await db.end()
  }
}

main()
