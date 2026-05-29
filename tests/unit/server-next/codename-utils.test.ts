/**
 * codename-utils.test.ts — CHG-SN-9-CODENAME-MATRIX
 *
 * 覆盖 codename 字库状态计算 + 后缀建议算法核心 contract：
 *   #1 parseCodename：纯基础名 / 基础名-N / 非法格式
 *   #2 joinCodename：往返一致
 *   #3 buildCodenameMatrix：无 sla 行 → 所有 52 山名 available
 *   #4 buildCodenameMatrix：base 占用 → 该山 status=occupied + assignedTo 透传
 *   #5 buildCodenameMatrix：base + base-2 同时占用 → 建议 base-3
 *   #6 buildCodenameMatrix：base 占用 + base-3 占用 / base-2 空缺 → 建议 base-2（找最小空缺）
 *   #7 buildCodenameMatrix：cooling 状态 < 90 天 / 计算 coolingDaysLeft
 *   #8 buildCodenameMatrix：cooling 退役 ≥ 90 天 → 视为 available（不进 byBase）
 *   #9 buildCodenameMatrix：codename 是别的字符串（非 MOUNTAIN_CODENAMES）→ 该山不受影响
 *   #10 computeMatrixStats：聚合统计正确
 */
import { describe, it, expect } from 'vitest'
import {
  parseCodename,
  joinCodename,
  buildCodenameMatrix,
  computeMatrixStats,
} from '../../../apps/server-next/src/lib/sources/codename-utils'
import { MOUNTAIN_CODENAMES } from '@resovo/types'
import type { SourceLineRow } from '@resovo/types'

const FIXED_NOW = new Date('2026-05-28T00:00:00Z').getTime()

function makeRow(overrides: Partial<SourceLineRow>): SourceLineRow {
  return {
    sourceSiteKey: 'site_a',
    sourceName: 'lineA',
    displayName: 'Line A',
    codename: null,
    priority: 0,
    retiredAt: null,
    autoRetired: false,
    assignedAt: '2026-05-01T00:00:00Z',
    videoCount: 1,
    activeCount: 1,
    episodeCount: 1,
    ...overrides,
  }
}

describe('parseCodename / joinCodename', () => {
  it('#1 纯基础名 → suffix=null', () => {
    expect(parseCodename('泰山')).toEqual({ base: '泰山', suffix: null })
  })

  it('#1 "基础名-2" → suffix=2', () => {
    expect(parseCodename('泰山-2')).toEqual({ base: '泰山', suffix: 2 })
  })

  it('#1 "基础名-0" 非法（suffix ≥ 1） → 当作纯基础名', () => {
    expect(parseCodename('泰山-0')).toEqual({ base: '泰山-0', suffix: null })
  })

  it('#2 joinCodename 往返一致', () => {
    expect(joinCodename('泰山', null)).toBe('泰山')
    expect(joinCodename('泰山', 2)).toBe('泰山-2')
  })
})

