// home-section-settings.ts — home_section_settings 表 DB 查询（ADR-182 D-182-3）
// 所有 SQL 参数化，不拼接字符串（db-rules.md）
// seed 7 行恒存在（migration 095）；不可删（无 DELETE 路径，section 退役走 ADR + migration）

import type { Pool } from 'pg'
import type {
  HomeSectionKey,
  HomeSectionSettings,
  UpdateHomeSectionSettingsInput,
} from '@/types'

// ── DB 行类型 ────────────────────────────────────────────────────────────────

interface DbSectionSettingsRow {
  id: string
  section: string
  autofill_mode: string
  refresh_interval_minutes: number | null
  display_count: number
  allow_duplicates: boolean
  pinned_limit: number | null
  settings: Record<string, unknown>
  updated_at: string
}

const COLUMNS = `id, section, autofill_mode, refresh_interval_minutes,
                 display_count, allow_duplicates, pinned_limit, settings,
                 updated_at::TEXT AS updated_at`

function mapRow(row: DbSectionSettingsRow): HomeSectionSettings {
  return {
    id: row.id,
    section: row.section as HomeSectionKey,
    autofillMode: row.autofill_mode as HomeSectionSettings['autofillMode'],
    refreshIntervalMinutes: row.refresh_interval_minutes,
    displayCount: row.display_count,
    allowDuplicates: row.allow_duplicates,
    pinnedLimit: row.pinned_limit,
    settings: row.settings,
    updatedAt: row.updated_at,
  }
}

// ── 查询 ─────────────────────────────────────────────────────────────────────

/** 全量 7 行（HomeSectionKey 枚举序由 Service 层排序，DB 按 section 字典序返回） */
export async function listHomeSectionSettings(db: Pool): Promise<HomeSectionSettings[]> {
  const result = await db.query<DbSectionSettingsRow>(
    `SELECT ${COLUMNS} FROM home_section_settings ORDER BY section ASC`,
  )
  return result.rows.map(mapRow)
}

export async function findHomeSectionSettings(
  db: Pool,
  section: HomeSectionKey,
): Promise<HomeSectionSettings | null> {
  const result = await db.query<DbSectionSettingsRow>(
    `SELECT ${COLUMNS} FROM home_section_settings WHERE section = $1`,
    [section],
  )
  return result.rows[0] ? mapRow(result.rows[0]) : null
}

/** 部分更新（动态 SET；settings JSONB 整体替换语义，D-182-4 #3） */
export async function updateHomeSectionSettings(
  db: Pool,
  section: HomeSectionKey,
  input: UpdateHomeSectionSettingsInput,
): Promise<HomeSectionSettings | null> {
  const sets: string[] = []
  const values: unknown[] = []
  let i = 1

  const fieldMap: ReadonlyArray<[keyof UpdateHomeSectionSettingsInput, string, (v: unknown) => unknown]> = [
    ['autofillMode', 'autofill_mode', (v) => v],
    ['refreshIntervalMinutes', 'refresh_interval_minutes', (v) => v],
    ['displayCount', 'display_count', (v) => v],
    ['allowDuplicates', 'allow_duplicates', (v) => v],
    ['pinnedLimit', 'pinned_limit', (v) => v],
    ['settings', 'settings', (v) => JSON.stringify(v)],
  ]

  for (const [key, column, serialize] of fieldMap) {
    if (input[key] !== undefined) {
      sets.push(`${column} = $${i}`)
      values.push(serialize(input[key]))
      i += 1
    }
  }

  if (sets.length === 0) return findHomeSectionSettings(db, section)

  values.push(section)
  const result = await db.query<DbSectionSettingsRow>(
    `UPDATE home_section_settings SET ${sets.join(', ')}
      WHERE section = $${i}
      RETURNING ${COLUMNS}`,
    values,
  )
  return result.rows[0] ? mapRow(result.rows[0]) : null
}

/** 各 section pinned 计数（sections 端点摘要用；banner → home_banners，其余 → home_modules） */
export async function countPinnedBySection(db: Pool): Promise<Record<string, number>> {
  const result = await db.query<{ section: string; cnt: string }>(
    `SELECT slot AS section, COUNT(*)::TEXT AS cnt FROM home_modules
      WHERE slot != 'banner'
      GROUP BY slot
     UNION ALL
     SELECT 'banner' AS section, COUNT(*)::TEXT AS cnt FROM home_banners`,
  )
  const counts: Record<string, number> = {}
  for (const row of result.rows) counts[row.section] = parseInt(row.cnt, 10)
  return counts
}
