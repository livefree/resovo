/**
 * ImageHealthColumns.test.tsx — 缺图视频列定义增强（IMGH-P2-3B / SEQ-20260619-02）
 *
 * 覆盖：
 *   - 新列：thumb（缩略）/ eventType（事件类型）/ candidateCount（跨源候选数）
 *   - filter 声明：title→search(text) / posterStatus·posterSource·eventType(enum+options) / brokenDomain(distinctTable)
 *   - cell 渲染：thumb 缺失走 fallback、破损直显 img；候选数 🟢/🟡/— 三态；eventType 兜底
 */

import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { buildMissingVideoColumns } from '../../../../../../apps/server-next/src/app/admin/image-health/_client/ImageHealthColumns'
import { IMAGE_HEALTH_DOMAIN_DISTINCT } from '../../../../../../apps/server-next/src/app/admin/image-health/_client/imageHealthFilters'
import type { MissingVideoRow } from '../../../../../../apps/server-next/src/lib/image-health/api'

afterEach(() => cleanup())

const COLS = buildMissingVideoColumns()
function col(id: string) {
  const c = COLS.find((x) => x.id === id)
  if (!c) throw new Error(`column ${id} not found`)
  return c as unknown as Record<string, unknown> & { cell?: (ctx: { row: MissingVideoRow; value: unknown; rowIndex: number }) => React.ReactNode }
}

function makeRow(over: Partial<MissingVideoRow> = {}): MissingVideoRow {
  return {
    videoId: 'v-1', catalogId: 'c-1', title: '沙丘', posterStatus: 'broken',
    posterUrl: 'https://cdn/p.jpg', posterSource: 'tmdb',
    lastSeenBrokenAt: null, brokenDomain: 'img.cdn', occurrenceCount: 3,
    eventType: 'fetch_404', eventId: 'e-1', candidateCount: 2, hasHighConfidenceCandidate: true,
    ...over,
  }
}

function renderCell(id: string, row: MissingVideoRow) {
  const c = col(id)
  return render(<>{c.cell?.({ row, value: undefined, rowIndex: 0 })}</>)
}

describe('buildMissingVideoColumns — 新列存在', () => {
  it('含 thumb / eventType / candidateCount 三新列', () => {
    expect(col('thumb').kind).toBe('media')
    expect(col('eventType')).toBeTruthy()
    expect(col('candidateCount')).toBeTruthy()
  })
})

describe('buildMissingVideoColumns — filter 声明（消费 1D）', () => {
  it('title → search 文本筛选', () => {
    const c = col('title')
    expect(c.filterable).toBe(true)
    expect(c.filterFieldName).toBe('search')
    expect(c.filterKind).toBe('text')
  })

  it('posterStatus / posterSource / eventType → enum + 静态 options', () => {
    for (const [id, field] of [['posterStatus', 'posterStatus'], ['posterSource', 'posterSource'], ['eventType', 'eventType']] as const) {
      const c = col(id)
      expect(c.filterable).toBe(true)
      expect(c.filterFieldName).toBe(field)
      expect(c.filterKind).toBe('enum')
      expect(Array.isArray(c.filterOptions)).toBe(true)
      expect((c.filterOptions as unknown[]).length).toBeGreaterThan(0)
    }
  })

  it('brokenDomain → enum + distinctTable 哨兵（无静态 options 以触发 fetcher）', () => {
    const c = col('brokenDomain')
    expect(c.filterable).toBe(true)
    expect(c.filterFieldName).toBe('brokenDomain')
    expect(c.filterKind).toBe('enum')
    expect(c.filterDistinctTable).toBe(IMAGE_HEALTH_DOMAIN_DISTINCT)
    expect(c.filterOptions).toBeUndefined()
  })

  it('eventType 8 值与后端 CHECK 一致', () => {
    const vals = (col('eventType').filterOptions as { value: string }[]).map((o) => o.value)
    expect(vals).toEqual([
      'client_load_error', 'empty_src', 'fetch_404', 'fetch_5xx',
      'timeout', 'decode_fail', 'dimension_too_small', 'aspect_mismatch',
    ])
  })
})

describe('buildMissingVideoColumns — cell 渲染', () => {
  it('thumb：缺失 → fallback 占位（placeholder）', () => {
    const { container } = renderCell('thumb', makeRow({ posterStatus: 'missing', posterUrl: null }))
    expect(container.querySelector('[data-thumb][data-state="placeholder"]')).not.toBeNull()
    expect(container.querySelector('img')).toBeNull()
  })

  it('thumb：破损 → 直显 posterUrl（has-src img）+ poster-md 尺寸（配 density=poster 防裁切）', () => {
    const { container } = renderCell('thumb', makeRow({ posterStatus: 'broken', posterUrl: 'https://cdn/p.jpg' }))
    const img = container.querySelector('img')
    expect(img).not.toBeNull()
    expect(img?.getAttribute('src')).toBe('https://cdn/p.jpg')
    // 回归守卫（Codex stop-time review）：缩略图须 poster-md，配 density=poster（80px 行）不裁切
    expect(container.querySelector('[data-thumb]')?.getAttribute('data-size')).toBe('poster-md')
  })

  it('candidateCount：高置信 🟢 + 数量', () => {
    const { container } = renderCell('candidateCount', makeRow({ candidateCount: 2, hasHighConfidenceCandidate: true }))
    const cell = container.querySelector('[data-high-confidence="true"]')
    expect(cell?.textContent).toContain('🟢')
    expect(cell?.textContent).toContain('2')
  })

  it('candidateCount：待确认 🟡', () => {
    const { container } = renderCell('candidateCount', makeRow({ candidateCount: 1, hasHighConfidenceCandidate: false }))
    expect(container.querySelector('[data-high-confidence="false"]')?.textContent).toContain('🟡')
  })

  it('candidateCount：0 → —（无候选）', () => {
    const { container } = renderCell('candidateCount', makeRow({ candidateCount: 0, hasHighConfidenceCandidate: false }))
    expect(container.querySelector('[data-candidate-count="0"]')?.textContent).toBe('—')
  })

  it('eventType：显示 + null 兜底 —', () => {
    expect(renderCell('eventType', makeRow({ eventType: 'timeout' })).container.querySelector('[data-event-type]')?.textContent).toBe('timeout')
    expect(renderCell('eventType', makeRow({ eventType: null })).container.querySelector('[data-event-type]')?.textContent).toBe('—')
  })
})
