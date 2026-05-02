import { describe, it, expect, vi } from 'vitest'
import { withRetry } from '../../../../apps/worker/src/lib/retry-backoff'

vi.mock('../../../../apps/worker/src/config', () => ({
  config: {
    retry: {
      maxAttempts: 3,
      backoffMs: [0, 0, 0],
    },
  },
}))

describe('withRetry', () => {
  it('returns immediately on success', async () => {
    const fn = vi.fn().mockResolvedValue('ok')
    const result = await withRetry(fn)
    expect(result).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('retries up to maxAttempts and throws last error', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('fail'))
    await expect(withRetry(fn)).rejects.toThrow('fail')
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('succeeds on second attempt', async () => {
    let calls = 0
    const fn = vi.fn().mockImplementation(async () => {
      calls++
      if (calls === 1) throw new Error('first fail')
      return 'ok'
    })
    const result = await withRetry(fn)
    expect(result).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('calls onRetry callback on each retry', async () => {
    const onRetry = vi.fn()
    const fn = vi.fn().mockRejectedValue(new Error('fail'))
    await expect(withRetry(fn, onRetry)).rejects.toThrow()
    expect(onRetry).toHaveBeenCalledTimes(2)
  })
})
