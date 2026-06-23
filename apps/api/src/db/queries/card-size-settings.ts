// card-size-settings.ts — card_size_settings 表 DB 查询（ADR-214 D-214-3，仿 home-section-settings.ts）
// 所有 SQL 参数化，不拼接字符串（db-rules.md）
// seed 3 行恒存在（migration 124）；不可删（无 DELETE 路径，档位退役走 ADR-214 amendment + migration）

import type { Pool } from 'pg'
import type {
  CardSizeClass,
  CardSizeSettings,
  UpdateCardSizeSettingsInput,
} from '@/types'

// ── DB 行类型 ────────────────────────────────────────────────────────────────

interface DbCardSizeSettingsRow {
  id: string
  size_class: string
  desktop_columns: number | null
  card_width_px: number | null
  gap_px: number
  settings: Record<string, unknown>
  updated_at: string
}

const COLUMNS = `id, size_class, desktop_columns, card_width_px, gap_px,
                 settings, updated_at::TEXT AS updated_at`

function mapRow(row: DbCardSizeSettingsRow): CardSizeSettings {
  return {
    id: row.id,
    sizeClass: row.size_class as CardSizeClass,
    desktopColumns: row.desktop_columns,
    cardWidthPx: row.card_width_px,
    gapPx: row.gap_px,
    settings: row.settings,
    updatedAt: row.updated_at,
  }
}

// ── 查询 ─────────────────────────────────────────────────────────────────────

/** 全量 3 行（CardSizeClass 枚举序由消费层排序，DB 按 size_class 字典序返回） */
export async function listCardSizeSettings(db: Pool): Promise<CardSizeSettings[]> {
  const result = await db.query<DbCardSizeSettingsRow>(
    `SELECT ${COLUMNS} FROM card_size_settings ORDER BY size_class ASC`,
  )
  return result.rows.map(mapRow)
}

export async function findCardSizeSettings(
  db: Pool,
  sizeClass: CardSizeClass,
): Promise<CardSizeSettings | null> {
  const result = await db.query<DbCardSizeSettingsRow>(
    `SELECT ${COLUMNS} FROM card_size_settings WHERE size_class = $1`,
    [sizeClass],
  )
  return result.rows[0] ? mapRow(result.rows[0]) : null
}

/**
 * 部分更新（动态 SET；settings JSONB 整体替换语义，D-214-4）。
 * sizeClass 不可改（业务键）；档位×单位绑定由 DB CHECK + 调用方 zod 双层守（CARD-SIZE-SERVICE-ADMIN）。
 */
export async function updateCardSizeSettings(
  db: Pool,
  sizeClass: CardSizeClass,
  input: UpdateCardSizeSettingsInput,
): Promise<CardSizeSettings | null> {
  const sets: string[] = []
  const values: unknown[] = []
  let i = 1

  const fieldMap: ReadonlyArray<[keyof UpdateCardSizeSettingsInput, string, (v: unknown) => unknown]> = [
    ['desktopColumns', 'desktop_columns', (v) => v],
    ['cardWidthPx', 'card_width_px', (v) => v],
    ['gapPx', 'gap_px', (v) => v],
    ['settings', 'settings', (v) => JSON.stringify(v)],
  ]

  for (const [key, column, serialize] of fieldMap) {
    if (input[key] !== undefined) {
      sets.push(`${column} = $${i}`)
      values.push(serialize(input[key]))
      i += 1
    }
  }

  if (sets.length === 0) return findCardSizeSettings(db, sizeClass)

  values.push(sizeClass)
  const result = await db.query<DbCardSizeSettingsRow>(
    `UPDATE card_size_settings SET ${sets.join(', ')}
      WHERE size_class = $${i}
      RETURNING ${COLUMNS}`,
    values,
  )
  return result.rows[0] ? mapRow(result.rows[0]) : null
}
