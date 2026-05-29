/**
 * bangumi-dump-refresh.test.ts — parseBangumiLine 纯函数（CHG-BNG-09 / ADR-161 C4）
 * 校验 type 过滤 / 标题回退 / 年份提取 / rank>0 / nsfw / 归一化，与 import 脚本规则一致。
 */

import { describe, it, expect, vi } from 'vitest'
import { parseBangumiLine, normalizeTitle, runBangumiDumpRefresh } from '@resovo/worker/jobs/bangumi-dump-refresh'
import type { Pool } from 'pg'
import type pino from 'pino'

function line(obj: Record<string, unknown>): string {
  return JSON.stringify(obj)
}

describe('parseBangumiLine', () => {
  it('动画条目（type=2）→ 完整映射，episode_count/cover_url 留 null', () => {
    const r = parseBangumiLine(line({
      id: 51, type: 2, name: 'CLANNAD', name_cn: '团子大家族',
      date: '2007-10-04', score: 8.5, rank: 87, nsfw: false, summary: '简介',
    }))
    expect(r).toEqual({
      bangumiId: 51, titleCn: '团子大家族', titleJp: 'CLANNAD',
      titleNormalized: normalizeTitle('团子大家族'),
      airDate: '2007-10-04', year: 2007, rating: 8.5,
      episodeCount: null, summary: '简介', coverUrl: null, rank: 87, nsfw: false,
    })
  })

  it('非动画（type≠2）→ null', () => {
    expect(parseBangumiLine(line({ id: 1, type: 1, name: 'book' }))).toBeNull()
  })

  it('非 JSON / 空行 → null', () => {
    expect(parseBangumiLine('not json')).toBeNull()
    expect(parseBangumiLine('   ')).toBeNull()
  })

  it('无标题（name + name_cn 均空）→ null', () => {
    expect(parseBangumiLine(line({ id: 2, type: 2, name: '', name_cn: '' }))).toBeNull()
  })

  it('仅日文名 → titleCn=null，归一化用日文名', () => {
    const r = parseBangumiLine(line({ id: 3, type: 2, name: 'NARUTO', date: '2002-10-03' }))
    expect(r?.titleCn).toBeNull()
    expect(r?.titleJp).toBe('NARUTO')
    expect(r?.year).toBe(2002)
  })

  it('score=0 / rank=0 → rating/rank 归 null（仅 >0 保留）', () => {
    const r = parseBangumiLine(line({ id: 4, type: 2, name: 'X', score: 0, rank: 0 }))
    expect(r?.rating).toBeNull()
    expect(r?.rank).toBeNull()
  })

  it('nsfw=true 透传；无 date → year null', () => {
    const r = parseBangumiLine(line({ id: 5, type: 2, name: 'Y', nsfw: true }))
    expect(r?.nsfw).toBe(true)
    expect(r?.year).toBeNull()
    expect(r?.airDate).toBeNull()
  })
})

describe('runBangumiDumpRefresh — 跳过分支（不触碰 DB）', () => {
  function mocks() {
    const connect = vi.fn()
    const pool = { connect } as unknown as Pool
    const log = { info: vi.fn(), warn: vi.fn() } as unknown as pino.Logger
    return { pool, log, connect }
  }

  it('路径未配置（null）→ info 跳过，不连 DB', async () => {
    const { pool, log, connect } = mocks()
    await runBangumiDumpRefresh(pool, log, null)
    expect(log.info).toHaveBeenCalledWith(expect.stringContaining('not configured'))
    expect(connect).not.toHaveBeenCalled()
  })

  it('文件不存在 → warn（含解析后绝对路径）跳过，不连 DB', async () => {
    const { pool, log, connect } = mocks()
    await runBangumiDumpRefresh(pool, log, '/nonexistent/bangumi/subject.jsonlines')
    expect(log.warn).toHaveBeenCalledWith(
      expect.objectContaining({ filePath: '/nonexistent/bangumi/subject.jsonlines' }),
      expect.stringContaining('not found'),
    )
    expect(connect).not.toHaveBeenCalled()
  })
})
