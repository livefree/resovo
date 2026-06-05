/**
 * MergeCandidatesFilters.test.tsx — filters Map → 组级检索参数纯函数
 * （CHG-VIR-16-TBL-FE / D-105a-19）
 *
 * buildCandidateSearchParams：相似度 % → 0..1（clamp 防 zod 422）/ 候选数整数 ≥2 /
 * min>max 交换规范化 / q 文本。搜索框组件交互在 MergeCandidatesSection.test 10d/10g 覆盖。
 */

import { describe, it, expect } from 'vitest'
import type { FilterValue } from '@resovo/admin-ui'
import { buildCandidateSearchParams } from '../../../../../../apps/server-next/src/app/admin/merge/_client/MergeCandidatesFilters'

function filtersOf(entries: Record<string, FilterValue>): ReadonlyMap<string, FilterValue> {
  return new Map(Object.entries(entries))
}

describe('buildCandidateSearchParams (D-105a-19)', () => {
  it('空 filters → {}（缺省维度不发送）', () => {
    expect(buildCandidateSearchParams(new Map())).toEqual({})
  })

  it('相似度 % → 0..1（÷100）；单边区间只发送对应端', () => {
    expect(buildCandidateSearchParams(filtersOf({
      identityScore: { kind: 'range', min: 80, max: 95 },
    }))).toEqual({ identityScoreMin: 0.8, identityScoreMax: 0.95 })
    expect(buildCandidateSearchParams(filtersOf({
      identityScore: { kind: 'range', min: 60 },
    }))).toEqual({ identityScoreMin: 0.6 })
  })

  it('相似度越界 clamp（>100 → 1 / <0 → 0，防 zod 422）', () => {
    expect(buildCandidateSearchParams(filtersOf({
      identityScore: { kind: 'range', min: -10, max: 150 },
    }))).toEqual({ identityScoreMin: 0, identityScoreMax: 1 })
  })

  it('min > max → 前端交换规范化（输入顺序防御）', () => {
    expect(buildCandidateSearchParams(filtersOf({
      identityScore: { kind: 'range', min: 95, max: 80 },
    }))).toEqual({ identityScoreMin: 0.8, identityScoreMax: 0.95 })
    expect(buildCandidateSearchParams(filtersOf({
      videoCount: { kind: 'range', min: 5, max: 3 },
    }))).toEqual({ videoCountMin: 3, videoCountMax: 5 })
  })

  it('候选数整数化 + 下限 2（组成员数 ≥2 / zod min(2) 同口径）', () => {
    expect(buildCandidateSearchParams(filtersOf({
      videoCount: { kind: 'range', min: 1, max: 3.4 },
    }))).toEqual({ videoCountMin: 2, videoCountMax: 3 })
  })

  it('q 文本透传；非 text/空值不发送', () => {
    expect(buildCandidateSearchParams(filtersOf({
      q: { kind: 'text', value: '斗破' },
    }))).toEqual({ q: '斗破' })
    expect(buildCandidateSearchParams(filtersOf({
      q: { kind: 'text', value: '' },
    }))).toEqual({})
  })

  it('多维联合（区间 + q）', () => {
    expect(buildCandidateSearchParams(filtersOf({
      identityScore: { kind: 'range', min: 70 },
      videoCount: { kind: 'range', max: 5 },
      q: { kind: 'text', value: 'x' },
    }))).toEqual({ identityScoreMin: 0.7, videoCountMax: 5, q: 'x' })
  })
})
