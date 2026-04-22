import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getBrokenEventsTrend } from '@/api/db/queries/imageHealth'

describe('getBrokenEventsTrend', () => {
  const query = vi.fn()
  const db = { query } as unknown as import('pg').Pool

  beforeEach(() => {
    query.mockReset()
  })

  it('返回正好 days 个数据点（升序），有数据的日期填入实际值', async () => {
    // 模拟 DB 只返回最近 2 天有破损事件
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(today.getDate() - 1)
    const todayStr = today.toISOString().slice(0, 10)
    const yesterdayStr = yesterday.toISOString().slice(0, 10)

    query.mockResolvedValueOnce({
      rows: [
        { day: yesterdayStr, count: '3' },
        { day: todayStr,     count: '5' },
      ],
    })

    const result = await getBrokenEventsTrend(db, 7)

    expect(result).toHaveLength(7)
    expect(result[result.length - 1]).toEqual({ date: todayStr,     count: 5 })
    expect(result[result.length - 2]).toEqual({ date: yesterdayStr, count: 3 })
    // 其余 5 天都应补 0
    const zeros = result.slice(0, result.length - 2)
    expect(zeros.every(p => p.count === 0)).toBe(true)
  })

  it('全部无破损时返回 days 个 count=0 的点', async () => {
    query.mockResolvedValueOnce({ rows: [] })

    const result = await getBrokenEventsTrend(db, 7)

    expect(result).toHaveLength(7)
    expect(result.every(p => p.count === 0)).toBe(true)
  })

  it('日期按升序排列（最旧在前）', async () => {
    query.mockResolvedValueOnce({ rows: [] })

    const result = await getBrokenEventsTrend(db, 3)

    expect(result[0]!.date < result[1]!.date).toBe(true)
    expect(result[1]!.date < result[2]!.date).toBe(true)
  })

  it('days=1 时只返回今天', async () => {
    const today = new Date().toISOString().slice(0, 10)
    query.mockResolvedValueOnce({ rows: [{ day: today, count: '2' }] })

    const result = await getBrokenEventsTrend(db, 1)

    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({ date: today, count: 2 })
  })
})
