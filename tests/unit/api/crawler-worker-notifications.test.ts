/**
 * tests/unit/api/crawler-worker-notifications.test.ts —
 * NTLG-P1-c-B-1 / ADR-193 D-193-4 buildRunCompletedNotification 单测
 *
 * 覆盖：终态 status → level/title 映射 / 非终态 → null（不 emit）/ digest 投影 payload+body /
 *       summary 无产出 → 无 body/payload 但终态仍 emit / dedupKey 幂等格式
 */
import { describe, it, expect, vi } from 'vitest'

// buildRunCompletedNotification → buildTaskResultDigest（TaskAggregator）顶部 import queue，mock 避免连 Redis
vi.mock('@/api/lib/queue', () => ({
  crawlerQueue: {}, maintenanceQueue: {}, verifyQueue: {}, enrichmentQueue: {}, imageHealthQueue: {},
}))

import { buildRunCompletedNotification } from '@/api/workers/crawlerWorker.notifications'
import type { SyncRunStatusResult } from '@/api/db/queries/crawlerRuns'

function sync(status: string, summary: Record<string, unknown> | null): SyncRunStatusResult {
  return { status: status as SyncRunStatusResult['status'], siteKey: 'site-a', summary }
}

describe('buildRunCompletedNotification — run 终态 digest 通知 (ADR-193 D-193-4)', () => {
  it('success + summary 有产出 → 完整 EmitNotificationInput（type/level/title/digest/dedupKey）', () => {
    const n = buildRunCompletedNotification(
      sync('success', { videosUpserted: 12, sourcesUpserted: 3, failed: 0, errors: 0 }),
      'run-1',
    )
    expect(n).not.toBeNull()
    expect(n?.type).toBe('crawler.run.completed')
    expect(n?.level).toBe('info')
    expect(n?.title).toBe('采集完成')
    expect(n?.sourceKind).toBe('crawler')
    expect(n?.scope).toBe('broadcast')
    expect(n?.href).toBe('/admin/crawler')
    expect(n?.sourceRef).toBe('run-1')
    expect(n?.dedupKey).toBe('crawler.run.completed:run-1')
    expect(n?.body).toBe('新增 12 视频 · 3 线路')
    expect(n?.payload).toEqual({
      summary: '新增 12 视频 · 3 线路',
      metrics: [
        { key: 'videos_added', label: '新增视频', value: 12, tone: 'ok' },
        { key: 'sources_added', label: '新增线路', value: 3, tone: 'ok' },
      ],
    })
  })

  it('failed → level=danger / title=采集失败（含失败站点+错误 metric）', () => {
    const n = buildRunCompletedNotification(
      sync('failed', { videosUpserted: 0, sourcesUpserted: 0, failed: 2, errors: 5 }),
      'run-2',
    )
    expect(n?.level).toBe('danger')
    expect(n?.title).toBe('采集失败')
    expect(n?.body).toBe('新增 0 视频 · 0 线路 · 2 站点失败 · 5 错误')
  })

  it('partial_failed → level=warn / title=采集部分失败', () => {
    const n = buildRunCompletedNotification(
      sync('partial_failed', { videosUpserted: 5, sourcesUpserted: 1, failed: 1, errors: 0 }),
      'run-3',
    )
    expect(n?.level).toBe('warn')
    expect(n?.title).toBe('采集部分失败')
  })

  it('cancelled → level=warn / title=采集已取消', () => {
    const n = buildRunCompletedNotification(sync('cancelled', { videosUpserted: 2, sourcesUpserted: 0 }), 'run-4')
    expect(n?.level).toBe('warn')
    expect(n?.title).toBe('采集已取消')
  })

  it('非终态 running/queued/paused → null（不 emit；多 site run 仅最后 job 见终态）', () => {
    expect(buildRunCompletedNotification(sync('running', {}), 'r')).toBeNull()
    expect(buildRunCompletedNotification(sync('queued', {}), 'r')).toBeNull()
    expect(buildRunCompletedNotification(sync('paused', {}), 'r')).toBeNull()
  })

  it('summary=null → 终态仍 emit（无 body/payload，dedupKey 在）', () => {
    const n = buildRunCompletedNotification(sync('cancelled', null), 'run-5')
    expect(n).not.toBeNull()
    expect(n?.body).toBeUndefined()
    expect(n?.payload).toBeUndefined()
    expect(n?.dedupKey).toBe('crawler.run.completed:run-5')
  })

  it('summary 仅内部计数（无产出字段）→ digest undefined，无 body/payload 但终态仍 emit', () => {
    const n = buildRunCompletedNotification(sync('success', { total: 3, done: 3 }), 'run-6')
    expect(n).not.toBeNull()
    expect(n?.body).toBeUndefined()
    expect(n?.payload).toBeUndefined()
  })
})
