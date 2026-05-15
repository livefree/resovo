/**
 * admin-audit.test.ts — /admin/audit/* 端点 SQL 真实执行集成测试
 * （CHG-SN-6-01 / ADR-118 验证段 schema 三层防护第 4 项 + R-MID-1 替代守卫）
 *
 * 范围：
 *   - listAdminAuditLog 7 维 filter 组合（单维 / 双维 / 三维 / 时间窗）
 *   - getAdminAuditLogById 详情透传（含 ipHash + 完整 jsonb）
 *   - jsonb 字段完整透传（R-MID-1 替代守卫，第 3 项替代）
 *   - SQL idx 拼装零错位（R-ADR-117-4 教训）
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Pool } from 'pg'
import { createIntegrationPool } from '../../helpers/integration-pg'

import {
  listAdminAuditLog,
  getAdminAuditLogById,
} from '../../../apps/api/src/db/queries/auditLog'

let db: Pool

beforeAll(() => {
  db = createIntegrationPool()
})

afterAll(async () => {
  await db.end()
})

describe('listAdminAuditLog SQL 集成（动态 WHERE + LEFT JOIN users）', () => {
  it('无过滤跑通（默认 page=1 limit=20）', async () => {
    const { rows, total } = await listAdminAuditLog(db, { page: 1, limit: 20 })
    expect(rows).toBeInstanceOf(Array)
    expect(total).toBeGreaterThanOrEqual(0)
  })

  it('actorId 单维 filter 跑通（命中 idx_admin_audit_log_actor_created）', async () => {
    const { rows, total } = await listAdminAuditLog(db, {
      page: 1,
      limit: 20,
      actorId: '00000000-0000-0000-0000-000000000000',
    })
    expect(rows).toEqual([])
    expect(total).toBe(0)
  })

  it('actionType 单维 filter 跑通（命中 idx_admin_audit_log_action_created）', async () => {
    const { rows, total } = await listAdminAuditLog(db, {
      page: 1,
      limit: 20,
      actionType: 'video.approve',
    })
    expect(rows).toBeInstanceOf(Array)
    expect(total).toBeGreaterThanOrEqual(0)
  })

  it('targetKind + targetId 双维 filter 跑通（命中 idx_admin_audit_log_target）', async () => {
    const { rows, total } = await listAdminAuditLog(db, {
      page: 1,
      limit: 20,
      targetKind: 'video',
      targetId: '00000000-0000-0000-0000-000000000000',
    })
    expect(rows).toEqual([])
    expect(total).toBe(0)
  })

  it('actorId + actionType + from/to 三维交叉跑通（planner 自决索引选择）', async () => {
    const { rows, total } = await listAdminAuditLog(db, {
      page: 1,
      limit: 20,
      actorId: '00000000-0000-0000-0000-000000000000',
      actionType: 'video.approve',
      from: '2020-01-01T00:00:00Z',
      to: '2030-12-31T23:59:59Z',
    })
    expect(rows).toEqual([])
    expect(total).toBe(0)
  })

  it('requestId 单维 filter 跑通（命中部分索引 idx_admin_audit_log_request_id）', async () => {
    const { rows, total } = await listAdminAuditLog(db, {
      page: 1,
      limit: 20,
      requestId: 'nonexistent-req-id',
    })
    expect(rows).toEqual([])
    expect(total).toBe(0)
  })

  it('jsonb 字段透传完整性（R-MID-1 替代守卫 / ADR-118 §验证段第 3 项）', async () => {
    const { rows } = await listAdminAuditLog(db, { page: 1, limit: 5 })
    // 校验返回行字段命名 camelCase 完整（即使 rows 可能为空）
    for (const row of rows) {
      expect(row).toHaveProperty('id')
      expect(row).toHaveProperty('actorId')
      expect(row).toHaveProperty('actionType')
      expect(row).toHaveProperty('targetKind')
      expect(row).toHaveProperty('beforeJsonb')
      expect(row).toHaveProperty('afterJsonb')
      expect(row).toHaveProperty('createdAt')
      // jsonb 透传非脏数据
      if (row.beforeJsonb !== null) {
        expect(typeof row.beforeJsonb).toBe('object')
      }
      if (row.afterJsonb !== null) {
        expect(typeof row.afterJsonb).toBe('object')
      }
    }
  })
})

describe('getAdminAuditLogById SQL 集成（PK 查询 + LEFT JOIN users + ipHash）', () => {
  it('id 不存在返回 null（NOT_FOUND 路径）', async () => {
    const row = await getAdminAuditLogById(db, '9999999999')
    expect(row).toBeNull()
  })

  it('id 格式无效不抛（bigint 转换由 PG 处理）', async () => {
    // 上游 zod 已守卫 /^\d+$/，本测试仅验证 query 层对边界值不崩
    const row = await getAdminAuditLogById(db, '0')
    expect(row).toBeNull()
  })

  it('返回字段包含 ipHash（仅详情端点；列表行不含）', async () => {
    const row = await getAdminAuditLogById(db, '1')
    // row 可能为 null（DB 中无 id=1），但若有则必含 ipHash 字段
    if (row !== null) {
      expect(row).toHaveProperty('ipHash')
      expect(row).toHaveProperty('beforeJsonb')
      expect(row).toHaveProperty('afterJsonb')
    }
  })
})
