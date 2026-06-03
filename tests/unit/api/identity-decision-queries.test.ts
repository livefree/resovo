/**
 * identity-decision-queries.test.ts — identity_decisions DB query SQL/参数（CHG-VIR-9-B / ADR-178）
 * mock PoolClient，断言关键 SQL 片段 + 参数（仿 identity-candidate-queries.test.ts 范式）。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  insertIdentityDecision,
  findConfirmedDecisionByAuditId,
  markDecisionReverted,
} from '@/api/db/queries/identity-decision'

const mockQuery = vi.fn()
const mockClient = { query: mockQuery } as unknown as import('pg').PoolClient

beforeEach(() => {
  mockQuery.mockReset()
  mockQuery.mockResolvedValue({ rows: [] })
})

function lastSql(): string {
  return String(mockQuery.mock.calls[mockQuery.mock.calls.length - 1]![0])
}
function lastParams(): unknown[] {
  return mockQuery.mock.calls[mockQuery.mock.calls.length - 1]![1] as unknown[]
}

describe('insertIdentityDecision', () => {
  it('confirmed 传 videoMergeAuditId（R8）+ RETURNING id', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'd1' }] })
    const id = await insertIdentityDecision(mockClient, {
      candidateId: 'c1',
      decision: 'confirmed',
      videoMergeAuditId: 'a1',
      performedBy: 'u1',
      reason: null,
    })
    expect(lastSql()).toContain('INSERT INTO identity_decisions')
    expect(lastSql()).toContain('RETURNING id')
    expect(lastParams()).toEqual(['c1', 'confirmed', 'a1', 'u1', 'human', null])
    expect(id).toBe('d1')
  })

  it('rejected 传 videoMergeAuditId=null（audit 关联仅 confirmed / D-178-2）', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'd2' }] })
    await insertIdentityDecision(mockClient, {
      candidateId: 'c1',
      decision: 'rejected',
      videoMergeAuditId: null,
      performedBy: 'u1',
      reason: '人工拒绝',
    })
    expect(lastParams()).toEqual(['c1', 'rejected', null, 'u1', 'human', '人工拒绝'])
  })

  it('actorType 缺省 human / 显式 system 透传（D-105a-11 预留）', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'd3' }] })
    await insertIdentityDecision(mockClient, {
      candidateId: 'c1',
      decision: 'rejected',
      videoMergeAuditId: null,
      performedBy: 'u1',
      actorType: 'system',
      reason: null,
    })
    expect(lastParams()[4]).toBe('system')
  })
})

describe('findConfirmedDecisionByAuditId', () => {
  it("WHERE audit_id + decision='confirmed' + reverted_at IS NULL", async () => {
    await findConfirmedDecisionByAuditId(mockClient, 'a1')
    const sql = lastSql()
    expect(sql).toContain('video_merge_audit_id = $1')
    expect(sql).toContain("decision = 'confirmed'")
    expect(sql).toContain('reverted_at IS NULL')
    expect(lastParams()).toEqual(['a1'])
  })

  it('无命中 → null', async () => {
    const r = await findConfirmedDecisionByAuditId(mockClient, 'a1')
    expect(r).toBeNull()
  })
})

describe('markDecisionReverted', () => {
  it('原地置 reverted 三列、不改 decision 值（D-178-4）', async () => {
    await markDecisionReverted(mockClient, 'd1', 'u2', '撤销合并')
    const sql = lastSql()
    expect(sql).toContain('reverted_at = NOW()')
    expect(sql).toContain('reverted_by = $2')
    expect(sql).toContain('reverted_reason = $3')
    expect(sql).not.toContain("decision = ")
    expect(lastParams()).toEqual(['d1', 'u2', '撤销合并'])
  })

  it('reason null 透传', async () => {
    await markDecisionReverted(mockClient, 'd1', 'u2', null)
    expect(lastParams()).toEqual(['d1', 'u2', null])
  })
})
