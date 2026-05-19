/**
 * crawler-sites-config-orphan.test.ts — CHG-SN-7-MISC-CRAWLER-CONFIG-ORPHAN-DELETE
 *
 * 修复用户反馈："站点设置-高级配置 变更配置文件没有和采集站点同步"
 * 即：从配置文件移除 key 后 DB 残留 fromConfig=true 行 / 无法清理。
 *
 * 覆盖：
 *   1. 空 currentKeys → 删除所有 fromConfig=true 行（清空配置）
 *   2. 非空 currentKeys → 删除 NOT IN currentKeys 的 fromConfig=true 行
 *   3. 不影响 fromConfig=false 的手动创建行
 *   4. SQL 参数化 + NOT IN 拼装
 *   5. 返回 deletedKeys 列表（供 audit + UI 反馈）
 */

import { describe, it, expect, vi } from 'vitest'
import type { Pool } from 'pg'
import { deleteCrawlerSitesFromConfigOrphans } from '@/api/db/queries/crawlerSites'

function makePool(rows: { key: string }[]): Pool {
  return {
    query: vi.fn().mockResolvedValue({ rows, rowCount: rows.length }),
  } as unknown as Pool
}

describe('deleteCrawlerSitesFromConfigOrphans (CHG-SN-7-MISC-CRAWLER-CONFIG-ORPHAN-DELETE)', () => {
  it('1. 空 currentKeys → 删除所有 fromConfig=true 行（SQL 无 NOT IN）', async () => {
    const queryFn = vi.fn().mockResolvedValue({ rows: [{ key: 'a' }, { key: 'b' }], rowCount: 2 })
    const pool = { query: queryFn } as unknown as Pool
    const result = await deleteCrawlerSitesFromConfigOrphans(pool, [])
    expect(result).toEqual(['a', 'b'])
    const [sql, params] = queryFn.mock.calls[0]
    expect(sql).toContain('DELETE FROM crawler_sites WHERE from_config = true RETURNING key')
    expect(sql).not.toContain('NOT IN')
    expect(params).toBeUndefined()
  })

  it('2. 非空 currentKeys → SQL 拼 NOT IN ($1, $2, ...) + from_config=true 守卫', async () => {
    const queryFn = vi.fn().mockResolvedValue({ rows: [{ key: 'old1' }], rowCount: 1 })
    const pool = { query: queryFn } as unknown as Pool
    const result = await deleteCrawlerSitesFromConfigOrphans(pool, ['new1', 'new2', 'new3'])
    expect(result).toEqual(['old1'])
    const [sql, params] = queryFn.mock.calls[0]
    expect(sql).toContain('from_config = true')
    expect(sql).toContain('NOT IN ($1, $2, $3)')
    expect(sql).toContain('RETURNING key')
    expect(params).toEqual(['new1', 'new2', 'new3'])
  })

  it('3. 不影响 fromConfig=false 行（SQL 守卫 from_config = true）', async () => {
    const queryFn = vi.fn().mockResolvedValue({ rows: [], rowCount: 0 })
    const pool = { query: queryFn } as unknown as Pool
    await deleteCrawlerSitesFromConfigOrphans(pool, ['k1'])
    const [sql] = queryFn.mock.calls[0]
    // 关键守卫：仅删 from_config=true（手动创建的 fromConfig=false 站点不受影响）
    expect(sql).toMatch(/from_config = true/)
  })

  it('4. 0 行删除 → 返回空数组', async () => {
    const pool = makePool([])
    const result = await deleteCrawlerSitesFromConfigOrphans(pool, ['k1', 'k2'])
    expect(result).toEqual([])
  })

  it('5. 多个 orphans → 返回全部 deletedKeys 数组', async () => {
    const pool = makePool([
      { key: 'orphan_a' },
      { key: 'orphan_b' },
      { key: 'orphan_c' },
    ])
    const result = await deleteCrawlerSitesFromConfigOrphans(pool, ['k1'])
    expect(result).toEqual(['orphan_a', 'orphan_b', 'orphan_c'])
  })
})
