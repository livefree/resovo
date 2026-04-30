/**
 * buildDashboardStats 单测（CHG-DESIGN-07 7C 步骤 2 派生 helper + Codex stop-time fix#2 守门）
 *
 * 覆盖：
 *   - 全 live 路径（ModerationStats 完整）
 *   - 部分 live + mock fallback（pendingCount only）
 *   - 全 mock 路径（ModerationStats null）
 *   - **interceptRate 百分数语义**（后端已是 0-100 范围，消费方直接拼 % 不再 ×100）
 *   - 4 张 KPI / 4 段 workflow / mock 数据数量恒定
 */
import { describe, it, expect } from 'vitest'
import { buildDashboardStats } from '../../../../../../apps/server-next/src/lib/dashboard-data'
import type { ModerationStats } from '../../../../../../apps/server-next/src/lib/videos/api'

describe('buildDashboardStats — full live 路径', () => {
  const stats: ModerationStats = {
    pendingCount: 484,
    todayReviewedCount: 67,
    interceptRate: 12.3, // 后端已是百分数：12.3 表示 12.3%
  }

  it('返回 4 张 KPI / 4 段 workflow / 4 条 attention / 6 条 activity / 8 站', () => {
    const r = buildDashboardStats(stats)
    expect(r.kpis.length).toBe(4)
    expect(r.workflow.length).toBe(4)
    expect(r.attentions.length).toBe(4)
    expect(r.activities.length).toBe(6)
    expect(r.sites.length).toBe(8)
  })

  it('KPI[1] 待审/暂存：pendingCount live + dataSource="live"', () => {
    const r = buildDashboardStats(stats)
    expect(r.kpis[1].key).toBe('pendingStaging')
    expect(r.kpis[1].value).toBe('484 / 23')
    expect(r.kpis[1].dataSource).toBe('live')
  })

  it('Workflow[1] 待审段：current=pendingCount + dataSource="live"', () => {
    const r = buildDashboardStats(stats)
    expect(r.workflow[1].key).toBe('pendingReview')
    expect(r.workflow[1].current).toBe(484)
    expect(r.workflow[1].dataSource).toBe('live')
  })

  // ⚠️ Codex stop-time review fix#2 命中根因：
  // 后端 interceptRate 字段已是百分数（0-100），生产方 `getModerationStats()`
  // 内公式 `Math.round((rejected/total7d) * 1000) / 10`；消费方直接拼 % 即可；不可再 ×100。
  // 详见 `apps/server-next/src/lib/videos/api.ts` `ModerationStats.interceptRate` jsdoc。
  it('headSub 拦截率显示百分数（不再 ×100）：interceptRate=12.3 → "拦截率 12.3%"', () => {
    const r = buildDashboardStats(stats)
    expect(r.headSub).toContain('拦截率 12.3%')
    expect(r.headSub).not.toContain('1230')
  })

  it('headSub 含今日已审：todayReviewedCount=67 → "今日已审 67 条"', () => {
    const r = buildDashboardStats(stats)
    expect(r.headSub).toContain('今日已审 67 条')
  })

  it('interceptRate 边界：0.1 → "0.1%" / 99.9 → "99.9%" / 100 → "100.0%"', () => {
    expect(buildDashboardStats({ ...stats, interceptRate: 0.1 }).headSub).toContain('拦截率 0.1%')
    expect(buildDashboardStats({ ...stats, interceptRate: 99.9 }).headSub).toContain('拦截率 99.9%')
    expect(buildDashboardStats({ ...stats, interceptRate: 100 }).headSub).toContain('拦截率 100.0%')
  })

  it('interceptRate=0 → "拦截率 0.0%"（不丢弃 0 显示）', () => {
    expect(buildDashboardStats({ ...stats, interceptRate: 0 }).headSub).toContain('拦截率 0.0%')
  })
})

describe('buildDashboardStats — 部分 live（pendingCount only）', () => {
  it('部分字段缺失（仅 pendingCount）→ 仍 live pending；headSub 不含拦截率', () => {
    // 模拟接口返回 pendingCount 但缺 todayReviewedCount + interceptRate
    const partial = { pendingCount: 50 } as ModerationStats
    const r = buildDashboardStats(partial)

    // KPI 待审/暂存 live
    expect(r.kpis[1].dataSource).toBe('live')
    expect(r.kpis[1].value).toBe('50 / 23')

    // headSub 走 mock 文案（todayReviewed 缺）
    expect(r.headSub).toContain('最近采集')
    expect(r.headSub).not.toContain('今日已审')
    expect(r.headSub).not.toContain('拦截率')
  })

  it('todayReviewedCount 有值但 interceptRate null → headSub 含今日已审，不含拦截率', () => {
    const partial = { pendingCount: 50, todayReviewedCount: 30, interceptRate: null }
    const r = buildDashboardStats(partial)
    expect(r.headSub).toContain('今日已审 30 条')
    expect(r.headSub).not.toContain('拦截率')
  })
})

describe('buildDashboardStats — 全 mock 路径（ModerationStats null）', () => {
  it('null 输入 → 4 张 KPI 全 dataSource="mock"', () => {
    const r = buildDashboardStats(null)
    expect(r.kpis.every((k) => k.dataSource === 'mock')).toBe(true)
  })

  it('null 输入 → workflow 全 dataSource="mock"', () => {
    const r = buildDashboardStats(null)
    expect(r.workflow.every((w) => w.dataSource === 'mock')).toBe(true)
  })

  it('null 输入 → headSub 走 mock 文案', () => {
    const r = buildDashboardStats(null)
    expect(r.headSub).toContain('最近采集')
    expect(r.headSub).not.toContain('今日已审')
    expect(r.headSub).not.toContain('拦截率')
  })

  it('null 输入 → 4 张 KPI value 全部非破折号（防 reference §5.1.4 假绿）', () => {
    const r = buildDashboardStats(null)
    r.kpis.forEach((k) => {
      expect(k.value).not.toBe('—')
      expect(typeof k.value === 'string' || typeof k.value === 'number').toBe(true)
    })
  })
})
