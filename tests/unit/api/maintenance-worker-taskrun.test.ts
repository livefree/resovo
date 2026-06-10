/**
 * tests/unit/api/maintenance-worker-taskrun.test.ts —
 * ADR-194 D-194-5/8 / NTLG-P2-a-B：maintenance 作业 task_runs 登记辅助单测。
 *
 * 覆盖（纯函数 + run-wrapper，无 bull/es/db 重型依赖——maintenanceWorker.taskrun 运行时仅 type-only import）：
 *   - maintenanceJobTitle：5 类映射 + 未知回退
 *   - buildMaintenanceDigest：5 类作业聚合字段投影 + 恒展示/>0 展示口径 + number 守卫 + 未知键跳过 + 空→undefined
 *   - runMaintenanceJobWithReporter：start→finish(success+digest) / catch-finish(failed+error)+rethrow / runId 透传
 */
import { describe, it, expect, vi } from 'vitest'
import type { TaskRunReporter } from '@resovo/types'
import {
  maintenanceJobTitle,
  buildMaintenanceDigest,
  runMaintenanceJobWithReporter,
} from '@/api/workers/maintenanceWorker.taskrun'
import type { MaintenanceJobResult } from '@/api/workers/maintenanceWorker'

describe('maintenanceJobTitle — 类型→人读标题', () => {
  it('5 类作业各有标题', () => {
    expect(maintenanceJobTitle('auto-publish-staging')).toBe('暂存自动发布')
    expect(maintenanceJobTitle('verify-published-sources')).toBe('已发布源校验')
    expect(maintenanceJobTitle('verify-staging-sources')).toBe('暂存源校验')
    expect(maintenanceJobTitle('reconcile-search-index')).toBe('搜索索引校准')
    expect(maintenanceJobTitle('purge-external-fetch-log')).toBe('采集流水清理')
  })

  it('未知类型回退原始键（健壮性）', () => {
    expect(maintenanceJobTitle('未来新类型' as never)).toBe('未来新类型')
  })
})

describe('buildMaintenanceDigest — 聚合字段→TaskResultDigest (D-194-8)', () => {
  it('auto-publish-staging：published 恒展示 + skipped>0 warn 展示', () => {
    const digest = buildMaintenanceDigest({ type: 'auto-publish-staging', durationMs: 12, published: 8, skipped: 3 })
    expect(digest?.metrics).toEqual([
      { key: 'published', label: '已发布', value: 8, tone: 'ok' },
      { key: 'skipped', label: '跳过', value: 3, tone: 'warn' },
    ])
    expect(digest?.summary).toBe('已发布 8 · 跳过 3')
  })

  it('published=0 恒展示 / skipped=0 省略（不展示 0 噪声）', () => {
    const digest = buildMaintenanceDigest({ type: 'auto-publish-staging', durationMs: 5, published: 0, skipped: 0 })
    expect(digest?.metrics.map((m) => m.key)).toEqual(['published'])
    expect(digest?.summary).toBe('已发布 0')
  })

  it('verify-published-sources：unpublished/refetchEnqueued/failed>0 展示，failed=danger', () => {
    const digest = buildMaintenanceDigest({
      type: 'verify-published-sources', durationMs: 9,
      unpublished: 2, refetchEnqueued: 4, skipped: 0, failed: 1,
    })
    expect(digest?.metrics).toEqual([
      { key: 'refetchEnqueued', label: '重排重抓', value: 4, tone: 'ok' },
      { key: 'unpublished', label: '已下架', value: 2, tone: 'warn' },
      { key: 'failed', label: '失败', value: 1, tone: 'danger' },
    ])
  })

  it('reconcile-search-index：synced 恒展示 + fixed/deleted/errors>0 展示', () => {
    const digest = buildMaintenanceDigest({
      type: 'reconcile-search-index', durationMs: 30,
      synced: 10, fixed: 2, deleted: 1, errors: 3,
    })
    expect(digest?.metrics.map((m) => `${m.key}:${m.value}:${m.tone}`)).toEqual([
      'synced:10:ok', 'deleted:1:ok', 'fixed:2:ok', 'errors:3:danger',
    ])
  })

  it('purge-external-fetch-log：deleted 恒展示（即使 0）', () => {
    const digest = buildMaintenanceDigest({ type: 'purge-external-fetch-log', durationMs: 2, deleted: 0 })
    expect(digest?.metrics).toEqual([{ key: 'deleted', label: '已删除', value: 0, tone: 'ok' }])
  })

  it('仅 type/durationMs（无产出字段）→ undefined（不挂 digest）', () => {
    expect(buildMaintenanceDigest({ type: 'verify-staging-sources', durationMs: 7 })).toBeUndefined()
  })

  it('非数字 / 非有限值 → number 守卫跳过；未知键不投影', () => {
    const digest = buildMaintenanceDigest({
      type: 'auto-publish-staging', durationMs: 1,
      published: Number.NaN, skipped: Infinity, unknownKey: 99,
    })
    expect(digest).toBeUndefined()
  })
})

