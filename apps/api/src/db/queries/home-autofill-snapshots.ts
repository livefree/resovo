// home-autofill-snapshots.ts — home_autofill_snapshots 表 DB 查询（ADR-183 D-183-2）
// 所有 SQL 参数化，不拼接字符串（db-rules.md）
// 快照不可变（写后零 UPDATE）；每 section 保留最近 10 份，写入与清理同事务。
// 清理不并发的前提 = D-183-3.3 单 section job 串行化（jobId 幂等键），不另加锁。

import type { Pool } from 'pg'
import type {
  AutofillCandidate,
  ContentGap,
  HomeAutofillSnapshot,
  HomeSectionKey,
} from '@/types'

/** 每 section 快照保留份数（D-183-2 保留策略；7 section × 10 = 行数上限 70） */
export const SNAPSHOT_RETENTION_PER_SECTION = 10

// ── DB 行类型 ────────────────────────────────────────────────────────────────

interface DbSnapshotRow {
  id: string
  section: string
  generated_at: string
  trigger: string
  policy_version: string
  settings_snapshot: Record<string, unknown>
  candidates: AutofillCandidate[]
  gaps: ContentGap[]
  created_at: string
}

const COLUMNS = `id, section, generated_at::TEXT AS generated_at, trigger,
                 policy_version, settings_snapshot, candidates, gaps,
                 created_at::TEXT AS created_at`

function mapRow(row: DbSnapshotRow): HomeAutofillSnapshot {
  return {
    id: row.id,
    section: row.section as HomeSectionKey,
    generatedAt: row.generated_at,
    trigger: row.trigger as HomeAutofillSnapshot['trigger'],
    policyVersion: row.policy_version,
    settingsSnapshot: row.settings_snapshot,
    candidates: row.candidates,
    gaps: row.gaps,
    createdAt: row.created_at,
  }
}

// ── 写入 ─────────────────────────────────────────────────────────────────────

export interface InsertSnapshotInput {
  readonly section: HomeSectionKey
  readonly trigger: 'scheduled' | 'manual'
  readonly policyVersion: string
  readonly settingsSnapshot: Record<string, unknown>
  readonly candidates: AutofillCandidate[]
  readonly gaps: ContentGap[]
}

/**
 * 写入新快照 + 同事务清理该 section 超龄份（保留最近 SNAPSHOT_RETENTION_PER_SECTION 份，
 * D-183-2 保留策略——全部成功或回滚，不留半写态）。
 */
export async function insertHomeAutofillSnapshot(
  db: Pool,
  input: InsertSnapshotInput,
): Promise<HomeAutofillSnapshot> {
  const client = await db.connect()
  try {
    await client.query('BEGIN')
    const inserted = await client.query<DbSnapshotRow>(
      `INSERT INTO home_autofill_snapshots
         (section, trigger, policy_version, settings_snapshot, candidates, gaps)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING ${COLUMNS}`,
      [
        input.section,
        input.trigger,
        input.policyVersion,
        JSON.stringify(input.settingsSnapshot),
        JSON.stringify(input.candidates),
        JSON.stringify(input.gaps),
      ],
    )
    await client.query(
      `DELETE FROM home_autofill_snapshots
        WHERE section = $1
          AND id NOT IN (
            SELECT id FROM home_autofill_snapshots
             WHERE section = $1
             ORDER BY generated_at DESC
             LIMIT $2
          )`,
      [input.section, SNAPSHOT_RETENTION_PER_SECTION],
    )
    await client.query('COMMIT')
    return mapRow(inserted.rows[0]!)
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

// ── 读取 ─────────────────────────────────────────────────────────────────────

/** 该 section 最新一份快照（端点 #4 唯一查询路径；无快照 → null = 未生成语义） */
export async function findLatestHomeAutofillSnapshot(
  db: Pool,
  section: HomeSectionKey,
): Promise<HomeAutofillSnapshot | null> {
  const result = await db.query<DbSnapshotRow>(
    `SELECT ${COLUMNS} FROM home_autofill_snapshots
      WHERE section = $1
      ORDER BY generated_at DESC
      LIMIT 1`,
    [section],
  )
  return result.rows[0] ? mapRow(result.rows[0]) : null
}

/** 各 section 最新快照摘要（端点 #2 lastSnapshotAt/candidateCount；候选数含 filtered 条目） */
export async function listLatestSnapshotSummaries(
  db: Pool,
): Promise<Record<string, { generatedAt: string; candidateCount: number }>> {
  const result = await db.query<{ section: string; generated_at: string; cnt: number }>(
    `SELECT DISTINCT ON (section)
            section, generated_at::TEXT AS generated_at,
            jsonb_array_length(candidates) AS cnt
       FROM home_autofill_snapshots
      ORDER BY section, generated_at DESC`,
  )
  const summaries: Record<string, { generatedAt: string; candidateCount: number }> = {}
  for (const row of result.rows) {
    summaries[row.section] = { generatedAt: row.generated_at, candidateCount: row.cnt }
  }
  return summaries
}
