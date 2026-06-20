/**
 * imageHealthFilters.test.ts — Tab B 治理工作台 filter 翻译 + distinct（IMGH-P2-3B / SEQ-20260619-02）
 *
 * 覆盖：
 *   - buildMissingFilters：text/enum 翻译 + 空值忽略 + 多选取首项（1D 单值语义）+ 组合
 *   - imageHealthDistinctFetcher：哨兵 table 复用 getTopBrokenDomains + q 模糊 + 非哨兵返空
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { FilterValue } from '@resovo/admin-ui'

const getTopBrokenDomainsMock = vi.fn()
vi.mock('../../../../../../apps/server-next/src/lib/image-health/api', () => ({
  getTopBrokenDomains: (...args: unknown[]) => getTopBrokenDomainsMock(...args),
}))

import {
  buildMissingFilters,
  imageHealthDistinctFetcher,
  IMAGE_HEALTH_DOMAIN_DISTINCT,
} from '../../../../../../apps/server-next/src/app/admin/image-health/_client/imageHealthFilters'

function fmap(entries: Record<string, FilterValue>): ReadonlyMap<string, FilterValue> {
  return new Map(Object.entries(entries))
}

beforeEach(() => {
  getTopBrokenDomainsMock.mockReset()
})

describe('buildMissingFilters', () => {
  it('空 Map → {}', () => {
    expect(buildMissingFilters(new Map())).toEqual({})
  })

  it('text search 透传（trim）', () => {
    expect(buildMissingFilters(fmap({ search: { kind: 'text', value: '  沙丘  ' } }))).toEqual({ search: '沙丘' })
  })

  it('text search 纯空白 → 忽略', () => {
    expect(buildMissingFilters(fmap({ search: { kind: 'text', value: '   ' } }))).toEqual({})
  })

  it('enum posterStatus 单值', () => {
    expect(buildMissingFilters(fmap({ posterStatus: { kind: 'enum', value: ['broken'] } }))).toEqual({ posterStatus: 'broken' })
  })

  it('enum 多选 → 取首项（1D 单值语义）', () => {
    expect(
      buildMissingFilters(fmap({ posterStatus: { kind: 'enum', value: ['broken', 'missing'] } })),
    ).toEqual({ posterStatus: 'broken' })
  })

  it('enum 空数组 → 忽略该 facet', () => {
    expect(buildMissingFilters(fmap({ posterStatus: { kind: 'enum', value: [] } }))).toEqual({})
  })

  it('posterSource / eventType / brokenDomain 各自翻译', () => {
    expect(buildMissingFilters(fmap({ posterSource: { kind: 'enum', value: ['tmdb'] } }))).toEqual({ posterSource: 'tmdb' })
    expect(buildMissingFilters(fmap({ eventType: { kind: 'enum', value: ['fetch_404'] } }))).toEqual({ eventType: 'fetch_404' })
    expect(buildMissingFilters(fmap({ brokenDomain: { kind: 'enum', value: ['img.cdn.com'] } }))).toEqual({ brokenDomain: 'img.cdn.com' })
  })

  it('多 facet 组合', () => {
    const out = buildMissingFilters(fmap({
      search: { kind: 'text', value: 'x' },
      posterStatus: { kind: 'enum', value: ['missing'] },
      eventType: { kind: 'enum', value: ['timeout'] },
    }))
    expect(out).toEqual({ search: 'x', posterStatus: 'missing', eventType: 'timeout' })
  })
})

describe('imageHealthDistinctFetcher', () => {
  it('哨兵 table → 复用 getTopBrokenDomains(50) + 映射 value/label', async () => {
    getTopBrokenDomainsMock.mockResolvedValueOnce([
      { domain: 'img1.cdn', eventCount: 120, affectedVideos: 30 },
      { domain: 'img2.cdn', eventCount: 8, affectedVideos: 2 },
    ])
    const opts = await imageHealthDistinctFetcher(IMAGE_HEALTH_DOMAIN_DISTINCT, 'brokenDomain')
    expect(getTopBrokenDomainsMock).toHaveBeenCalledWith(50)
    expect(opts).toEqual([
      { value: 'img1.cdn', label: 'img1.cdn（120）' },
      { value: 'img2.cdn', label: 'img2.cdn（8）' },
    ])
  })

  it('q 客户端模糊过滤（大小写无关）', async () => {
    getTopBrokenDomainsMock.mockResolvedValueOnce([
      { domain: 'img1.cdn', eventCount: 1, affectedVideos: 1 },
      { domain: 'static.bad', eventCount: 1, affectedVideos: 1 },
    ])
    const opts = await imageHealthDistinctFetcher(IMAGE_HEALTH_DOMAIN_DISTINCT, 'brokenDomain', 'IMG')
    expect(opts.map((o) => o.value)).toEqual(['img1.cdn'])
  })

  it('非哨兵 table → 返空 + 不调用 api', async () => {
    const opts = await imageHealthDistinctFetcher('some_other_table', 'col')
    expect(opts).toEqual([])
    expect(getTopBrokenDomainsMock).not.toHaveBeenCalled()
  })
})