describe('runMaintenanceJobWithReporter — start→finish 登记包裹 (D-194-5)', () => {
  function makeReporter(startId = 'tr-1'): { reporter: TaskRunReporter; start: ReturnType<typeof vi.fn>; finish: ReturnType<typeof vi.fn> } {
    const start = vi.fn().mockResolvedValue(startId)
    const finish = vi.fn().mockResolvedValue(undefined)
    const progress = vi.fn().mockResolvedValue(undefined)
    return { reporter: { start, progress, finish }, start, finish }
  }

  it('成功：start(kind/title/ref) → finish(success + digest) + 返回 result', async () => {
    const { reporter, start, finish } = makeReporter('tr-42')
    const result: MaintenanceJobResult = { type: 'auto-publish-staging', durationMs: 11, published: 5, skipped: 0 }
    const ret = await runMaintenanceJobWithReporter(reporter, 'auto-publish-staging', 'job-9', () => Promise.resolve(result))

    expect(start).toHaveBeenCalledWith({ kind: 'maintenance', title: '暂存自动发布', ref: 'job-9' })
    expect(finish).toHaveBeenCalledWith('tr-42', {
      status: 'success',
      digest: { summary: '已发布 5', metrics: [{ key: 'published', label: '已发布', value: 5, tone: 'ok' }] },
    })
    expect(ret).toBe(result)
  })

  it('失败：process 抛错 → finish(failed + error) 后 rethrow（保 bull 失败语义）', async () => {
    const { reporter, finish } = makeReporter('tr-7')
    await expect(
      runMaintenanceJobWithReporter(reporter, 'reconcile-search-index', 'job-x', () =>
        Promise.reject(new Error('ES timeout')),
      ),
    ).rejects.toThrow('ES timeout')
    expect(finish).toHaveBeenCalledWith('tr-7', { status: 'failed', error: 'ES timeout' })
  })

  it('start 降级 sentinel → runId 原样透传给 finish（reporter 内部对 sentinel no-op）', async () => {
    const { reporter, finish } = makeReporter('unlinked')
    const result: MaintenanceJobResult = { type: 'purge-external-fetch-log', durationMs: 3, deleted: 2 }
    await runMaintenanceJobWithReporter(reporter, 'purge-external-fetch-log', 'job-1', () => Promise.resolve(result))
    expect(finish).toHaveBeenCalledWith('unlinked', expect.objectContaining({ status: 'success' }))
  })

  it('非 Error 抛出 → String(err) 落 error', async () => {
    const { reporter, finish } = makeReporter()
    await expect(
      runMaintenanceJobWithReporter(reporter, 'verify-staging-sources', 'job-2', () => Promise.reject('plain string')),
    ).rejects.toBe('plain string')
    expect(finish).toHaveBeenCalledWith('tr-1', { status: 'failed', error: 'plain string' })
  })
})
