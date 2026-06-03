/**
 * identity-evidence-hash.test.ts — evidence_hash 确定性 + 输入域（CHG-VIR-8 / ADR-105a D-105a-8 / R7）
 */

import { describe, it, expect } from 'vitest'
import { computeEvidenceHash, type EvidenceHashInput, type PairFieldSnapshot } from '@/api/services/identity/evidenceHash'

function snap(over: Partial<PairFieldSnapshot> = {}): PairFieldSnapshot {
  return {
    coreTitleKey: 'core', year: 2020, type: 'movie', seasonNumber: null,
    releaseMarker: null, episodeStructureDigest: '', metadataDigest: '', ...over,
  }
}

function input(over: Partial<EvidenceHashInput> = {}): EvidenceHashInput {
  return {
    canonicalPairKey: 'a|b',
    parserVersion: '1.0.0',
    scorerVersion: '1.0.0',
    thresholdConfigVersion: '1.0.0',
    blockingKeys: ['core'],
    fieldSnapshot: { left: snap(), right: snap() },
    externalRefSummary: [],
    strongNegativeReasons: [],
    ...over,
  }
}

describe('computeEvidenceHash — 确定性 + 幂等基础', () => {
  it('同输入恒等（确定性）', () => {
    expect(computeEvidenceHash(input())).toBe(computeEvidenceHash(input()))
  })

  it('sha256 hex（64 字符）', () => {
    expect(computeEvidenceHash(input())).toMatch(/^[a-f0-9]{64}$/)
  })

  it('数组乱序 → 同 hash（④⑥⑦ dedupeSort 消除顺序敏感）', () => {
    const a = computeEvidenceHash(input({ strongNegativeReasons: ['season_mismatch', 'release_marker_mismatch'] }))
    const b = computeEvidenceHash(input({ strongNegativeReasons: ['release_marker_mismatch', 'season_mismatch'] }))
    expect(a).toBe(b)
  })

  it('数组去重 → 同 hash', () => {
    const a = computeEvidenceHash(input({ blockingKeys: ['x', 'x', 'y'] }))
    const b = computeEvidenceHash(input({ blockingKeys: ['y', 'x'] }))
    expect(a).toBe(b)
  })
})

describe('computeEvidenceHash — 输入域八项逐一影响（变则 hash 变）', () => {
  const base = computeEvidenceHash(input())

  it('① canonicalPairKey', () => {
    expect(computeEvidenceHash(input({ canonicalPairKey: 'x|y' }))).not.toBe(base)
  })
  it('② parserVersion', () => {
    expect(computeEvidenceHash(input({ parserVersion: '2.0.0' }))).not.toBe(base)
  })
  it('③ scorerVersion', () => {
    expect(computeEvidenceHash(input({ scorerVersion: '2.0.0' }))).not.toBe(base)
  })
  it('④ blockingKeys', () => {
    expect(computeEvidenceHash(input({ blockingKeys: ['z'] }))).not.toBe(base)
  })
  it('⑤ fieldSnapshot.seasonNumber', () => {
    expect(computeEvidenceHash(input({ fieldSnapshot: { left: snap({ seasonNumber: 2 }), right: snap() } }))).not.toBe(base)
  })
  it('⑤ fieldSnapshot.releaseMarker', () => {
    expect(computeEvidenceHash(input({ fieldSnapshot: { left: snap({ releaseMarker: '剧场版' }), right: snap() } }))).not.toBe(base)
  })
  it('⑥ externalRefSummary', () => {
    expect(computeEvidenceHash(input({ externalRefSummary: ['L:imdb:tt1'] }))).not.toBe(base)
  })
  it('⑦ strongNegativeReasons', () => {
    expect(computeEvidenceHash(input({ strongNegativeReasons: ['season_mismatch'] }))).not.toBe(base)
  })
  it('⑧ thresholdConfigVersion', () => {
    expect(computeEvidenceHash(input({ thresholdConfigVersion: '2.0.0' }))).not.toBe(base)
  })
})

describe('computeEvidenceHash — R7 排除非证据字段', () => {
  it('输入域类型不含 created_at/job-id/row-id（结构保证）→ 同 8 项恒同 hash', () => {
    // EvidenceHashInput 类型根本无 created_at/jobId 字段（编译期保证 R7）；
    // 运行时构造两次相同 8 项输入 → 同 hash，证明无隐藏时变量
    const h1 = computeEvidenceHash(input())
    const h2 = computeEvidenceHash(input())
    expect(h1).toBe(h2)
  })
})
