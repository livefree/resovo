/**
 * home-entry.test.ts — /admin/home 批量添加深链真源（CHG-HOME-UX-08）
 *
 * 参数顺序契约锚定：add_ids → from（仿 merge/entry.ts 测试范式，勿调换）。
 */

import { describe, it, expect } from 'vitest'
import {
  buildHomeAddHref,
  parseHomeAddEntry,
  isHomeEntrySource,
  HOME_ENTRY_SOURCE_META,
} from '../../../apps/server-next/src/lib/home-modules/entry'

describe('buildHomeAddHref — 参数顺序契约', () => {
  it('add_ids → from 顺序固定', () => {
    expect(buildHomeAddHref({ ids: ['a', 'b'], from: 'videos-batch' }))
      .toBe('/admin/home?add_ids=a%2Cb&from=videos-batch')
  })

  it('单 id（行级入口）', () => {
    expect(buildHomeAddHref({ ids: ['v1'], from: 'videos' }))
      .toBe('/admin/home?add_ids=v1&from=videos')
  })
})

describe('parseHomeAddEntry — 解析与守卫', () => {
  it('build → parse 往返一致', () => {
    const href = buildHomeAddHref({ ids: ['x', 'y'], from: 'videos' })
    const qs = new URLSearchParams(href.split('?')[1])
    expect(parseHomeAddEntry(qs)).toEqual({ ids: ['x', 'y'], from: 'videos' })
  })

  it('ids 去空去重保持首现顺序', () => {
    const qs = new URLSearchParams('add_ids=a,,b,a, c &from=videos')
    expect(parseHomeAddEntry(qs)?.ids).toEqual(['a', 'b', 'c'])
  })

  it('add_ids 缺失 / 全空 / from 非法 → null（普通访问零干扰）', () => {
    expect(parseHomeAddEntry(new URLSearchParams(''))).toBeNull()
    expect(parseHomeAddEntry(new URLSearchParams('add_ids=,,&from=videos'))).toBeNull()
    expect(parseHomeAddEntry(new URLSearchParams('add_ids=a&from=evil'))).toBeNull()
    expect(parseHomeAddEntry(new URLSearchParams('add_ids=a'))).toBeNull()
  })
})

describe('SOURCE_META / isHomeEntrySource', () => {
  it('全来源含 label/backHref/backLabel', () => {
    for (const src of ['videos', 'videos-batch'] as const) {
      expect(isHomeEntrySource(src)).toBe(true)
      expect(HOME_ENTRY_SOURCE_META[src].backHref).toBe('/admin/videos')
      expect(HOME_ENTRY_SOURCE_META[src].label.length).toBeGreaterThan(0)
    }
    expect(isHomeEntrySource('moderation')).toBe(false)
    expect(isHomeEntrySource(null)).toBe(false)
  })
})
