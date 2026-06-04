/**
 * merge-entry.test.ts — /admin/merge 深链构造单一真源（CHG-VIR-13-A1）
 *
 * 覆盖：
 *  1. merge-pair 全参数 → 顺序契约 candidate_a → candidate_b → from → candidate_id
 *  2. merge-pair 最小参数（仅 candidateA + from）
 *  3. split 形态（split → from）
 *  4. batch-merge 形态（ids csv → from）
 *  5. tab 形态（含/不含 from）
 *  6. 特殊字符 URL 编码
 *  7. isMergeEntrySource 守卫
 *  8. MERGE_ENTRY_SOURCE_META 覆盖全部枚举值
 */
import { describe, it, expect } from 'vitest'
import {
  buildMergeHref,
  isMergeEntrySource,
  MERGE_ENTRY_SOURCES,
  MERGE_ENTRY_SOURCE_META,
} from '../../../apps/server-next/src/lib/merge/entry'

describe('buildMergeHref', () => {
  it('1. merge-pair 全参数：candidate_a → candidate_b → from → candidate_id 顺序契约', () => {
    expect(
      buildMergeHref({
        kind: 'merge-pair',
        candidateA: 'target-uuid',
        candidateB: 'v9',
        candidateId: 'cand-uuid-0001',
        from: 'moderation',
      }),
    ).toBe('/admin/merge?candidate_a=target-uuid&candidate_b=v9&from=moderation&candidate_id=cand-uuid-0001')
  })

  it('2. merge-pair 最小参数：仅 candidateA + from（视频库行级形态）', () => {
    expect(
      buildMergeHref({ kind: 'merge-pair', candidateA: 'abc-123', from: 'videos' }),
    ).toBe('/admin/merge?candidate_a=abc-123&from=videos')
  })

  it('3. split 形态：split → from', () => {
    expect(
      buildMergeHref({ kind: 'split', videoId: 'video-uuid-abc', from: 'moderation' }),
    ).toBe('/admin/merge?split=video-uuid-abc&from=moderation')
  })

  it('4. batch-merge 形态：ids csv → from', () => {
    expect(
      buildMergeHref({ kind: 'batch-merge', ids: ['id-1', 'id-2', 'id-3'], from: 'moderation-batch' }),
    ).toBe('/admin/merge?ids=id-1%2Cid-2%2Cid-3&from=moderation-batch')
  })

  it('5. tab 形态：含 from（audit rollback）与不含 from', () => {
    expect(
      buildMergeHref({ kind: 'tab', tab: 'merged', from: 'audit-rollback' }),
    ).toBe('/admin/merge?tab=merged&from=audit-rollback')
    expect(buildMergeHref({ kind: 'tab', tab: 'split' })).toBe('/admin/merge?tab=split')
  })

  it('6. 特殊字符 URL 编码（URLSearchParams 语义）', () => {
    const href = buildMergeHref({ kind: 'merge-pair', candidateA: 'a&b=c', from: 'videos' })
    expect(href).toBe('/admin/merge?candidate_a=a%26b%3Dc&from=videos')
  })
})

describe('isMergeEntrySource', () => {
  it('7. 守卫：合法值通过 / 非法值与 null/undefined 拒绝', () => {
    for (const s of MERGE_ENTRY_SOURCES) expect(isMergeEntrySource(s)).toBe(true)
    expect(isMergeEntrySource('unknown')).toBe(false)
    expect(isMergeEntrySource(null)).toBe(false)
    expect(isMergeEntrySource(undefined)).toBe(false)
    expect(isMergeEntrySource('')).toBe(false)
  })
})

describe('MERGE_ENTRY_SOURCE_META', () => {
  it('8. 每个枚举值都有 label/backHref/backLabel（回链栏数据完整性）', () => {
    for (const s of MERGE_ENTRY_SOURCES) {
      const meta = MERGE_ENTRY_SOURCE_META[s]
      expect(meta.label.length).toBeGreaterThan(0)
      expect(meta.backHref.startsWith('/admin/')).toBe(true)
      expect(meta.backLabel.length).toBeGreaterThan(0)
    }
  })
})
