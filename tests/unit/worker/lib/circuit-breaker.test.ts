import { describe, it, expect, beforeEach } from 'vitest'
import {
  shouldSkipSite,
  recordFailure,
  recordSuccess,
  getCircuitState,
  resetAll,
} from '../../../../apps/worker/src/lib/circuit-breaker'
import { config } from '../../../../apps/worker/src/config'

const { failureThreshold, windowMs, cooldownMs } = config.circuitBreaker

describe('circuit-breaker', () => {
  beforeEach(() => resetAll())

  it('clears on fresh site', () => {
    expect(shouldSkipSite('test.com')).toBe(false)
    expect(getCircuitState('test.com')).toBe('cleared')
  })

  it('does not trip below threshold', () => {
    for (let i = 0; i < failureThreshold - 1; i++) {
      recordFailure('test.com')
    }
    expect(shouldSkipSite('test.com')).toBe(false)
  })

  it('trips at threshold', () => {
    for (let i = 0; i < failureThreshold; i++) {
      recordFailure('test.com')
    }
    expect(shouldSkipSite('test.com')).toBe(true)
    expect(getCircuitState('test.com')).toBe('active')
  })

  it('resets after cooldown expires', () => {
    const now = Date.now()
    for (let i = 0; i < failureThreshold; i++) {
      recordFailure('test.com', now)
    }
    expect(shouldSkipSite('test.com', now + cooldownMs + 1)).toBe(false)
    expect(getCircuitState('test.com', now + cooldownMs + 1)).toBe('cleared')
  })

  it('pruned failures outside window do not count', () => {
    const old = Date.now() - windowMs - 1000
    for (let i = 0; i < failureThreshold; i++) {
      recordFailure('test.com', old)
    }
    expect(shouldSkipSite('test.com', Date.now())).toBe(false)
  })

  it('recordSuccess clears failures', () => {
    for (let i = 0; i < failureThreshold; i++) {
      recordFailure('test.com')
    }
    recordSuccess('test.com')
    expect(shouldSkipSite('test.com')).toBe(false)
    expect(getCircuitState('test.com')).toBe('cleared')
  })

  it('isolates different sites', () => {
    for (let i = 0; i < failureThreshold; i++) {
      recordFailure('bad.com')
    }
    expect(shouldSkipSite('good.com')).toBe(false)
    expect(shouldSkipSite('bad.com')).toBe(true)
  })
})

// SRCHEALTH-P3-3-B1（arch-reviewer 裁决 B）：翻转信号返回值——仅翻转事件触发 host_health 落库
describe('CircuitTransition 翻转信号', () => {
  beforeEach(() => resetAll())

  it('recordFailure 跨阈值那一次返回 tripped，之前与之后均返回 null', () => {
    const now = Date.now()
    for (let i = 0; i < failureThreshold - 1; i++) {
      expect(recordFailure('h.com', now)).toBe(null)
    }
    expect(recordFailure('h.com', now)).toBe('tripped')
    // 已在 cooldown 中继续失败：不重复返回 tripped（防写放大）
    expect(recordFailure('h.com', now + 1)).toBe(null)
  })

  it('recordSuccess 在有 cooldown 记录时返回 recovered，否则 null', () => {
    expect(recordSuccess('h.com')).toBe(null)
    const now = Date.now()
    for (let i = 0; i < failureThreshold; i++) recordFailure('h.com', now)
    expect(recordSuccess('h.com')).toBe('recovered')
    // 已恢复后再次 success：null（正常源恒 success 不产生写放大）
    expect(recordSuccess('h.com')).toBe(null)
  })

  it('cooldown 自然过期后新一轮失败重新累计，再次跨阈值返回 tripped（新熔断事件）', () => {
    const now = Date.now()
    for (let i = 0; i < failureThreshold; i++) recordFailure('h.com', now)
    const after = now + cooldownMs + windowMs + 1
    // 过期后第一次失败：旧 cooldown/窗口已清，从零累计 → null
    expect(recordFailure('h.com', after)).toBe(null)
    for (let i = 1; i < failureThreshold - 1; i++) {
      expect(recordFailure('h.com', after)).toBe(null)
    }
    expect(recordFailure('h.com', after)).toBe('tripped')
  })

  it('cooldown 过期后 recordSuccess 仍返回 recovered 一次（清 PG 旧行 + 刷观测字段）', () => {
    const now = Date.now()
    for (let i = 0; i < failureThreshold; i++) recordFailure('h.com', now)
    // 不经 shouldSkipSite 清理，内存 cooldownUntil 仍挂旧值
    expect(recordSuccess('h.com')).toBe('recovered')
  })
})
