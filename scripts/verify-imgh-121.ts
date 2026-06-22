/**
 * verify-imgh-121.ts — IMGH-P4-0M（migration 121）真库回填演练核验（一次性，0M 收口后可删）
 *
 * 复用 migrate.ts 同款连接（process.env.DATABASE_URL，经 --env-file=.env.local 注入）。
 * 跑法（项目根目录）：
 *   node --env-file=.env.local --import tsx scripts/verify-imgh-121.ts
 *
 * 核验 3 项（ADR-213 D-213-2/3/8）：
 *   ① checked_at 全 NULL（migration 不回填，禁 updated_at 代理，R3-HIGH）
 *   ② client_error_at 被 seed 的行数（每 kind，观察用）
 *   ③ URL 守卫·无误 seed：被 seed 但追不到「当前 URL 未解决 client_load_error」的行 → 应=0（misseed，R2-HIGH-1）
 *   ④ 无漏 seed/非空操作：该 seed（有当前 URL 未解决 client_load_error）却 client_error_at 仍 NULL 的行 → 应=0（missed）
 *      ③+④ 同为 0 ⟺ seeded 集恰等于 expected 集；④ 专防「空操作回填假 PASS」（Codex stop-gate）。
 */

import { Pool } from 'pg'

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
  process.stderr.write('✗ 未读到 DATABASE_URL（请用 node --env-file=.env.local --import tsx ...）\n')
  process.exit(1)
}

const KINDS: Array<{ kind: string; urlCol: string }> = [
  { kind: 'poster', urlCol: 'cover_url' },
  { kind: 'backdrop', urlCol: 'backdrop_url' },
  { kind: 'logo', urlCol: 'logo_url' },
  { kind: 'banner_backdrop', urlCol: 'banner_backdrop_url' },
]

async function main(): Promise<void> {
  const db = new Pool({ connectionString: DATABASE_URL })
  try {
    // ① checked_at 全 NULL
    const checked = await db.query<Record<string, string>>(
      `SELECT
         count(*) FILTER (WHERE poster_checked_at IS NOT NULL)          AS poster,
         count(*) FILTER (WHERE backdrop_checked_at IS NOT NULL)        AS backdrop,
         count(*) FILTER (WHERE logo_checked_at IS NOT NULL)            AS logo,
         count(*) FILTER (WHERE banner_backdrop_checked_at IS NOT NULL) AS banner
       FROM media_catalog`,
    )
    const checkedRow = checked.rows[0] ?? {}
    const checkedNonNull = Object.values(checkedRow).reduce((s, v) => s + parseInt(v, 10), 0)

    // ② seeded ③ misseed（误 seed，URL 守卫）④ missed（漏 seed/空操作）⑤ expected（应 seed 集大小）
    // 同一「当前 URL 未解决 client_load_error in 窗口」EXISTS 谓词，分别在 seeded/NULL 上做 FILTER。
    let totalMisseed = 0
    let totalMissed = 0
    let totalExpected = 0
    const perKind: Array<{ kind: string; seeded: number; misseed: number; missed: number; expected: number }> = []
    for (const { kind, urlCol } of KINDS) {
      const signalCol = `${kind}_client_error_at`
      const matchExists = `EXISTS (
        SELECT 1 FROM broken_image_events b
        JOIN videos v ON v.id = b.video_id
        WHERE v.catalog_id = mc.id
          AND b.image_kind = $1
          AND b.event_type = 'client_load_error'
          AND b.resolved_at IS NULL
          AND b.url = mc.${urlCol}
          AND b.last_seen_at >= NOW() - INTERVAL '7 days'
      )`
      const res = await db.query<{ seeded: string; misseed: string; missed: string; expected: string }>(
        `SELECT
           count(*) FILTER (WHERE mc.${signalCol} IS NOT NULL)                       AS seeded,
           count(*) FILTER (WHERE mc.${signalCol} IS NOT NULL AND NOT ${matchExists}) AS misseed,
           count(*) FILTER (WHERE mc.${signalCol} IS NULL     AND ${matchExists})     AS missed,
           count(*) FILTER (WHERE ${matchExists})                                     AS expected
         FROM media_catalog mc`,
        [kind],
      )
      const seeded = parseInt(res.rows[0]?.seeded ?? '0', 10)
      const misseed = parseInt(res.rows[0]?.misseed ?? '0', 10)
      const missed = parseInt(res.rows[0]?.missed ?? '0', 10)
      const expected = parseInt(res.rows[0]?.expected ?? '0', 10)
      totalMisseed += misseed
      totalMissed += missed
      totalExpected += expected
      perKind.push({ kind, seeded, misseed, missed, expected })
    }

    // ── 报告 ──
    const out = process.stdout
    out.write('\n===== IMGH-P4-0M migration 121 回填演练核验 =====\n')
    out.write(`① checked_at 非 NULL 计数（应=0）：${checkedNonNull}\n`)
    out.write('②~⑤ 每 kind（misseed 应=0 误seed / missed 应=0 漏seed·防空操作 / expected=应seed集）：\n')
    for (const { kind, seeded, misseed, missed, expected } of perKind) {
      out.write(`   ${kind.padEnd(16)} seeded=${seeded}\texpected=${expected}\tmisseed=${misseed}\tmissed=${missed}\n`)
    }
    if (totalExpected === 0) {
      out.write('\n⚠️ 注：真库当前无「当前 URL 未解决 client_load_error in 7d」事件（expected=0）→ seeded=0 是数据现实、非回填 bug；\n')
      out.write('   但本次演练无法正向证明回填 SQL 在有数据时生效（如需强证可临造一条当前 URL 事件重跑）。\n')
    }

    const pass = checkedNonNull === 0 && totalMisseed === 0 && totalMissed === 0
    out.write(`\n结论：${pass ? '✅ PASS（checked_at 全 NULL + seeded 集恰=expected 集：无误 seed 且无漏 seed）' : '❌ FAIL'}\n`)
    if (!pass) {
      if (checkedNonNull !== 0) out.write('  ✗ checked_at 不应被回填——检查 migration 121 是否误回填\n')
      if (totalMisseed !== 0) out.write('  ✗ misseed≠0：存在「旧 URL 误 seed」——URL 守卫未生效\n')
      if (totalMissed !== 0) out.write('  ✗ missed≠0：存在「该 seed 却漏 seed」——回填 SQL 空操作/谓词写错（Codex stop-gate 防的就是这个）\n')
    }
    process.exitCode = pass ? 0 : 1
  } finally {
    await db.end()
  }
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err)
  process.stderr.write(`✗ 核验脚本出错：${msg}\n`)
  process.exit(1)
})
