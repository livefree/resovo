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
