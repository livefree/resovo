/**
 * tests/unit/api/task-run-reporter.test.ts —
 * ADR-193 D-193-3 / NTLG-P1-c-A NoopTaskRunReporter 契约骨架单测
 *
 * P1 阶段 path A（不建 task_runs）：Reporter 退化为 no-op/log-only。
 * 覆盖：start 返 sentinel 'unlinked' / 可选 ref / progress·finish no-op resolve 不抛错（digest 不落库）
 */
import { describe, it, expect, vi } from 'vitest'
import type { Pool } from 'pg'
import { NoopTaskRunReporter, DbTaskRunReporter, UNLINKED_TASK_RUN_ID } from '@/api/services/TaskRunReporter'

/** mock 最小 Pool（仅 query），query 行为由入参注入 */
function makeDb(queryImpl: (...args: unknown[]) => unknown): { db: Pool; query: ReturnType<typeof vi.fn> } {
  const query = vi.fn(queryImpl)
  return { db: { query } as unknown as Pool, query }
}

describe('NoopTaskRunReporter — P1 契约骨架 (ADR-193 D-193-3)', () => {
  it('start → 返回 sentinel UNLINKED_TASK_RUN_ID（不写 DB）', async () => {
    const id = await new NoopTaskRunReporter().start({ kind: 'crawler', title: 'batch crawl' })
    expect(id).toBe(UNLINKED_TASK_RUN_ID)
    expect(id).toBe('unlinked')
  })

  it('start → 接受可选 ref', async () => {
    const id = await new NoopTaskRunReporter().start({ kind: 'enrich', title: 'x', ref: 'run-1' })
    expect(id).toBe('unlinked')
  })

  it('progress(sentinel, pct) → no-op resolve（不抛错）', async () => {
    await expect(new NoopTaskRunReporter().progress(UNLINKED_TASK_RUN_ID, 50)).resolves.toBeUndefined()
  })

  it('finish(sentinel, success+digest) → no-op resolve（digest 不落库，不抛错）', async () => {
    await expect(
      new NoopTaskRunReporter().finish(UNLINKED_TASK_RUN_ID, {
        status: 'success',
        digest: { summary: '新增 1 视频', metrics: [{ key: 'videos_added', label: '新增视频', value: 1, tone: 'ok' }] },
      }),
    ).resolves.toBeUndefined()
  })

  it('finish(sentinel, failed+error) → no-op resolve', async () => {
    await expect(
      new NoopTaskRunReporter().finish(UNLINKED_TASK_RUN_ID, { status: 'failed', error: 'boom' }),
    ).resolves.toBeUndefined()
  })
})

describe('DbTaskRunReporter — P2 真实实装 (ADR-194 D-194-4)', () => {
  it('start 成功 → 返回 insertTaskRun 落库 id', async () => {
    const { db, query } = makeDb(() => ({ rows: [{ id: '42' }] }))
    const id = await new DbTaskRunReporter(db).start({ kind: 'enrichment', title: '富集批次', ref: 'job-9' })
    expect(id).toBe('42')
    expect(query).toHaveBeenCalledTimes(1)
  })

  it('start DB 失败 → 降级 sentinel（不抛错，作业照常跑 §11 D4）', async () => {
    const { db } = makeDb(() => { throw new Error('db down') })
    const id = await new DbTaskRunReporter(db).start({ kind: 'enrichment', title: 'x' })
    expect(id).toBe(UNLINKED_TASK_RUN_ID)
  })

  it('progress(sentinel) → no-op（不触 DB）', async () => {
    const { db, query } = makeDb(() => ({ rows: [] }))
    await new DbTaskRunReporter(db).progress(UNLINKED_TASK_RUN_ID, 50)
    expect(query).not.toHaveBeenCalled()
  })

  it('progress(realId, 150) → clamp 至 100 写库', async () => {
    const { db, query } = makeDb(() => ({ rows: [] }))
    await new DbTaskRunReporter(db).progress('42', 150)
    expect(query).toHaveBeenCalledTimes(1)
    expect(query.mock.calls[0]![1]).toEqual(['42', 100]) // [id, clamped pct]
  })

  it('progress DB 失败 → 吞错 resolve（不阻断）', async () => {
    const { db } = makeDb(() => { throw new Error('boom') })
    await expect(new DbTaskRunReporter(db).progress('42', 10)).resolves.toBeUndefined()
  })

  it('finish(sentinel) → no-op（不触 DB）', async () => {
    const { db, query } = makeDb(() => ({ rows: [] }))
    await new DbTaskRunReporter(db).finish(UNLINKED_TASK_RUN_ID, { status: 'success' })
    expect(query).not.toHaveBeenCalled()
  })

  it('finish(realId, success+digest) → 终态登记 + digest JSON 落库', async () => {
    const { db, query } = makeDb(() => ({ rows: [] }))
    const digest = { summary: '新增 1 视频', metrics: [{ key: 'videos_added', label: '新增视频', value: 1, tone: 'ok' as const }] }
    await new DbTaskRunReporter(db).finish('42', { status: 'success', digest })
    expect(query).toHaveBeenCalledTimes(1)
    const values = query.mock.calls[0]![1] as unknown[]
    expect(values[0]).toBe('42')
    expect(values[1]).toBe('success')
    expect(values[2]).toBe(JSON.stringify(digest)) // digest → JSON.stringify 落 JSONB
  })

  it('finish DB 失败 → 吞错 resolve（不阻断）', async () => {
    const { db } = makeDb(() => { throw new Error('boom') })
    await expect(
      new DbTaskRunReporter(db).finish('42', { status: 'failed', error: 'x' }),
    ).resolves.toBeUndefined()
  })
})
