/**
 * image-health-problem-filter-v2.test.ts — 方案C 读端单真源谓词 problemFilterSqlV2（ADR-213 D-213-7）
 *
 * 真 getProblemImages / getProblemImageCounts + mock db.query，断言生成 SQL：
 *  - 健康判定 WHERE = status + client_error_at 窗口（events 退出读路径）
 *  - stale-ok→unknown 道由 IMAGE_HEALTH_STALE_OK_ENABLED flag 门控（默认 OFF，A-SCAN 后开启）
 *  - counts 与 list 逐字共用谓词（total 不漂移，ADR-209 §17.3.2）
 *  - problemReason CASE 含 client_error / unknown
 */

import { describe, it, expect, vi, afterEach } from 'vitest'
import type { Pool } from 'pg'
import { getProblemImages, getProblemImageCounts } from '@/api/db/queries/imageHealth.scan'

function mockDb(rows: unknown[]): { db: Pool; query: ReturnType<typeof vi.fn> } {
  const query = vi.fn().mockResolvedValue({ rows })
  return { db: { query } as unknown as Pool, query }
}

const ENV_KEY = 'IMAGE_HEALTH_STALE_OK_ENABLED'
const COUNTS_ROW = [{ poster: 0, backdrop: 0, logo: 0, banner_backdrop: 0 }]

afterEach(() => {
  delete process.env[ENV_KEY]
})

describe('problemFilterSqlV2 — 单真源谓词（ADR-213 D-213-7）', () => {
  it('健康判定 WHERE 用 status + client_error_at 窗口，**不再** EXISTS broken_image_events', async () => {
    const { db, query } = mockDb(COUNTS_ROW)
    await getProblemImageCounts(db, 'published')
    const [sql] = query.mock.calls[0]
    expect(sql).toContain("mc.poster_status <> 'ok'")
    expect(sql).toContain("mc.poster_client_error_at >= NOW() - INTERVAL '7 days'")
    expect(sql).not.toContain('broken_image_events') // events 退出健康读路径（counts 无 LATERAL/EXISTS）
  })

  it('flag OFF（默认）→ counts 谓词不含 stale-ok 道（防 A-SCAN 前 unknown 泛滥）', async () => {
    const { db, query } = mockDb(COUNTS_ROW)
    await getProblemImageCounts(db, 'all')
    expect(query.mock.calls[0][0]).not.toContain('poster_checked_at')
  })

  it('flag ON → counts 谓词含 stale-ok 道（status=ok ∧ checked_at 陈旧/NULL）', async () => {
    process.env[ENV_KEY] = 'true'
    const { db, query } = mockDb(COUNTS_ROW)
    await getProblemImageCounts(db, 'all')
    expect(query.mock.calls[0][0]).toContain(
      "mc.poster_status = 'ok' AND COALESCE(mc.poster_checked_at, '-infinity'::timestamptz) < NOW() - INTERVAL '30 days'",
    )
  })

  it('counts 与 list 逐字共用谓词片段（total 不漂移，ADR-209 §17.3.2）', async () => {
    const { db: db1, query: q1 } = mockDb(COUNTS_ROW)
    await getProblemImageCounts(db1, 'published')
    const { db: db2, query: q2 } = mockDb([])
    await getProblemImages(db2, 'poster', 'published', 0, 48)
    const urlGuard = "mc.cover_url IS NOT NULL AND btrim(mc.cover_url) <> ''"
    const clientErrClause = "mc.poster_client_error_at >= NOW() - INTERVAL '7 days'"
    for (const sql of [q1.mock.calls[0][0], q2.mock.calls[0][0]]) {
      expect(sql).toContain(urlGuard)
      expect(sql).toContain(clientErrClause)
    }
  })

  it('list problemReason CASE 含 client_error / unknown；ORDER 按 problem_reason', async () => {
    const { db, query } = mockDb([])
    await getProblemImages(db, 'poster', 'all', 0, 48)
    const [sql] = query.mock.calls[0]
    expect(sql).toContain("THEN 'client_error'")
    expect(sql).toContain("THEN 'unknown'")
    expect(sql).toContain('CASE base.problem_reason') // ORDER BY 复用 base 算的 problem_reason
    // 排序优先级（IMGH-P4-BOARD-UX）：可操作项浮顶，low_quality 沉底
    expect(sql).toContain("WHEN 'unknown'        THEN 3")
    expect(sql).toContain("WHEN 'low_quality'    THEN 5")
    // LATERAL 仍保留作纯遥测展示（broken_domain/原因），但不进 WHERE
    expect(sql).toContain('LEFT JOIN LATERAL')
  })
})
