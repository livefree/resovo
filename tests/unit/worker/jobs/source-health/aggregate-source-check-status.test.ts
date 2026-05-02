import { describe, it, expect } from 'vitest'
import { computeCheckStatus } from '../../../../../apps/worker/src/jobs/source-health/aggregate-source-check-status'
import type { ProbeStatus } from '../../../../../apps/worker/src/types'

describe('computeCheckStatus', () => {
  it('returns pending when all pending', () => {
    expect(computeCheckStatus(['pending', 'pending'])).toBe('pending')
  })

  it('returns all_dead when all dead', () => {
    expect(computeCheckStatus(['dead', 'dead'])).toBe('all_dead')
  })

  it('returns ok when all ok', () => {
    expect(computeCheckStatus(['ok', 'ok'])).toBe('ok')
  })

  it('returns partial when mixed ok and dead', () => {
    expect(computeCheckStatus(['ok', 'dead'])).toBe('partial')
  })

  it('returns partial when mixed ok and pending', () => {
    expect(computeCheckStatus(['ok', 'pending'])).toBe('partial')
  })

  it('returns pending for empty array', () => {
    expect(computeCheckStatus([])).toBe('pending')
  })

  it('handles single ok source', () => {
    expect(computeCheckStatus(['ok'])).toBe('ok')
  })

  it('handles single dead source', () => {
    expect(computeCheckStatus(['dead'])).toBe('all_dead')
  })

  it('returns partial for partial status', () => {
    const statuses: ProbeStatus[] = ['partial', 'ok']
    expect(computeCheckStatus(statuses)).toBe('partial')
  })
})
