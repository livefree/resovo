/**
 * tests/unit/api/datatable-shared.test.ts — ADR-150 阶段 3 / CHG-SN-9-DT-AUTOFILTER-EP-2
 *
 * 覆盖：
 *   - filter-schema DtFiltersSchema parse（6 种 FilterValue / JSON 失败 / 非对象）
 *   - distinct-whitelist lookup + identifier 正则校验
 */
import { describe, it, expect } from 'vitest'
import { DtFiltersSchema, FilterValueSchema } from '@/api/services/datatable/filter-schema'
import {
  DT_DISTINCT_TABLES,
  DT_DISTINCT_COLUMN_SQL,
  DT_DISTINCT_WHITELIST,
  DT_DISTINCT_FROM,
  DT_DISTINCT_IDENT_REGEX,
} from '@/api/services/datatable/distinct-whitelist'

describe('FilterValueSchema (ADR-150 D-150-4)', () => {
  it('text valid', () => {
    expect(FilterValueSchema.safeParse({ kind: 'text', value: 'abc' }).success).toBe(true)
  })
  it('enum max 50 项', () => {
    const r = FilterValueSchema.safeParse({ kind: 'enum', value: Array.from({ length: 51 }, (_, i) => `v${i}`) })
    expect(r.success).toBe(false)
  })
  it('range 仅 min', () => {
    expect(FilterValueSchema.safeParse({ kind: 'range', min: 1 }).success).toBe(true)
  })
  it('date-range 缺省 from/to', () => {
    expect(FilterValueSchema.safeParse({ kind: 'date-range' }).success).toBe(true)
  })
  it('unknown kind → fail', () => {
    expect(FilterValueSchema.safeParse({ kind: 'xxx', value: 1 }).success).toBe(false)
  })
})

describe('DtFiltersSchema (ADR-150 D-150-4)', () => {
  it('undefined → undefined', () => {
    expect(DtFiltersSchema.safeParse(undefined).data).toBeUndefined()
  })
  it('empty string → undefined', () => {
    expect(DtFiltersSchema.safeParse('').data).toBeUndefined()
  })
  it('valid encoded JSON → Record<key, FilterValue>', () => {
    const encoded = encodeURIComponent(JSON.stringify({
      status: { kind: 'enum', value: ['running', 'done'] },
      actor: { kind: 'text', value: 'alice' },
    }))
    const r = DtFiltersSchema.safeParse(encoded)
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data?.status).toEqual({ kind: 'enum', value: ['running', 'done'] })
      expect(r.data?.actor).toEqual({ kind: 'text', value: 'alice' })
    }
  })
  it('invalid JSON → fail', () => {
    expect(DtFiltersSchema.safeParse('not-json').success).toBe(false)
  })
  it('非对象 → fail', () => {
    expect(DtFiltersSchema.safeParse(encodeURIComponent(JSON.stringify([1, 2]))).success).toBe(false)
  })
  it('单个 filter value 非法 → fail with key 信息', () => {
    const encoded = encodeURIComponent(JSON.stringify({
      status: { kind: 'unknown', value: 'x' },
    }))
    const r = DtFiltersSchema.safeParse(encoded)
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.error.message).toContain('status')
    }
  })
})

describe('distinct-whitelist (ADR-150 D-150-3)', () => {
  it('DT_DISTINCT_TABLES 6 表', () => {
    expect(DT_DISTINCT_TABLES.length).toBe(6)
    expect(DT_DISTINCT_TABLES).toContain('crawler_runs')
    expect(DT_DISTINCT_TABLES).toContain('sources')
  })

  it('DT_DISTINCT_COLUMN_SQL 每表至少 1 列', () => {
    for (const t of DT_DISTINCT_TABLES) {
      const cols = DT_DISTINCT_COLUMN_SQL[t]
      expect(Object.keys(cols).length).toBeGreaterThanOrEqual(1)
    }
  })

  it('DT_DISTINCT_WHITELIST 派生与 SQL 同源', () => {
    for (const t of DT_DISTINCT_TABLES) {
      expect(DT_DISTINCT_WHITELIST[t]).toEqual(Object.keys(DT_DISTINCT_COLUMN_SQL[t]))
    }
  })

  it('所有 SQL 列表达式符合 identifier 正则', () => {
    for (const t of DT_DISTINCT_TABLES) {
      for (const sql of Object.values(DT_DISTINCT_COLUMN_SQL[t])) {
        expect(DT_DISTINCT_IDENT_REGEX.test(sql)).toBe(true)
      }
    }
  })

  it('sources 逻辑名映射到 video_sources', () => {
    expect(DT_DISTINCT_FROM.sources).toBe('video_sources')
  })

  it('crawler_runs 缺省 FROM = crawler_runs（不在 DT_DISTINCT_FROM 中）', () => {
    expect(DT_DISTINCT_FROM.crawler_runs).toBeUndefined()
  })

  it('identifier 正则拒绝危险字符', () => {
    expect(DT_DISTINCT_IDENT_REGEX.test('users.*')).toBe(false)
    expect(DT_DISTINCT_IDENT_REGEX.test("users.id; DROP")).toBe(false)
    expect(DT_DISTINCT_IDENT_REGEX.test('users.id')).toBe(true)
  })
})
