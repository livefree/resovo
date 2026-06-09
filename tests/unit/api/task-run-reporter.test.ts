/**
 * tests/unit/api/task-run-reporter.test.ts —
 * ADR-193 D-193-3 / NTLG-P1-c-A NoopTaskRunReporter 契约骨架单测
 *
 * P1 阶段 path A（不建 task_runs）：Reporter 退化为 no-op/log-only。
 * 覆盖：start 返 sentinel 'unlinked' / 可选 ref / progress·finish no-op resolve 不抛错（digest 不落库）
 */
import { describe, it, expect } from 'vitest'
import { NoopTaskRunReporter, UNLINKED_TASK_RUN_ID } from '@/api/services/TaskRunReporter'

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
