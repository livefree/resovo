/**
 * metadata-tooltip.test.ts — buildMetadataTooltip 纯函数单测（META-33-A / ADR-201 §Tooltip）
 *
 * 覆盖：五态 provider 行映射 + 字段降级 / 固定顺序（乱序 Record 对拍）/ issue 截断 0-5 条 /
 *       headline 降级 / nextAction='none' / not_applicable / 凭证未配置不裸露内部 code。
 */
import { describe, it, expect } from 'vitest'
import type { MetadataProvider, MetadataProviderStatus, MetadataStatusSummary } from '@resovo/types'
import { buildMetadataTooltip } from '../../../../../packages/admin-ui/src/components/metadata-status/metadata-tooltip'
import { makeProviderStatus, makeSummary } from './_fixtures'

describe('buildMetadataTooltip — headline', () => {
  it('全字段：元数据 + 完整度 + 最近', () => {
    const s = makeSummary({}, { overall: 'partial', score: 72 })
    const m = buildMetadataTooltip(s, { enrichedAtLabel: '2026-06-14' })
    expect(m.headline).toBe('元数据：部分增强 · 完整度 72 · 最近 2026-06-14')
  })

  it('score=null → 省略完整度段', () => {
    const m = buildMetadataTooltip(makeSummary({}, { overall: 'missing', score: null }))
    expect(m.headline).toBe('元数据：未增强')
  })

  it('enrichedAtLabel 省略 → 省略最近段', () => {
    const m = buildMetadataTooltip(makeSummary({}, { overall: 'complete', score: 90 }))
    expect(m.headline).toBe('元数据：已增强 · 完整度 90')
  })
})

describe('buildMetadataTooltip — provider 行五态映射', () => {
  it('applied：来源 + 外部ID + 匹配方式 + 置信度', () => {
    const s = makeSummary({
      douban: { state: 'applied', externalId: '3541415', matchMethod: 'manual', confidence: 0.92 },
    })
    expect(buildMetadataTooltip(s).providerLines[0]).toBe('豆瓣：已应用 · 3541415 · 人工 0.92')
  })

  it('candidate：label 优先于 externalId + 无 matchMethod', () => {
    const s = makeSummary({
      bangumi: { state: 'candidate', externalId: '123456', label: 'bgm.tv/123456' },
    })
    expect(buildMetadataTooltip(s).providerLines[1]).toBe('Bangumi：待确认 · bgm.tv/123456')
  })

  it('未知 matchMethod → 回退原始串', () => {
    const s = makeSummary({ douban: { state: 'applied', matchMethod: 'fuzzy_x' } })
    expect(buildMetadataTooltip(s).providerLines[0]).toBe('豆瓣：已应用 · fuzzy_x')
  })

  it('confidence 无 matchMethod → 单独显示置信度', () => {
    const s = makeSummary({ douban: { state: 'candidate', confidence: 0.5 } })
    expect(buildMetadataTooltip(s).providerLines[0]).toBe('豆瓣：待确认 · 0.50')
  })

  it('missing → 仅状态（不裸露内部 reasonCode）', () => {
    const s = makeSummary({ tmdb: { state: 'missing', reasonCodes: ['cache_only_no_ref'] } })
    expect(buildMetadataTooltip(s).providerLines[2]).toBe('TMDB：未获取')
  })

  it('not_applicable → 仅「不适用」，无 ID/method', () => {
    const s = makeSummary({
      bangumi: { state: 'not_applicable', externalId: '999', matchMethod: 'manual', confidence: 0.9 },
    })
    expect(buildMetadataTooltip(s).providerLines[1]).toBe('Bangumi：不适用')
  })

  it('problem：全彩有 ID', () => {
    const s = makeSummary({ douban: { state: 'problem', externalId: '111', issueLevel: 'danger' } })
    expect(buildMetadataTooltip(s).providerLines[0]).toBe('豆瓣：异常 · 111')
  })
})

describe('buildMetadataTooltip — 固定顺序（不依赖 Record key 序，C5）', () => {
  it('乱序构造 providers Record → providerLines 恒 douban/bangumi/tmdb/imdb', () => {
    // 故意以 imdb→tmdb→bangumi→douban 顺序插入 key
    const providers = {} as Record<MetadataProvider, MetadataProviderStatus>
    providers.imdb = makeProviderStatus('imdb', { state: 'missing' })
    providers.tmdb = makeProviderStatus('tmdb', { state: 'missing' })
    providers.bangumi = makeProviderStatus('bangumi', { state: 'applied', externalId: 'b1' })
    providers.douban = makeProviderStatus('douban', { state: 'applied', externalId: 'd1' })
    const s: MetadataStatusSummary = makeSummary()
    ;(s as { providers: Record<MetadataProvider, MetadataProviderStatus> }).providers = providers
    const lines = buildMetadataTooltip(s).providerLines
    expect(lines[0].startsWith('豆瓣')).toBe(true)
    expect(lines[1].startsWith('Bangumi')).toBe(true)
    expect(lines[2].startsWith('TMDB')).toBe(true)
    expect(lines[3].startsWith('IMDb')).toBe(true)
  })
})

describe('buildMetadataTooltip — issue 截断（C7 边界）', () => {
  function issues(n: number) {
    return Array.from({ length: n }, (_, i) => ({
      code: 'candidate_unconfirmed' as const,
      level: 'warn' as const,
      provider: 'bangumi' as const,
      message: `m${i}`,
      action: 'confirm_candidate' as const,
    }))
  }

  it('0 条 → 空数组', () => {
    expect(buildMetadataTooltip(makeSummary()).issueLines).toEqual([])
  })

  it('3 条 → 全显，无「另有」', () => {
    const m = buildMetadataTooltip(makeSummary({}, { issues: issues(3) }))
    expect(m.issueLines).toHaveLength(3)
    expect(m.issueLines.some((l) => l.includes('另有'))).toBe(false)
  })

  it('4 条 → 第 3 行「另有 2 个问题」', () => {
    const m = buildMetadataTooltip(makeSummary({}, { issues: issues(4) }))
    expect(m.issueLines).toHaveLength(3)
    expect(m.issueLines[2]).toBe('另有 2 个问题')
  })

  it('5 条 → 第 3 行「另有 3 个问题」', () => {
    const m = buildMetadataTooltip(makeSummary({}, { issues: issues(5) }))
    expect(m.issueLines[2]).toBe('另有 3 个问题')
  })

  it('issue 行：来源 + 问题码中文', () => {
    const m = buildMetadataTooltip(makeSummary({}, { issues: issues(1) }))
    expect(m.issueLines[0]).toBe('问题：Bangumi 候选尚未应用')
  })

  it('未知 issue code → 回退 message 英文友好名', () => {
    const s = makeSummary({}, {
      issues: [{ code: 'weird_code', level: 'warn', provider: null, message: 'something odd', action: 'none' }],
    })
    expect(buildMetadataTooltip(s).issueLines[0]).toBe('问题：something odd')
  })
})

describe('buildMetadataTooltip — nextAction', () => {
  it("nextAction='none' → nextActionLine undefined", () => {
    expect(buildMetadataTooltip(makeSummary()).nextActionLine).toBeUndefined()
  })

  it('nextAction=confirm_candidate → 下一步：确认候选', () => {
    const m = buildMetadataTooltip(makeSummary({}, { nextAction: 'confirm_candidate' }))
    expect(m.nextActionLine).toBe('下一步：确认候选')
  })
})
