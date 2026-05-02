import { describe, it, expect, vi } from 'vitest'
import { withVideoLock } from '../../../../apps/worker/src/lib/advisory-lock'
import type { PoolClient } from 'pg'

function makeClient(queryFn = vi.fn().mockResolvedValue({ rows: [] })): PoolClient {
  return { query: queryFn, release: vi.fn() } as unknown as PoolClient
}

describe('withVideoLock', () => {
  it('wraps fn in BEGIN/lock/COMMIT', async () => {
    const queryFn = vi.fn().mockResolvedValue({ rows: [] })
    const client = makeClient(queryFn)
    const fn = vi.fn().mockResolvedValue('result')

    const result = await withVideoLock(client, 'vid-123', fn)

    expect(result).toBe('result')
    expect(queryFn).toHaveBeenNthCalledWith(1, 'BEGIN')
    expect(queryFn.mock.calls[1][0]).toContain('pg_advisory_xact_lock')
    expect(queryFn.mock.calls[1][1]).toEqual(['video:vid-123'])
    expect(queryFn).toHaveBeenNthCalledWith(3, 'COMMIT')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('rolls back on fn error', async () => {
    const queryFn = vi.fn().mockResolvedValue({ rows: [] })
    const client = makeClient(queryFn)
    const fn = vi.fn().mockRejectedValue(new Error('boom'))

    await expect(withVideoLock(client, 'vid-456', fn)).rejects.toThrow('boom')
    const calls = queryFn.mock.calls.map((c) => c[0])
    expect(calls).toContain('ROLLBACK')
    expect(calls).not.toContain('COMMIT')
  })
})
