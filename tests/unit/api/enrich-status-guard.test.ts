/**
 * enrich-status-guard.test.ts — ADR-219 D-219-3 / META-57 守卫
 *
 * 验证 guardEnrichStatusAgainstAppliedRef 仅守 unmatched 降级（已有 applied ref → matched）
 * + hasAppliedVideoRef 复用 findPrimaryVideoExternalRef + isVideoRefApplied（同源 DC-219-1，
 * 强制 is_primary + auto/confirmed 阈值）。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Pool } from 'pg'
import type { ExternalRefMatchStatus, ExternalRefProvider } from '@resovo/types'

const findPrimaryVideoExternalRef = vi.fn()
vi.mock('@/api/db/queries/externalData', () => ({
  findPrimaryVideoExternalRef: (...args: unknown[]) => findPrimaryVideoExternalRef(...args),
}))

const { hasAppliedVideoRef, guardEnrichStatusAgainstAppliedRef } = await import(
  '@/api/services/enrich-status-guard'
)

const DB = {} as unknown as Pool

function primaryRef(matchStatus: ExternalRefMatchStatus, isPrimary = true) {
  return { matchStatus, isPrimary, provider: 'douban' as ExternalRefProvider, externalId: 'x' }
}

beforeEach(() => {
  findPrimaryVideoExternalRef.mockReset()
})

describe('hasAppliedVideoRef', () => {
  it('primary ref = auto_matched/manual_confirmed → true', async () => {
    findPrimaryVideoExternalRef.mockResolvedValueOnce(primaryRef('auto_matched'))
    expect(await hasAppliedVideoRef(DB, 'v', 'douban')).toBe(true)
    findPrimaryVideoExternalRef.mockResolvedValueOnce(primaryRef('manual_confirmed'))
    expect(await hasAppliedVideoRef(DB, 'v', 'douban')).toBe(true)
  })

  it('primary ref = candidate/rejected → false（仅 applied 算）', async () => {
    findPrimaryVideoExternalRef.mockResolvedValueOnce(primaryRef('candidate'))
    expect(await hasAppliedVideoRef(DB, 'v', 'douban')).toBe(false)
    findPrimaryVideoExternalRef.mockResolvedValueOnce(primaryRef('rejected'))
    expect(await hasAppliedVideoRef(DB, 'v', 'douban')).toBe(false)
  })

  it('无 primary ref（null）→ false', async () => {
    findPrimaryVideoExternalRef.mockResolvedValueOnce(null)
    expect(await hasAppliedVideoRef(DB, 'v', 'bangumi')).toBe(false)
  })
})

describe('guardEnrichStatusAgainstAppliedRef', () => {
  it("computed='unmatched' + 有 applied ref → 'matched'（消除覆写竞态）", async () => {
    findPrimaryVideoExternalRef.mockResolvedValueOnce(primaryRef('auto_matched'))
    expect(await guardEnrichStatusAgainstAppliedRef(DB, 'v', 'douban', 'unmatched')).toBe('matched')
  })

  it("computed='unmatched' + 无 applied ref → 'unmatched'（真未匹配照常写）", async () => {
    findPrimaryVideoExternalRef.mockResolvedValueOnce(null)
    expect(await guardEnrichStatusAgainstAppliedRef(DB, 'v', 'douban', 'unmatched')).toBe('unmatched')
  })

  it("computed='matched'/'candidate'/'pending' → 原样且短路不查 ref（仅守 unmatched 降级）", async () => {
    expect(await guardEnrichStatusAgainstAppliedRef(DB, 'v', 'douban', 'matched')).toBe('matched')
    expect(await guardEnrichStatusAgainstAppliedRef(DB, 'v', 'douban', 'candidate')).toBe('candidate')
    expect(await guardEnrichStatusAgainstAppliedRef(DB, 'v', 'bangumi', 'pending')).toBe('pending')
    expect(findPrimaryVideoExternalRef).not.toHaveBeenCalled()
  })

  it('provider 透传给 findPrimaryVideoExternalRef', async () => {
    findPrimaryVideoExternalRef.mockResolvedValueOnce(null)
    await guardEnrichStatusAgainstAppliedRef(DB, 'vid', 'bangumi', 'unmatched')
    expect(findPrimaryVideoExternalRef).toHaveBeenCalledWith(DB, 'vid', 'bangumi')
  })
})
