/**
 * align-douban-status-to-refs.test.ts — META-56 DROP-prep 对齐脚本纯函数单测
 *
 * VITEST 守卫保证 import 不触 main()/db；仅验证 parseArgs + SQL builder（videoRefAppliedSql 同口径）。
 */
import { describe, it, expect } from 'vitest'
import {
  parseArgs,
  buildUndercountedSelectSql,
  buildAlignUpdateSql,
} from '../../../scripts/align-douban-status-to-refs'

describe('parseArgs', () => {
  it('--limit + --dry-run', () => {
    expect(parseArgs(['--limit', '50', '--dry-run'])).toEqual({ limit: 50, dryRun: true })
  })
  it('无参数 → limit null / dryRun false', () => {
    expect(parseArgs([])).toEqual({ limit: null, dryRun: false })
  })
})

describe('buildUndercountedSelectSql — 圈定欠计行（videoRefAppliedSql 同口径）', () => {
  const sql = buildUndercountedSelectSql(null)
  it('含 applied 谓词（is_primary + auto_matched/manual_confirmed，DC-216-1 单一真源）', () => {
    expect(sql).toContain("ver.provider = 'douban'")
    expect(sql).toContain('ver.is_primary = true')
    expect(sql).toContain("ver.match_status IN ('auto_matched', 'manual_confirmed')")
  })
  it('欠计过滤 + 软删 gate + 不触已一致行', () => {
    expect(sql).toContain("v.douban_status IS DISTINCT FROM 'matched'")
    expect(sql).toContain('v.deleted_at IS NULL')
  })
  it('limit null → 无 LIMIT；limit N → LIMIT N', () => {
    expect(buildUndercountedSelectSql(null)).not.toContain('LIMIT')
    expect(buildUndercountedSelectSql(100)).toContain('LIMIT 100')
  })
})

describe('buildAlignUpdateSql — 对齐 UPDATE（幂等 + TOCTOU 安全）', () => {
  const sql = buildAlignUpdateSql()
  it('仅升 matched + id 参数化 + 自带谓词(防 TOCTOU) + IS DISTINCT FROM matched(幂等)', () => {
    expect(sql).toContain("SET douban_status = 'matched'")
    expect(sql).toContain('v.id = ANY($1::uuid[])')
    expect(sql).toContain("ver.match_status IN ('auto_matched', 'manual_confirmed')")
    expect(sql).toContain("v.douban_status IS DISTINCT FROM 'matched'")
    expect(sql).toContain('updated_at = NOW()')
    // Codex stop-gate：UPDATE 须 gate 软删（防 SELECT 后被软删的 video 仍被 UPDATE 触及）
    expect(sql).toContain('v.deleted_at IS NULL')
  })
})
