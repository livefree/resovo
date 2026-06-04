/**
 * external-ref-rollup.test.ts — D-177-4 上卷规则表纯函数（CHG-VIR-12-E）
 * R3 保守底线：exact 仅 manual_confirmed 一致触发；任何冲突全 candidate。
 */

import { describe, it, expect } from 'vitest'
import {
  rollupCatalogProviderRefs,
  type VideoRefObservation,
} from '@/api/services/identity/externalRefRollup'

function obs(externalId: string, matchStatus: VideoRefObservation['matchStatus'], videoId = 'v1'): VideoRefObservation {
  return { videoId, externalId, matchStatus }
}

describe('rollupCatalogProviderRefs（D-177-4 四行规则表）', () => {
  it('空输入 → 空产出', () => {
    expect(rollupCatalogProviderRefs([])).toEqual([])
  })

  it('行1：多 video manual_confirmed 同一 ID → exact（confirmed-consensus）', () => {
    const r = rollupCatalogProviderRefs([
      obs('100', 'manual_confirmed', 'v1'),
      obs('100', 'manual_confirmed', 'v2'),
    ])
    expect(r).toEqual([{ externalId: '100', relation: 'exact', rollupRule: 'confirmed-consensus' }])
  })

  it('行4：单 video manual_confirmed → exact（同 catalog 内无歧义）', () => {
    const r = rollupCatalogProviderRefs([obs('100', 'manual_confirmed')])
    expect(r).toEqual([{ externalId: '100', relation: 'exact', rollupRule: 'confirmed-consensus' }])
  })

  it('行1 变体：confirmed + auto 指向同一 ID（auto 无异议）→ exact', () => {
    const r = rollupCatalogProviderRefs([
      obs('100', 'manual_confirmed', 'v1'),
      obs('100', 'auto_matched', 'v2'),
    ])
    expect(r).toEqual([{ externalId: '100', relation: 'exact', rollupRule: 'confirmed-consensus' }])
  })

  it('行2：仅 auto_matched 同一 ID → candidate（保守待人工升 exact / R3）', () => {
    const r = rollupCatalogProviderRefs([
      obs('200', 'auto_matched', 'v1'),
      obs('200', 'auto_matched', 'v2'),
    ])
    expect(r).toEqual([{ externalId: '200', relation: 'candidate', rollupRule: 'auto-consensus' }])
  })

  it('行3：confirmed 与 auto 指向不同 ID → 冲突，全部 candidate 不自动 exact（R3）', () => {
    const r = rollupCatalogProviderRefs([
      obs('100', 'manual_confirmed', 'v1'),
      obs('200', 'auto_matched', 'v2'),
    ])
    expect(r).toEqual([
      { externalId: '100', relation: 'candidate', rollupRule: 'conflict' },
      { externalId: '200', relation: 'candidate', rollupRule: 'conflict' },
    ])
  })

  it('行3：多 confirmed 互斥 → 全部 candidate（人工确认彼此矛盾）', () => {
    const r = rollupCatalogProviderRefs([
      obs('100', 'manual_confirmed', 'v1'),
      obs('200', 'manual_confirmed', 'v2'),
    ])
    expect(r.every((d) => d.relation === 'candidate' && d.rollupRule === 'conflict')).toBe(true)
    expect(r.map((d) => d.externalId).sort()).toEqual(['100', '200'])
  })

  it('行3：多 auto 互斥 → 全部 candidate', () => {
    const r = rollupCatalogProviderRefs([
      obs('200', 'auto_matched', 'v1'),
      obs('300', 'auto_matched', 'v2'),
    ])
    expect(r.every((d) => d.relation === 'candidate' && d.rollupRule === 'conflict')).toBe(true)
  })

  it('确定性：产出按 externalId 升序（冲突分支），重复输入幂等', () => {
    const input = [
      obs('300', 'auto_matched', 'v1'),
      obs('100', 'manual_confirmed', 'v2'),
      obs('200', 'manual_confirmed', 'v3'),
    ]
    const r1 = rollupCatalogProviderRefs(input)
    const r2 = rollupCatalogProviderRefs([...input].reverse())
    expect(r1).toEqual(r2)
    expect(r1.map((d) => d.externalId)).toEqual(['100', '200', '300'])
  })
})
