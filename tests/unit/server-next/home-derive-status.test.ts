/**
 * home-derive-status.test.ts — deriveModuleStatus 四色生命周期推导（CHG-HOME-UX-03）
 *
 * 真源：P-home.md §6 状态颜色；判定优先级 danger > neutral > warn > ok。
 * now 注入消除时钟依赖。
 */

import { describe, it, expect } from 'vitest'
import { deriveModuleStatus } from '../../../apps/server-next/src/lib/home-modules/derive-status'

const NOW = new Date('2026-06-05T12:00:00Z')
const PAST = '2026-06-01T00:00:00Z'
const FUTURE = '2026-06-10T00:00:00Z'

const BASE = {
  enabled: true,
  startAt: null,
  endAt: null,
  contentRefType: 'video' as const,
}

const META = { title: 'T', coverUrl: null, isPublished: true }

describe('deriveModuleStatus — 四色推导', () => {
  it('ok：已启用 + 无时效', () => {
    expect(deriveModuleStatus(BASE, META, NOW)).toEqual({ variant: 'ok', label: '生效中' })
  })

  it('ok：已启用 + 窗内（startAt 过去 / endAt 未来）', () => {
    expect(deriveModuleStatus({ ...BASE, startAt: PAST, endAt: FUTURE }, META, NOW).variant).toBe('ok')
  })

  it('warn：startAt 未到（待生效）', () => {
    expect(deriveModuleStatus({ ...BASE, startAt: FUTURE }, META, NOW)).toEqual({ variant: 'warn', label: '待生效' })
  })

  it('neutral：已禁用（优先于 warn——禁用即灰不显待生效）', () => {
    expect(deriveModuleStatus({ ...BASE, enabled: false, startAt: FUTURE }, META, NOW)).toEqual({ variant: 'neutral', label: '已隐藏' })
  })

  it('neutral：endAt 已过（已过期；endAt ≤ now 与后端 > NOW() 口径互补）', () => {
    expect(deriveModuleStatus({ ...BASE, endAt: PAST }, META, NOW)).toEqual({ variant: 'neutral', label: '已过期' })
    // 边界：endAt === now → 过期（后端 end_at > NOW() 不可见）
    expect(deriveModuleStatus({ ...BASE, endAt: NOW.toISOString() }, META, NOW).variant).toBe('neutral')
  })

  it('danger：video 引用失效（meta===null）优先级最高，覆盖禁用/时效', () => {
    expect(deriveModuleStatus(BASE, null, NOW)).toEqual({ variant: 'danger', label: '引用失效' })
    expect(deriveModuleStatus({ ...BASE, enabled: false }, null, NOW).variant).toBe('danger')
    expect(deriveModuleStatus({ ...BASE, startAt: FUTURE }, null, NOW).variant).toBe('danger')
  })

  it('非 video 类型 meta===null 不判 danger（undefined/null 同语义落正常态）', () => {
    expect(deriveModuleStatus({ ...BASE, contentRefType: 'external_url' }, null, NOW).variant).toBe('ok')
    expect(deriveModuleStatus({ ...BASE, contentRefType: 'external_url' }, undefined, NOW).variant).toBe('ok')
  })

  it('video 类型 meta===undefined（尚未取回）不判 danger', () => {
    expect(deriveModuleStatus(BASE, undefined, NOW).variant).toBe('ok')
  })
})
