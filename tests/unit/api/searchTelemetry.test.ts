/**
 * searchTelemetry.test.ts — 搜索埋点工具单测（ADR-200 D-200-10.2 / .4）
 *
 * 覆盖：hashQuery 加盐/盐缺失 fail-closed/归一一致性 + checkTelemetryLimit 桶逻辑
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { hashQuery, checkTelemetryLimit } from '@/api/lib/searchTelemetry'

const SALT = 'TEST_SEARCH_SALT_XYZ'

describe('hashQuery（PII 红线 D-200-10.2）', () => {
  beforeEach(() => { process.env.SEARCH_TELEMETRY_SALT = SALT })
  afterEach(() => { delete process.env.SEARCH_TELEMETRY_SALT })

  it('盐存在 → 返回 16 位 hex（64-bit 截断）', () => {
    const h = hashQuery('钢铁侠')
    expect(h).toMatch(/^[0-9a-f]{16}$/)
  })

  it('同一 query（归一后）哈希稳定一致 → 支撑 query↔click 关联', () => {
    expect(hashQuery('  GangTie  ')).toBe(hashQuery('gangtie')) // trim + toLowerCase 归一
  })

  it('不同 query → 不同哈希', () => {
    expect(hashQuery('a')).not.toBe(hashQuery('b'))
  })

  it('盐缺失 → fail-closed 返 null（不泄明文、route 仅写 query_len）', () => {
    delete process.env.SEARCH_TELEMETRY_SALT
    expect(hashQuery('钢铁侠')).toBeNull()
  })

  it('哈希不含明文 query（不可逆脱敏）', () => {
    const h = hashQuery('secret@example.com')
    expect(h).not.toContain('secret')
    expect(h).not.toContain('example')
  })
})

describe('checkTelemetryLimit（限流桶 D-200-10-D）', () => {
  afterEach(() => { vi.useRealTimers() })

  it('窗口内同 userId 前 60 次放行、第 61 次拒', () => {
    const uid = `u-${Math.random()}`
    for (let i = 0; i < 60; i++) expect(checkTelemetryLimit(uid)).toBe(true)
    expect(checkTelemetryLimit(uid)).toBe(false)
  })

  it('不同 userId 计数独立', () => {
    const a = `a-${Math.random()}`
    const b = `b-${Math.random()}`
    for (let i = 0; i < 60; i++) checkTelemetryLimit(a)
    expect(checkTelemetryLimit(a)).toBe(false)
    expect(checkTelemetryLimit(b)).toBe(true) // b 独立不受 a 影响
  })

  it('窗口过期后重置放行', () => {
    vi.useFakeTimers()
    const uid = `w-${Math.random()}`
    for (let i = 0; i < 60; i++) checkTelemetryLimit(uid)
    expect(checkTelemetryLimit(uid)).toBe(false)
    vi.advanceTimersByTime(60_001) // 窗口 60s 过期
    expect(checkTelemetryLimit(uid)).toBe(true)
  })
})
