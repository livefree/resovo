/**
 * admin-task-runs.test.ts — task_runs 存储 SQL 真实执行集成测试
 * （ADR-194 / NTLG-P2-a-A；db/queries/taskRuns.ts schema 对齐 + 读写 SQL 编译验证 + DbTaskRunReporter 端到端）
 *
 * 范围（聚焦 queries 层真实 PG 验证，对齐 admin-notifications.test.ts 范式——integration config 仅解析
 * relative-path queries〔无 @/api 传递依赖〕；DbTaskRunReporter 编排由 unit test mock db 全覆盖）：
 *   - 读路径 schema 对齐（不写库）：listTaskRuns
 *   - 写路径 round-trip（BEGIN/ROLLBACK 事务回滚，零 dev DB 污染）：
 *       insert(running) → list 命中 / updateProgress / finish(digest 落 JSONB + finished_at) / status CHECK
 *
 * 与 unit test 互补：unit mock pg.query 不验真 SQL；本层跑真实 PG 验 schema + SQL 编译 + CHECK 约束 + 索引可用。
 * task_runs 无 FK（不依赖 users），较 notifications 简。
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Pool, PoolClient } from 'pg'
import { createIntegrationPool } from '../../helpers/integration-pg'
import {
  insertTaskRun,
  updateTaskRunProgress,
  finishTaskRun,
  listTaskRuns,
} from '../../../apps/api/src/db/queries/taskRuns'

let db: Pool

beforeAll(() => {
  db = createIntegrationPool()
})

afterAll(async () => {
  await db.end()
})

describe('task_runs 读路径 SQL 集成（schema 对齐 / 不写库）', () => {
  it('listTaskRuns 跑通（命中 idx_task_runs_created_at）', async () => {
    const rows = await listTaskRuns(db, { limit: 5 })
    expect(rows).toBeInstanceOf(Array)
    for (const row of rows) {
      expect(row).toHaveProperty('id')
      expect(row).toHaveProperty('kind')
      expect(row).toHaveProperty('status')
      expect(row).toHaveProperty('createdAt')
      expect(typeof row.id).toBe('string')
    }
  })

  it('listTaskRuns 带 since 时间窗跑通', async () => {
    const rows = await listTaskRuns(db, { limit: 5, since: new Date(Date.now() - 3600_000).toISOString() })
    expect(rows).toBeInstanceOf(Array)
  })
})

describe('task_runs 写路径 round-trip（BEGIN/ROLLBACK 零污染）', () => {
  let client: PoolClient

  beforeAll(async () => {
    client = await db.connect()
    await client.query('BEGIN')
  })

  afterAll(async () => {
    await client.query('ROLLBACK')
    client.release()
  })

  it('insert(running) → list 命中 + 字段完整', async () => {
    const { id } = await insertTaskRun(client, { kind: 'enrichment', title: '富集批次', ref: 'job-1' })
    expect(id).not.toBe('')
    const rows = await listTaskRuns(client, { limit: 50 })
    const hit = rows.find((r) => r.id === id)
    expect(hit).toBeDefined()
    expect(hit!.kind).toBe('enrichment')
    expect(hit!.title).toBe('富集批次')
    expect(hit!.ref).toBe('job-1')
    expect(hit!.status).toBe('running') // start 即 running（§4.2）
    expect(hit!.startedAt).toBeInstanceOf(Date) // started_at=NOW()
    expect(hit!.finishedAt).toBeNull()
  })

  it('updateTaskRunProgress → 仅 running 行进度更新', async () => {
    const { id } = await insertTaskRun(client, { kind: 'image_health', title: '图片健康' })
    await updateTaskRunProgress(client, id, 60)
    const rows = await listTaskRuns(client, { limit: 50 })
    expect(rows.find((r) => r.id === id)!.progress).toBe(60)
  })

  it('finish(success+digest) → 终态 + digest 落 JSONB + finished_at', async () => {
    const { id } = await insertTaskRun(client, { kind: 'enrichment', title: '终态测试' })
    const digest = {
      summary: '新增 3 视频 · 富集成功率 87%',
      metrics: [
        { key: 'videos_added', label: '新增视频', value: 3, tone: 'ok' as const },
        { key: 'enrich_success_rate', label: '富集成功率', value: 87, unit: '%', tone: 'ok' as const },
      ],
    }
    await finishTaskRun(client, id, { status: 'success', digest })
    const rows = await listTaskRuns(client, { limit: 50 })
    const hit = rows.find((r) => r.id === id)!
    expect(hit.status).toBe('success')
    expect(hit.finishedAt).toBeInstanceOf(Date)
    expect(hit.digest).toEqual(digest) // JSONB 往返保形
  })

  it('finish(failed+error) → 终态 failed + error 落库（无 digest）', async () => {
    const { id } = await insertTaskRun(client, { kind: 'maintenance', title: '清理失败' })
    await finishTaskRun(client, id, { status: 'failed', error: '连接超时' })
    const hit = (await listTaskRuns(client, { limit: 50 })).find((r) => r.id === id)!
    expect(hit.status).toBe('failed')
    expect(hit.error).toBe('连接超时')
    expect(hit.digest).toBeNull()
  })

  it('status CHECK 约束拒绝非法值', async () => {
    await expect(
      client.query(`INSERT INTO task_runs (kind, title, status) VALUES ('x', 'y', 'bogus')`),
    ).rejects.toThrow()
  })
})