describe('buildCodenameMatrix', () => {
  it('#3 无 sla 行 → 所有 52 山名 status=available', () => {
    const matrix = buildCodenameMatrix([])
    expect(matrix).toHaveLength(MOUNTAIN_CODENAMES.length)
    for (const m of matrix) {
      expect(m.slots[0].status).toBe('available')
      expect(m.hasAvailable).toBe(true)
      expect(m.suggestedNext.value).toBe(m.base)
    }
  })

  it('#4 base 占用 → status=occupied + assignedTo 透传', () => {
    const matrix = buildCodenameMatrix([
      makeRow({ sourceSiteKey: 'site_x', sourceName: 'lineX', displayName: 'X', codename: '泰山' }),
    ], FIXED_NOW)
    const taishan = matrix.find((m) => m.base === '泰山')!
    expect(taishan.slots[0].status).toBe('occupied')
    expect(taishan.slots[0].assignedTo).toEqual({
      sourceSiteKey: 'site_x',
      sourceName: 'lineX',
      displayName: 'X',
    })
    // 建议下一个：泰山-1
    expect(taishan.suggestedNext.value).toBe('泰山-1')
  })

  it('#5 base + base-2 同时占用 → suggestedNext = base-1（最小空缺）', () => {
    const matrix = buildCodenameMatrix([
      makeRow({ sourceSiteKey: 'site_x', sourceName: 'l1', codename: '泰山' }),
      makeRow({ sourceSiteKey: 'site_x', sourceName: 'l2', codename: '泰山-2' }),
    ], FIXED_NOW)
    const taishan = matrix.find((m) => m.base === '泰山')!
    expect(taishan.suggestedNext.value).toBe('泰山-1')
  })

  it('#6 base 占用 + base-1 占用 + base-2 占用 → suggestedNext = base-3', () => {
    const matrix = buildCodenameMatrix([
      makeRow({ sourceSiteKey: 'site_x', sourceName: 'l0', codename: '泰山' }),
      makeRow({ sourceSiteKey: 'site_x', sourceName: 'l1', codename: '泰山-1' }),
      makeRow({ sourceSiteKey: 'site_x', sourceName: 'l2', codename: '泰山-2' }),
    ], FIXED_NOW)
    const taishan = matrix.find((m) => m.base === '泰山')!
    expect(taishan.suggestedNext.value).toBe('泰山-3')
  })

  it('#7 cooling < 90 天 → status=cooling + coolingDaysLeft', () => {
    // 退役 30 天前
    const retiredAt = new Date(FIXED_NOW - 30 * 24 * 60 * 60 * 1000).toISOString()
    const matrix = buildCodenameMatrix([
      makeRow({ sourceSiteKey: 'site_x', sourceName: 'lx', codename: '泰山', retiredAt }),
    ], FIXED_NOW)
    const taishan = matrix.find((m) => m.base === '泰山')!
    expect(taishan.slots[0].status).toBe('cooling')
    expect(taishan.slots[0].coolingDaysLeft).toBe(60)  // 90 - 30 = 60
  })

  it('#8 cooling 退役 ≥ 90 天 → 视为 available（已可复用）', () => {
    const retiredAt = new Date(FIXED_NOW - 100 * 24 * 60 * 60 * 1000).toISOString()
    const matrix = buildCodenameMatrix([
      makeRow({ sourceSiteKey: 'site_x', sourceName: 'lx', codename: '泰山', retiredAt }),
    ], FIXED_NOW)
    const taishan = matrix.find((m) => m.base === '泰山')!
    expect(taishan.slots[0].status).toBe('available')
  })

  it('#9 codename 是非字库山名 → 字库内所有 52 山仍 available', () => {
    const matrix = buildCodenameMatrix([
      makeRow({ sourceSiteKey: 'site_x', sourceName: 'lx', codename: '不是山' }),
    ], FIXED_NOW)
    for (const m of matrix) {
      expect(m.slots[0].status).toBe('available')
    }
  })
})

describe('computeMatrixStats', () => {
  it('#10 统计 mountainAvailable / slotsOccupied / slotsCooling', () => {
    const retiredAt = new Date(FIXED_NOW - 10 * 24 * 60 * 60 * 1000).toISOString()
    const matrix = buildCodenameMatrix([
      makeRow({ sourceSiteKey: 's', sourceName: 'a', codename: '泰山' }),
      makeRow({ sourceSiteKey: 's', sourceName: 'b', codename: '华山', retiredAt }),
      makeRow({ sourceSiteKey: 's', sourceName: 'c', codename: '泰山-2' }),
    ], FIXED_NOW)

    const stats = computeMatrixStats(matrix)
    expect(stats.mountainTotal).toBe(MOUNTAIN_CODENAMES.length)
    expect(stats.mountainAvailable).toBe(MOUNTAIN_CODENAMES.length - 2)  // 泰山 occupied + 华山 cooling
    expect(stats.slotsOccupied).toBe(2)  // 泰山 + 泰山-2
    expect(stats.slotsCooling).toBe(1)   // 华山
  })
})
