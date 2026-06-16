/**
 * tests/unit/api/catalogAliasesList.test.ts — META-50-1A
 *
 * 验证 listCatalogAliases SQL 形状 + snake→camel mapper + NUMERIC confidence→number 收口（MUST-1A-5）。
 * 对齐 metadataFieldProposalsQueries.test.ts 范式（mock pg，断言 SQL/params/映射）。
 */

import { describe, it, expect, vi } from 'vitest'
import type { Pool } from 'pg'
import { listCatalogAliases } from '@/api/db/queries/catalogAliases'

const CID = 'cat-uuid-1'

function makeMockDb(rows: Record<string, unknown>[] = []) {
  let capturedSql = ''
  let capturedParams: unknown[] = []
  const db = {
    query: vi.fn(async (sql: string, params: unknown[]) => {
      capturedSql = sql
      capturedParams = params ?? []
      return { rows, rowCount: rows.length }
    }),
  } as unknown as Pool
  return {
    db,
    get sql() {
      return capturedSql
    },
    get params() {
      return capturedParams
    },
  }
}

describe('listCatalogAliases — SQL 形状', () => {
  it('不传 kinds：WHERE catalog_id=$1 无 kind 过滤 + ORDER BY confidence DESC NULLS LAST, alias ASC', async () => {
    const m = makeMockDb()
    await listCatalogAliases(m.db, CID)

    expect(m.sql).toContain('FROM media_catalog_aliases')
    expect(m.sql).toContain('WHERE catalog_id = $1')
    expect(m.sql).not.toContain('kind = ANY')
    expect(m.sql).toContain('ORDER BY confidence DESC NULLS LAST, alias ASC')
    expect(m.sql).toContain('alias, lang, region, script, kind, confidence, source, is_primary_for_locale')
    expect(m.params).toEqual([CID])
  })

  it('传 kinds：追加 AND kind = ANY($2) + params 含 kinds 数组', async () => {
    const m = makeMockDb()
    await listCatalogAliases(m.db, CID, ['official', 'romanization'])

    expect(m.sql).toContain('AND kind = ANY($2)')
    expect(m.params).toEqual([CID, ['official', 'romanization']])
  })

  it('空 kinds 数组：等价不过滤（kinds.length>0 守卫）', async () => {
    const m = makeMockDb()
    await listCatalogAliases(m.db, CID, [])

    expect(m.sql).not.toContain('kind = ANY')
    expect(m.params).toEqual([CID])
  })
})

describe('listCatalogAliases — mapper（MUST-1A-5）', () => {
  it('NUMERIC confidence string → number；null → null；snake→camel', async () => {
    const m = makeMockDb([
      {
        alias: '海贼王',
        lang: 'zh',
        region: null,
        script: 'Hans',
        kind: 'localized',
        confidence: '0.90', // NUMERIC node-pg 返 string
        source: 'douban',
        is_primary_for_locale: true,
      },
      {
        alias: 'One Piece',
        lang: 'en',
        region: null,
        script: 'Latn',
        kind: 'official',
        confidence: null,
        source: 'tmdb',
        is_primary_for_locale: false,
      },
    ])

    const rows = await listCatalogAliases(m.db, CID)
    expect(rows).toHaveLength(2)

    const cn = rows[0]
    expect(typeof cn.confidence).toBe('number')
    expect(cn.confidence).toBe(0.9)
    expect(cn.isPrimaryForLocale).toBe(true)
    expect(cn.script).toBe('Hans')

    const en = rows[1]
    expect(en.confidence).toBeNull()
    expect(en.isPrimaryForLocale).toBe(false)
  })
})
