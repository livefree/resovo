/**
 * tests/unit/api/catalogBlockingKeys.test.ts — META-50-2A-1
 *
 * 覆盖写键 service（ADR-206 §META-50-2A / M-2A-2）：
 *   - qualifiesForBlockingBucket：catalog/manual 恒进 + crawler 排除 + NULL 排除 + 非manual 白名单/阈值
 *   - projectBlockingKeyRows：归一 + 去重 + catalog/manual confidence→1.0
 *   - recomputeCatalogBlockingKeys：loadKnownNames → projection → replace（mock）
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Pool } from 'pg'

const { loadKnownNamesMock, replaceMock } = vi.hoisted(() => ({
  loadKnownNamesMock: vi.fn(),
  replaceMock: vi.fn(),
}))
vi.mock('@/api/services/metadata/knownNames', async (orig) => {
  const actual = await orig<typeof import('@/api/services/metadata/knownNames')>()
  return { ...actual, loadKnownNames: loadKnownNamesMock }
})
vi.mock('@/api/db/queries/catalogBlockingAliasKeys', () => ({
  replaceCatalogBlockingAliasKeys: replaceMock,
}))

import {
  qualifiesForBlockingBucket,
  projectBlockingKeyRows,
  recomputeCatalogBlockingKeys,
} from '@/api/services/metadata/catalogBlockingKeys'
import { CATALOG_FIELD_SOURCE, type KnownName } from '@/api/services/metadata/knownNames'

function kn(fields: Partial<KnownName> & { value: string; kind: KnownName['kind'] }): KnownName {
  return { source: 'douban', lang: null, confidence: null, ...fields }
}

const DB = {} as unknown as Pool

beforeEach(() => {
  loadKnownNamesMock.mockReset()
  replaceMock.mockReset()
  replaceMock.mockResolvedValue(undefined)
})

describe('qualifiesForBlockingBucket（M-2A-2 阈值）', () => {
  it("source='catalog' 哨兵恒进（即便 kind='title' 不在 D-206-6(b) 白名单）", () => {
    expect(qualifiesForBlockingBucket(kn({ value: '航海王', kind: 'title', source: CATALOG_FIELD_SOURCE, confidence: 1.0 }))).toBe(true)
  })
  it("source='manual' 恒进（即便 confidence NULL）", () => {
    expect(qualifiesForBlockingBucket(kn({ value: 'X', kind: 'aka', source: 'manual', confidence: null }))).toBe(true)
  })
  it("source='crawler' 一律不进（即便 kind/conf 合格）", () => {
    expect(qualifiesForBlockingBucket(kn({ value: 'X', kind: 'official', source: 'crawler', confidence: 0.99 }))).toBe(false)
  })
  it('非 manual confidence NULL → 不进', () => {
    expect(qualifiesForBlockingBucket(kn({ value: 'X', kind: 'official', source: 'douban', confidence: null }))).toBe(false)
  })
  it('非 manual 白名单 kind + confidence≥0.80 → 进', () => {
    expect(qualifiesForBlockingBucket(kn({ value: 'X', kind: 'localized', source: 'douban', confidence: 0.8 }))).toBe(true)
  })
  it('非 manual confidence<0.80 → 不进', () => {
    expect(qualifiesForBlockingBucket(kn({ value: 'X', kind: 'official', source: 'tmdb', confidence: 0.79 }))).toBe(false)
  })
  it('非 manual 非白名单 kind（romanization）→ 不进', () => {
    expect(qualifiesForBlockingBucket(kn({ value: 'X', kind: 'romanization', source: 'douban', confidence: 0.95 }))).toBe(false)
  })
})

describe('projectBlockingKeyRows', () => {
  it('过滤不合格 + 归一 + catalog/manual confidence→1.0', () => {
    const rows = projectBlockingKeyRows([
      kn({ value: '航海王', kind: 'title', source: CATALOG_FIELD_SOURCE, confidence: 1.0 }),
      kn({ value: '海贼王', kind: 'localized', source: 'douban', confidence: 0.9 }),
      kn({ value: 'crawlerName', kind: 'official', source: 'crawler', confidence: 0.99 }), // 排除
    ])
    const keys = rows.map((r) => r.normalizedKey).sort()
    expect(keys).toEqual(['海贼王', '航海王'])
    const title = rows.find((r) => r.normalizedKey === '航海王')
    expect(title).toMatchObject({ source: CATALOG_FIELD_SOURCE, confidence: 1.0 })
  })
  it('归一去重（同归一键保首条）+ 空键剔除', () => {
    const rows = projectBlockingKeyRows([
      kn({ value: 'One Piece', kind: 'official', source: 'tmdb', confidence: 0.9 }),
      kn({ value: 'one piece', kind: 'official', source: 'douban', confidence: 0.85 }), // 归一同键 → 去重
      kn({ value: '   ', kind: 'aka', source: 'manual', confidence: null }), // 空键剔除
    ])
    expect(rows).toHaveLength(1)
    expect(rows[0].source).toBe('tmdb') // 保首条
  })
})

describe('recomputeCatalogBlockingKeys', () => {
  it('loadKnownNames → projection → replace 落库', async () => {
    loadKnownNamesMock.mockResolvedValue([
      kn({ value: '航海王', kind: 'title', source: CATALOG_FIELD_SOURCE, confidence: 1.0 }),
      kn({ value: 'crawlerX', kind: 'official', source: 'crawler', confidence: 0.9 }), // 排除
    ])
    await recomputeCatalogBlockingKeys(DB, 'cat-1')
    expect(loadKnownNamesMock).toHaveBeenCalledWith(DB, 'cat-1')
    const rowsArg = replaceMock.mock.calls[0][2] as { normalizedKey: string }[]
    expect(rowsArg.map((r) => r.normalizedKey)).toEqual(['航海王'])
  })
  it('catalog 无合格键 → replace 传空数组（清空）', async () => {
    loadKnownNamesMock.mockResolvedValue([])
    await recomputeCatalogBlockingKeys(DB, 'cat-2')
    expect(replaceMock).toHaveBeenCalledWith(DB, 'cat-2', [])
  })
})
