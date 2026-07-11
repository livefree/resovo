/**
 * video-play-stats-schema.test.ts — migration 128 视频播放统计 schema 真实 PG 集成验证
 * （ADR-216 / SEQ-20260624-02 STATS-02-SCHEMA）
 *
 * 防回归：mock 单测不验真 schema → 建表 DDL/约束/索引偏离全程被隐藏。本套件只读 catalog
 *   （pg_index / pg_get_indexdef / pg_get_expr / pg_get_constraintdef / pg_constraint / information_schema），
 *   **精确**断言 ADR-216 冻结的 schema 形状（非仅"名字存在"——防错误定义漂移假阳性，Codex HIGH/MEDIUM）。
 *
 * 零副作用：仅查系统目录，不写/读任何 video_play_* 数据行。
 *
 * 运行前提（同 tests/helpers/integration-pg.ts）：dev DB up + migrate 至 ≥128 + DATABASE_URL（.env.local）。
 *   独立 vitest.integration.config.ts，不入 test:changed。
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Pool } from 'pg'
import { createIntegrationPool } from '../../helpers/integration-pg'

const STATS_TABLES = [
  'video_play_events',
  'video_play_hourly',
  'video_play_daily',
  'video_play_daily_visitors',
  'video_play_totals',
  'video_hot_scores',
] as const

let db: Pool

beforeAll(() => {
  db = createIntegrationPool()
})

afterAll(async () => {
  await db.end()
})

/** 取 video_play_events 上某索引的完整定义（pg_get_indexdef）+ 唯一性 + partial 谓词。 */
async function getIndex(
  name: string,
): Promise<{ def: string; isUnique: boolean; pred: string | null } | null> {
  const { rows } = await db.query<{ def: string; is_unique: boolean; pred: string | null }>(
    `SELECT pg_get_indexdef(idx.indexrelid) AS def,
            idx.indisunique AS is_unique,
            pg_get_expr(idx.indpred, idx.indrelid) AS pred
     FROM pg_index idx
     JOIN pg_class i ON i.oid = idx.indexrelid
     WHERE i.relname = $1`,
    [name],
  )
  const row = rows[0]
  return row ? { def: row.def, isUnique: row.is_unique, pred: row.pred } : null
}

