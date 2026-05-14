/**
 * scripts/migrate.ts — 数据库迁移执行器
 *
 * 用法：
 *   npm run migrate         — 实际执行 pending migration
 *   npm run migrate:check   — 干跑 dry-run（不执行；输出 pending 数量 + 文件列表）
 *   # 或直接运行：
 *   node --env-file=.env.local --import tsx scripts/migrate.ts [--dry-run]
 *
 * 逻辑：
 *   1. 确保 schema_migrations 表存在（记录已执行的迁移）
 *   2. 读取 src/api/db/migrations/*.sql，按文件名排序
 *   3. 跳过已执行的，只运行新增的
 *   4. 每条迁移在独立事务中执行，失败则回滚并报错退出
 *   --dry-run（CHG-SN-6-CI-MIGRATE-DRY-RUN / RETRO 3/7）：仅报告 pending，不执行；
 *      退出码：0 = 全 applied（无 pending） / 1 = 有 pending（需用户决策） / 2 = 脚本错误
 *      preflight 头部用 `migrate:check` 防 dev DB 滞后（CHG-SN-5-13-PATCH-2 类问题根因）
 */

import { readdir, readFile } from 'fs/promises'
import { join } from 'path'
import { Pool } from 'pg'

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
  process.stderr.write('❌  DATABASE_URL 未设置，请检查 .env.local\n')
  process.exit(1)
}

const db = new Pool({ connectionString: DATABASE_URL })

const MIGRATIONS_DIR = join(process.cwd(), 'apps/api/src/db/migrations')

const DRY_RUN = process.argv.includes('--dry-run')

async function main() {
  const client = await db.connect()

  try {
    // ── 确保迁移记录表存在 ─────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename   VARCHAR(200) PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `)

    // ── 读取已执行的迁移 ──────────────────────────────────────
    const { rows: applied } = await client.query<{ filename: string }>(
      'SELECT filename FROM schema_migrations ORDER BY filename'
    )
    const appliedSet = new Set(applied.map((r) => r.filename))

    // ── 读取迁移文件（只处理 .sql） ────────────────────────────
    const allFiles = await readdir(MIGRATIONS_DIR)
    const sqlFiles = allFiles
      .filter((f) => f.endsWith('.sql'))
      .sort()

    const pending = sqlFiles.filter((f) => !appliedSet.has(f))

    if (pending.length === 0) {
      process.stdout.write('✅  所有迁移均已是最新，无需执行。\n')
      return
    }

    // CHG-SN-6-CI-MIGRATE-DRY-RUN / RETRO 3/7：干跑模式只报告 pending，不执行
    if (DRY_RUN) {
      process.stderr.write(`⚠️  pending 迁移 ${pending.length} 条（dry-run）：\n`)
      for (const f of pending) process.stderr.write(`   ▶  ${f}\n`)
      process.stderr.write('\n修复：跑 `npm run migrate` 实际执行迁移；CI 环境部署前必须 migration 应用完整\n')
      process.exit(1)  // 退出码 1 标记"有 pending 待应用"，CI / preflight 可基于此报警
    }

    process.stdout.write(`📋  待执行迁移 ${pending.length} 条：\n`)

    // ── 逐一执行 ──────────────────────────────────────────────
    for (const filename of pending) {
      process.stdout.write(`   ▶  ${filename} … `)
      const sql = await readFile(join(MIGRATIONS_DIR, filename), 'utf-8')

      try {
        await client.query('BEGIN')
        await client.query(sql)
        await client.query(
          'INSERT INTO schema_migrations (filename) VALUES ($1)',
          [filename]
        )
        await client.query('COMMIT')
        process.stdout.write('✅\n')
      } catch (err) {
        await client.query('ROLLBACK')
        process.stderr.write(`\n❌  迁移失败：${filename}\n`)
        process.stderr.write(`   ${err instanceof Error ? err.message : String(err)}\n`)
        process.exit(1)
      }
    }

    process.stdout.write(`\n🎉  成功执行 ${pending.length} 条迁移。\n`)
  } finally {
    client.release()
    await db.end()
  }
}

main().catch((err) => {
  process.stderr.write(`❌  ${err instanceof Error ? err.message : String(err)}\n`)
  process.exit(1)
})
