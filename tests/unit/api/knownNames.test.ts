/**
 * tests/unit/api/knownNames.test.ts — META-50-1A
 *
 * 覆盖 knownNames 共享原语（ADR-206 D-206-1 + arch-reviewer MUST-1A-1~7）：
 *   - loadKnownNames：四标题字段哨兵 source='catalog'（MUST-1A-1）+ 别名合成 + 去重极性 tiebreak（MUST-1A-3）
 *   - filterForMatchScore：极性白名单 + 额外排 crawler 别名（MUST-1A-2）
 *   - filterForSearchQueries：优先级序 + 同档 confidence DESC/value ASC（MUST-1A-4）
 *
 * 真 normalizeForExternalMatch（不 mock）——验证简繁不归一「海贼王/航海王」不误并（ADR-175 R1）。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Pool } from 'pg'

const { findCatalogByIdMock, listCatalogAliasesMock } = vi.hoisted(() => ({
  findCatalogByIdMock: vi.fn(),
  listCatalogAliasesMock: vi.fn(),
}))

vi.mock('@/api/db/queries/mediaCatalog', async (orig) => {
  const actual = await orig<typeof import('@/api/db/queries/mediaCatalog')>()
  return { ...actual, findCatalogById: findCatalogByIdMock }
})
vi.mock('@/api/db/queries/catalogAliases', async (orig) => {
  const actual = await orig<typeof import('@/api/db/queries/catalogAliases')>()
  return { ...actual, listCatalogAliases: listCatalogAliasesMock }
})

import {
  loadKnownNames,
  filterForMatchScore,
  filterForSearchQueries,
  CATALOG_FIELD_SOURCE,
  type KnownName,
} from '@/api/services/metadata/knownNames'
import type { MediaCatalogRow } from '@/api/db/queries/mediaCatalog'
import type { CatalogAliasRow } from '@/api/db/queries/catalogAliases'

const DB = {} as unknown as Pool
const CID = 'cat-1'

function catalogRow(fields: Partial<MediaCatalogRow>): MediaCatalogRow {
  return {
    title: '', titleEn: null, titleOriginal: null, originalLanguage: null, ...fields,
  } as unknown as MediaCatalogRow
}
function aliasRow(fields: Partial<CatalogAliasRow> & { alias: string; source: string }): CatalogAliasRow {
  return { lang: null, region: null, script: null, kind: null, confidence: null, isPrimaryForLocale: false, ...fields }
}
function kn(fields: Partial<KnownName> & { value: string; kind: KnownName['kind'] }): KnownName {
  return { source: 'douban', lang: null, confidence: null, ...fields }
}

beforeEach(() => {
  findCatalogByIdMock.mockReset()
  listCatalogAliasesMock.mockReset()
  listCatalogAliasesMock.mockResolvedValue([])
})

describe('loadKnownNames — 四标题字段合成（MUST-1A-1）', () => {
  it('catalog 不存在 → []', async () => {
    findCatalogByIdMock.mockResolvedValue(null)
    expect(await loadKnownNames(DB, CID)).toEqual([])
  })

  it('三标题字段 source=catalog / confidence=1.0 / kind+lang 正确', async () => {
    findCatalogByIdMock.mockResolvedValue(
      catalogRow({ title: '航海王', titleEn: 'One Piece', titleOriginal: 'ワンピース', originalLanguage: 'ja' }),
    )
    const names = await loadKnownNames(DB, CID)

    const title = names.find((n) => n.kind === 'title')
    expect(title).toMatchObject({ value: '航海王', source: CATALOG_FIELD_SOURCE, lang: null, confidence: 1.0 })
    const en = names.find((n) => n.value === 'One Piece')
    expect(en).toMatchObject({ kind: 'official', source: CATALOG_FIELD_SOURCE, lang: 'en', confidence: 1.0 })
    const orig = names.find((n) => n.kind === 'original')
    expect(orig).toMatchObject({ value: 'ワンピース', source: CATALOG_FIELD_SOURCE, lang: 'ja', confidence: 1.0 })
  })

  it('空/空白标题字段跳过', async () => {
    findCatalogByIdMock.mockResolvedValue(catalogRow({ title: '海贼王', titleEn: '   ', titleOriginal: '' }))
    const names = await loadKnownNames(DB, CID)
    expect(names).toHaveLength(1)
    expect(names[0].value).toBe('海贼王')
  })
})

describe('loadKnownNames — 别名合成 + 去重（MUST-1A-3）', () => {
  it('别名 kind=NULL → 兜底 aka', async () => {
    findCatalogByIdMock.mockResolvedValue(catalogRow({ title: '主标题' }))
    listCatalogAliasesMock.mockResolvedValue([aliasRow({ alias: '又名X', source: 'douban', kind: null })])
    const names = await loadKnownNames(DB, CID)
    expect(names.find((n) => n.value === '又名X')?.kind).toBe('aka')
  })

  it('同名归一冲突：保留极性更强 kind（title 胜 aka）', async () => {
    findCatalogByIdMock.mockResolvedValue(catalogRow({ title: '海贼王' }))
    listCatalogAliasesMock.mockResolvedValue([
      aliasRow({ alias: '海贼王', source: 'douban', kind: 'aka', confidence: 0.99 }),
    ])
    const names = await loadKnownNames(DB, CID)
    const merged = names.filter((n) => n.value === '海贼王' || n.value === '海贼王')
    expect(merged).toHaveLength(1)
    expect(merged[0].kind).toBe('title') // 极性强者胜，即便 aka confidence 更高
  })

  it('同极性 rank：保留 confidence 高者', async () => {
    findCatalogByIdMock.mockResolvedValue(catalogRow({}))
    listCatalogAliasesMock.mockResolvedValue([
      aliasRow({ alias: 'Naruto', source: 'douban', kind: 'official', confidence: 0.7 }),
      aliasRow({ alias: 'Naruto', source: 'tmdb', kind: 'official', confidence: 0.95 }),
    ])
    const names = await loadKnownNames(DB, CID)
    const merged = names.filter((n) => n.value === 'Naruto')
    expect(merged).toHaveLength(1)
    expect(merged[0].confidence).toBe(0.95)
  })

  it('简繁不归一：海贼王 / 航海王 不误并（ADR-175 R1）', async () => {
    findCatalogByIdMock.mockResolvedValue(catalogRow({ title: '航海王' }))
    listCatalogAliasesMock.mockResolvedValue([aliasRow({ alias: '海贼王', source: 'douban', kind: 'localized' })])
    const names = await loadKnownNames(DB, CID)
    const values = names.map((n) => n.value).sort()
    expect(values).toEqual(['海贼王', '航海王'])
  })
})

describe('filterForMatchScore（MUST-1A-2）', () => {
  it('保留 title/official/original/localized，排 romanization/aka/abbreviation', async () => {
    const names: KnownName[] = [
      kn({ value: 'T', kind: 'title' }),
      kn({ value: 'O', kind: 'official' }),
      kn({ value: 'G', kind: 'original' }),
      kn({ value: 'L', kind: 'localized' }),
      kn({ value: 'R', kind: 'romanization' }),
      kn({ value: 'A', kind: 'aka' }),
      kn({ value: 'B', kind: 'abbreviation' }),
    ]
    const kept = filterForMatchScore(names).map((n) => n.value).sort()
    expect(kept).toEqual(['G', 'L', 'O', 'T'])
  })

  it('额外排 source=crawler 别名（即便 kind 合格），但保 source=catalog 标题字段', async () => {
    const names: KnownName[] = [
      kn({ value: 'crawlerOfficial', kind: 'official', source: 'crawler' }),
      kn({ value: 'catalogTitle', kind: 'title', source: CATALOG_FIELD_SOURCE }),
      kn({ value: 'doubanLocalized', kind: 'localized', source: 'douban' }),
    ]
    const kept = filterForMatchScore(names).map((n) => n.value).sort()
    expect(kept).toEqual(['catalogTitle', 'doubanLocalized'])
  })
})

describe('filterForSearchQueries（MUST-1A-4）', () => {
  it('优先级序 original→title_en→official-alias→romanization→title；aka/abbreviation/localized 排除', () => {
    const names: KnownName[] = [
      kn({ value: '主标题', kind: 'title' }),
      kn({ value: 'OfficialAlias', kind: 'official', lang: 'fr' }),
      kn({ value: 'TitleEn', kind: 'official', lang: 'en' }),
      kn({ value: 'Romaji', kind: 'romanization' }),
      kn({ value: '原名', kind: 'original' }),
      kn({ value: '又名', kind: 'aka' }),
      kn({ value: '本地化', kind: 'localized' }),
    ]
    const ordered = filterForSearchQueries(names).map((n) => n.value)
    expect(ordered).toEqual(['原名', 'TitleEn', 'OfficialAlias', 'Romaji', '主标题'])
  })

  it('同档内 confidence DESC NULLS LAST, value ASC', () => {
    const names: KnownName[] = [
      kn({ value: 'B-official', kind: 'official', lang: 'fr', confidence: 0.5 }),
      kn({ value: 'A-official', kind: 'official', lang: 'fr', confidence: 0.9 }),
      kn({ value: 'C-official', kind: 'official', lang: 'fr', confidence: null }),
    ]
    const ordered = filterForSearchQueries(names).map((n) => n.value)
    expect(ordered).toEqual(['A-official', 'B-official', 'C-official'])
  })

  it('crawler 别名进搜索词集（搜索是召回，不排 crawler）', () => {
    const names: KnownName[] = [kn({ value: 'crawlerOrig', kind: 'original', source: 'crawler' })]
    expect(filterForSearchQueries(names).map((n) => n.value)).toEqual(['crawlerOrig'])
  })
})