describe('migration 128 — video play stats schema', () => {
  it('6 张表均存在', async () => {
    const { rows } = await db.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = ANY($1)`,
      [STATS_TABLES],
    )
    const found = new Set(rows.map((r) => r.table_name))
    for (const t of STATS_TABLES) {
      expect(found.has(t), `表 ${t} 应存在`).toBe(true)
    }
  })

  it('第一防线：idempotency_key 单列唯一约束（显式命名 uq_video_play_events_idempotency_key，D-216-8）', async () => {
    const idx = await getIndex('uq_video_play_events_idempotency_key')
    expect(idx, '显式命名的 idempotency_key 唯一索引应存在').not.toBeNull()
    expect(idx?.isUnique, '应为 UNIQUE').toBe(true)
    // 单列：定义末尾为 (idempotency_key)，不含逗号（排除误建复合唯一）
    expect(idx?.def).toMatch(/\(\s*idempotency_key\s*\)\s*$/)
    expect(idx?.pred, '第一防线为全表唯一、非 partial').toBeNull()
  })

  it('第二防线：uq_video_play_events_session_video_episode null-safe 唯一索引精确成形（D-216-8）', async () => {
    const idx = await getIndex('uq_video_play_events_session_video_episode')
    expect(idx, '第二防线唯一索引应存在').not.toBeNull()
    expect(idx?.isUnique, '应为 UNIQUE').toBe(true)
    // 列序 + null-safe 表达式精确成形：play_session_id, video_id, COALESCE(episode_number, 0)
    expect(idx?.def).toMatch(
      /\(\s*play_session_id\s*,\s*video_id\s*,\s*COALESCE\(episode_number,\s*0\)\s*\)/i,
    )
  })

  it('pending 索引为 partial（WHERE aggregated_at IS NULL）on (ingested_at)（D-216-10 取数）', async () => {
    const idx = await getIndex('idx_video_play_events_pending')
    expect(idx, 'pending 索引应存在').not.toBeNull()
    expect(idx?.def).toMatch(/\(\s*ingested_at\s*\)/) // key 列
    expect(idx?.pred ?? '', 'partial 谓词应为 aggregated_at IS NULL').toMatch(
      /aggregated_at\s+IS\s+NULL/i,
    )
  })

  it('daily_visitors(bucket_date) 清理索引存在（D-216-6 retention）', async () => {
    const idx = await getIndex('idx_video_play_daily_visitors_date')
    expect(idx, 'daily_visitors 清理索引应存在').not.toBeNull()
    expect(idx?.def).toMatch(/\(\s*bucket_date\s*\)/)
  })

  it('video_play_events.visitor_is_ephemeral 为 BOOLEAN NOT NULL DEFAULT false（D-216-7）', async () => {
    const { rows } = await db.query<{
      data_type: string
      is_nullable: string
      column_default: string | null
    }>(
      `SELECT data_type, is_nullable, column_default
       FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'video_play_events'
         AND column_name = 'visitor_is_ephemeral'`,
    )
    expect(rows.length, 'visitor_is_ephemeral 列应存在').toBe(1)
    expect(rows[0]?.data_type).toBe('boolean')
    expect(rows[0]?.is_nullable).toBe('NO')
    expect(rows[0]?.column_default ?? '').toMatch(/false/i)
  })

  it('video_play_events.occurred_at 为 trusted 字段（TIMESTAMPTZ NOT NULL，D-216-9）', async () => {
    const { rows } = await db.query<{ is_nullable: string; data_type: string }>(
      `SELECT is_nullable, data_type FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'video_play_events'
         AND column_name = 'occurred_at'`,
    )
    expect(rows.length).toBe(1)
    expect(rows[0]?.is_nullable, 'occurred_at 应 NOT NULL').toBe('NO')
    expect(rows[0]?.data_type).toBe('timestamp with time zone')
  })

  it('event_type CHECK 为封闭单值枚举 qualified_play（精确，L3 扩展口；Codex MEDIUM）', async () => {
    const { rows } = await db.query<{ conname: string; def: string }>(
      `SELECT conname, pg_get_constraintdef(oid) AS def
       FROM pg_constraint
       WHERE conrelid = 'video_play_events'::regclass AND contype = 'c'`,
    )
    const eventTypeChecks = rows.filter((r) => /event_type/.test(r.def))
    expect(eventTypeChecks.length, 'event_type CHECK 约束应存在').toBeGreaterThanOrEqual(1)
    // PG 把 IN ('qualified_play') 单值归一为 = 'qualified_play'::text；该形态证明"仅一个允许值"（封闭枚举）。
    // 若未来放宽为多值会变 ANY(ARRAY[...])，本断言即失败 → 防意外放宽。
    expect(
      eventTypeChecks.some((r) => /event_type\s*=\s*'qualified_play'::text/.test(r.def)),
      `event_type CHECK 应为单值 = 'qualified_play'，实际：${eventTypeChecks.map((r) => r.def).join(' | ')}`,
    ).toBe(true)
  })

  it('video_play_events 外键 ON DELETE 行为精确（video_id CASCADE / source_id·user_id SET NULL；Codex LOW）', async () => {
    // confdeltype：c=CASCADE, n=SET NULL, a=NO ACTION
    const { rows } = await db.query<{ col: string; confdeltype: string }>(
      `SELECT a.attname AS col, c.confdeltype
       FROM pg_constraint c
       JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
       WHERE c.conrelid = 'video_play_events'::regclass AND c.contype = 'f'
         AND array_length(c.conkey, 1) = 1`,
    )
    const byCol = new Map(rows.map((r) => [r.col, r.confdeltype]))
    expect(byCol.get('video_id'), 'video_id FK 应 ON DELETE CASCADE').toBe('c')
    expect(byCol.get('source_id'), 'source_id FK 应 ON DELETE SET NULL').toBe('n')
    expect(byCol.get('user_id'), 'user_id FK 应 ON DELETE SET NULL').toBe('n')
  })

  it('聚合表主键成形（hourly/daily 复合 PK；totals/hot_scores 单列 video_id PK）', async () => {
    const pkOf = async (table: string): Promise<string> => {
      const { rows } = await db.query<{ def: string }>(
        `SELECT pg_get_constraintdef(oid) AS def
         FROM pg_constraint
         WHERE conrelid = $1::regclass AND contype = 'p'`,
        [table],
      )
      return rows[0]?.def ?? ''
    }
    expect(await pkOf('video_play_hourly')).toMatch(/PRIMARY KEY \(video_id, bucket_hour\)/)
    expect(await pkOf('video_play_daily')).toMatch(/PRIMARY KEY \(video_id, bucket_date\)/)
    expect(await pkOf('video_play_daily_visitors')).toMatch(
      /PRIMARY KEY \(video_id, bucket_date, visitor_hash\)/,
    )
    expect(await pkOf('video_play_totals')).toMatch(/PRIMARY KEY \(video_id\)/)
    expect(await pkOf('video_hot_scores')).toMatch(/PRIMARY KEY \(video_id\)/)
  })
})
