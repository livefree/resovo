/**
 * ImageHealthKpiCards.test.tsx — 健康概览 KPI 卡片组（高信息密度版）单测
 *
 * 覆盖：
 *   ① 图片正常视频：已发布 / 全部 两口径分数（封面 ok / 视频数）+ 覆盖率
 *   ② 图片覆盖率：封面 / 背景 / 台标 / Banner 4 类 × 已发布 / 全部 共 8 个百分比
 *   ③ 近 7 日新增破损：数值 + mini 趋势 spark（danger 态）
 *   ④ 分母为 0 → 覆盖率 '—'（不除零）
 *   ⑤ 破损=0 + 无趋势 → 非 danger、无 spark
 */

import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'

import { ImageHealthKpiCards } from '../../../../../../apps/server-next/src/app/admin/image-health/_client/ImageHealthKpiCards'
import type { ImageHealthStats } from '../../../../../../apps/server-next/src/lib/image-health/api'

const STATS: ImageHealthStats = {
  published: { videoCount: 47, posterOk: 40, backdropOk: 34, logoOk: 19, bannerOk: 12 },
  all: { videoCount: 1200, posterOk: 1001, backdropOk: 840, logoOk: 456, bannerOk: 267 },
  brokenLast7Days: 42,
  brokenTrend: [
    { date: '2026-06-18', count: 6 },
    { date: '2026-06-19', count: 9 },
    { date: '2026-06-20', count: 5 },
  ],
}

describe('ImageHealthKpiCards', () => {
  it('1. 卡①图片正常视频：已发布 40/47 + 全部 1001/1200（千分位）', () => {
    render(<ImageHealthKpiCards stats={STATS} />)
    const card = screen.getByTestId('kpi-healthy-videos')
    expect(card.textContent).toContain('40')
    expect(card.textContent).toContain('47')
    expect(card.textContent).toContain('1,001')
    expect(card.textContent).toContain('1,200')
    // 覆盖率列：85.1%（已发布）/ 83.4%（全部）
    expect(card.textContent).toContain('85.1%')
    expect(card.textContent).toContain('83.4%')
  })

  it('2. 卡②图片覆盖率：4 类 × 已发布/全部 共 8 个百分比', () => {
    render(<ImageHealthKpiCards stats={STATS} />)
    const card = screen.getByTestId('kpi-coverage')
    // 已发布
    expect(card.textContent).toContain('85.1%')   // 封面 40/47
    expect(card.textContent).toContain('72.3%')   // 背景 34/47
    expect(card.textContent).toContain('40.4%')   // 台标 19/47
    expect(card.textContent).toContain('25.5%')   // Banner 12/47
    // 全部
    expect(card.textContent).toContain('83.4%')   // 封面 1001/1200
    expect(card.textContent).toContain('70.0%')   // 背景 840/1200
    expect(card.textContent).toContain('38.0%')   // 台标 456/1200
    expect(card.textContent).toContain('22.3%')   // Banner 267/1200
    // 4 类行 + 表头
    expect(card.querySelectorAll('[data-kpi-coverage-row]').length).toBe(4)
    expect(card.textContent).toContain('封面')
    expect(card.textContent).toContain('Banner')
  })

  it('3. 卡③近 7 日破损：数值 42 + mini 趋势 spark（svg）+ danger 态', () => {
    render(<ImageHealthKpiCards stats={STATS} />)
    const card = screen.getByTestId('kpi-broken-7d')
    expect(card.textContent).toContain('42')
    expect(card.querySelector('svg')).not.toBeNull()
    expect(card.getAttribute('data-variant')).toBe('is-danger')
  })

  it('4. 分母为 0 → 覆盖率 "—"（不除零）', () => {
    const zero: ImageHealthStats = {
      published: { videoCount: 0, posterOk: 0, backdropOk: 0, logoOk: 0, bannerOk: 0 },
      all: { videoCount: 0, posterOk: 0, backdropOk: 0, logoOk: 0, bannerOk: 0 },
      brokenLast7Days: 0,
    }
    render(<ImageHealthKpiCards stats={zero} />)
    expect(screen.getByTestId('kpi-coverage').textContent).toContain('—')
    expect(screen.getByTestId('kpi-healthy-videos').textContent).toContain('—')
  })

  it('5. 破损=0 + 无趋势 → 非 danger、无 spark', () => {
    const healthy: ImageHealthStats = {
      published: { videoCount: 47, posterOk: 47, backdropOk: 47, logoOk: 47, bannerOk: 47 },
      all: { videoCount: 1200, posterOk: 1200, backdropOk: 1200, logoOk: 1200, bannerOk: 1200 },
      brokenLast7Days: 0,
    }
    render(<ImageHealthKpiCards stats={healthy} />)
    const card = screen.getByTestId('kpi-broken-7d')
    expect(card.getAttribute('data-variant')).toBe('default')
    expect(card.querySelector('svg')).toBeNull()
    // 全 ok → 覆盖率 100.0%
    expect(screen.getByTestId('kpi-coverage').textContent).toContain('100.0%')
  })
})
