/**
 * video-sources-playback-verify-query.test.ts — recordAdminPlaybackVerifySuccess（ADR-198 query 层）
 *
 * 真函数 + fake Pool，断言 SQL 形态与红线（D-198-2/4/7）：
 *   - render ok + probe dead→ok 复活 CASE + last_rendered_at/last_admin_verified_at = NOW()
 *   - **不写** fb_score / fb_sample_weight / last_feedback_at（D-198-4 红线，不污染众包 EMA）
 *   - 携分辨率 → quality_source='admin_review' 无条件覆盖（D-198-7）+ params 透传
 *   - 行不存在 → null
 */
import { describe, it, expect, vi } from 'vitest'
import type { Pool } from 'pg'
import { recordAdminPlaybackVerifySuccess } from '@/api/db/queries/video_sources'

function fakeDb(rows: Array<{ probe_status: string; render_status: string }>) {
  const query = vi.fn().mockResolvedValue({ rows, rowCount: rows.length })
  return { db: { query } as unknown as Pool, query }
}

describe('recordAdminPlaybackVerifySuccess（ADR-198 query helper）', () => {
  it('成功直更 SQL：render ok + probe dead→ok 复活 + 双时间戳；不写 EMA 三字段（D-198-4 红线）', async () => {
    const { db, query } = fakeDb([{ probe_status: 'ok', render_status: 'ok' }])
    await recordAdminPlaybackVerifySuccess(db, 's1', {
      resolutionWidth: null, resolutionHeight: null, qualityDetected: null,
    })
    const sql = String(query.mock.calls[0]![0])
    expect(sql).toContain("render_status = 'ok'")
    expect(sql).toMatch(/probe_status = CASE WHEN probe_status = 'dead' THEN 'ok'/)
    expect(sql).toContain('last_rendered_at = NOW()')
    expect(sql).toContain('last_admin_verified_at = NOW()')
    // D-198-4 红线：admin 路径绝不写众包 EMA 三字段
    expect(sql).not.toContain('fb_score')
    expect(sql).not.toContain('fb_sample_weight')
    expect(sql).not.toContain('last_feedback_at')
  })

  it('携分辨率 → quality_source=admin_review 无条件覆盖（D-198-7）+ params 透传', async () => {
    const { db, query } = fakeDb([{ probe_status: 'ok', render_status: 'ok' }])
    const res = await recordAdminPlaybackVerifySuccess(db, 's2', {
      resolutionWidth: 1920, resolutionHeight: 1080, qualityDetected: '1080P',
    })
    const sql = String(query.mock.calls[0]![0])
    expect(sql).toContain("'admin_review'")
    expect(sql).toContain('quality_detected')
    expect(sql).toContain('detected_at = CASE WHEN')
    expect(query.mock.calls[0]![1]).toEqual(['s2', 1920, 1080, '1080P'])
    expect(res).toEqual({ newProbeStatus: 'ok', newRenderStatus: 'ok' })
  })

  it('行不存在/已删 → null', async () => {
    const { db } = fakeDb([])
    const res = await recordAdminPlaybackVerifySuccess(db, 'missing', {
      resolutionWidth: null, resolutionHeight: null, qualityDetected: null,
    })
    expect(res).toBeNull()
  })
})
