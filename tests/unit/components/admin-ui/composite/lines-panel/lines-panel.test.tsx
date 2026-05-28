/**
 * lines-panel.test.tsx — CHG-351-B / ADR-158 LinesPanel Props 扩展行为守卫
 *
 * arch-reviewer (claude-opus-4-7) Y1 修订路径：tests/unit/components/admin-ui/...（不是 packages/admin-ui/tests/）
 * arch-reviewer Y1 决定：admin-ui 测试库零 snapshot 先例 / 仅行为断言
 *
 * 覆盖（9 case）：
 *   1. 未提供 onProbeEpisode → "探测" 按钮不渲染
 *   2. 未提供 onRenderCheckEpisode → "试播" 按钮不渲染
 *   3. 点击 "探测" → onProbeEpisode({ lineKey, episodeId }) 被调用（R1/B 决策：含 lineKey）
 *   4. 点击 "试播" → onRenderCheckEpisode({ lineKey, episodeId }) 被调用
 *   5. probingEpisodeIds 含 ep.id → "探测" 按钮 disabled + 文案 "探测…"
 *   6. renderCheckingEpisodeIds 含 ep.id → "试播" 按钮 disabled + 文案 "试播…"
 *   7. a11y：aria-label 与现有按钮模板对齐（"探测第 X 集线路状态" / "试播第 X 集渲染检测"）
 *   8. 既有功能 smoke：启用/停用 + 健康 + 选中态不回归
 *   9. I2 防 race + 并行不污染：toggling/probing 多 epId 与跨 set 互不污染
 */

import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { LinesPanel } from '../../../../../../packages/admin-ui/src/components/composite/lines-panel/lines-panel'
import type {
  EpisodeMini,
  LineAggregate,
  LinesPanelProps,
} from '../../../../../../packages/admin-ui/src/components/composite/lines-panel/lines-panel.types'

// ── 工厂 ─────────────────────────────────────────────────────────────────────

function makeEp(overrides: Partial<EpisodeMini> & { id: string }): EpisodeMini {
  // 用 'in' 而非 '??' 判断字段是否显式传入（episodeNumber=null 是合法值，被 ?? 误转为 1）
  return {
    id: overrides.id,
    episodeNumber: 'episodeNumber' in overrides ? overrides.episodeNumber ?? null : 1,
    probe: overrides.probe ?? 'ok',
    render: overrides.render ?? 'ok',
    latencyMs: 'latencyMs' in overrides ? overrides.latencyMs ?? null : null,
    isActive: overrides.isActive ?? true,
    sourceUrl: overrides.sourceUrl ?? 'https://cdn.example.com/play.m3u8',
    updatedAt: overrides.updatedAt ?? '2026-05-27T00:00:00Z',
  }
}

function makeLine(overrides: Partial<LineAggregate> & { key: string; episodes: ReadonlyArray<EpisodeMini> }): LineAggregate {
  return {
    key: overrides.key,
    siteKey: overrides.siteKey ?? 'site_a',
    lineName: overrides.lineName ?? 'LineA',
    hostname: 'hostname' in overrides ? overrides.hostname ?? null : null,
    totalEpisodes: overrides.totalEpisodes ?? overrides.episodes.length,
    activeCount: overrides.activeCount ?? overrides.episodes.filter(e => e.isActive).length,
    probeAggregate: overrides.probeAggregate ?? 'ok',
    renderAggregate: overrides.renderAggregate ?? 'ok',
    latencyMedianMs: 'latencyMedianMs' in overrides ? overrides.latencyMedianMs ?? null : null,
    qualityHighest: 'qualityHighest' in overrides ? overrides.qualityHighest ?? null : null,
    episodes: overrides.episodes,
    // CHG-368-B-C-UI / ADR-164：codename / retiredAt 默认 null（既有 fixture 兼容）
    codename: 'codename' in overrides ? overrides.codename ?? null : null,
    retiredAt: 'retiredAt' in overrides ? overrides.retiredAt ?? null : null,
  }
}

function noop() { /* no-op */ }

function baseProps(overrides: Partial<LinesPanelProps> & { lines: ReadonlyArray<LineAggregate> }): LinesPanelProps {
  return {
    lines: overrides.lines,
    onToggleEpisode: overrides.onToggleEpisode ?? noop,
    onDisableDead: overrides.onDisableDead ?? noop,
    onRefetch: overrides.onRefetch ?? noop,
    onHealthOpen: overrides.onHealthOpen ?? noop,
    ...overrides,
  }
}

// 默认 expand 单行：render 后点击展开按钮（lines-panel.tsx LineRow ▸ → ▾）
function renderExpanded(props: LinesPanelProps): { rerender: (p: LinesPanelProps) => void } {
  const view = render(<LinesPanel {...props} />)
  // 找 "展开 LineA" aria-label 按钮（lines-panel.tsx line 175）
  const expandBtn = view.container.querySelector<HTMLButtonElement>('[aria-label^="展开 "]')
  if (expandBtn) fireEvent.click(expandBtn)
  return {
    rerender: (p: LinesPanelProps) => view.rerender(<LinesPanel {...p} />),
  }
}

// ── Case 1 ────────────────────────────────────────────────────────────────────

describe('Case 1 — 未提供 onProbeEpisode → 探测按钮不渲染', () => {
  it('episode 行无"探测"按钮 aria-label', () => {
    const line = makeLine({
      key: 'site_a|LineA',
      episodes: [makeEp({ id: 'ep1' })],
    })
    renderExpanded(baseProps({ lines: [line] }))
    expect(screen.queryByRole('button', { name: /探测第 .* 集线路状态/ })).toBeNull()
  })
})

// ── Case 2 ────────────────────────────────────────────────────────────────────

describe('Case 2 — 未提供 onRenderCheckEpisode → 试播按钮不渲染', () => {
  it('episode 行无"试播"按钮 aria-label', () => {
    const line = makeLine({
      key: 'site_a|LineA',
      episodes: [makeEp({ id: 'ep1' })],
    })
    renderExpanded(baseProps({ lines: [line] }))
    expect(screen.queryByRole('button', { name: /试播第 .* 集渲染检测/ })).toBeNull()
  })
})

// ── Case 3 ────────────────────────────────────────────────────────────────────

describe('Case 3 — 点击探测按钮 → onProbeEpisode({ lineKey, episodeId }) 调用', () => {
  it('R1/B 决策：args 必须含 lineKey + episodeId 二字段', () => {
    const onProbeEpisode = vi.fn()
    const line = makeLine({
      key: 'site_a|LineA',
      episodes: [makeEp({ id: 'ep-uuid-1', episodeNumber: 3 })],
    })
    renderExpanded(baseProps({ lines: [line], onProbeEpisode }))
    const btn = screen.getByRole('button', { name: /探测第 3 集线路状态/ })
    fireEvent.click(btn)
    expect(onProbeEpisode).toHaveBeenCalledWith({ lineKey: 'site_a|LineA', episodeId: 'ep-uuid-1' })
    expect(onProbeEpisode).toHaveBeenCalledOnce()
  })
})

// ── Case 4 ────────────────────────────────────────────────────────────────────

describe('Case 4 — 点击试播按钮 → onRenderCheckEpisode({ lineKey, episodeId }) 调用', () => {
  it('args 与 onProbeEpisode 对称', () => {
    const onRenderCheckEpisode = vi.fn()
    const line = makeLine({
      key: 'site_a|LineA',
      episodes: [makeEp({ id: 'ep-uuid-2', episodeNumber: 5 })],
    })
    renderExpanded(baseProps({ lines: [line], onRenderCheckEpisode }))
    const btn = screen.getByRole('button', { name: /试播第 5 集渲染检测/ })
    fireEvent.click(btn)
    expect(onRenderCheckEpisode).toHaveBeenCalledWith({ lineKey: 'site_a|LineA', episodeId: 'ep-uuid-2' })
    expect(onRenderCheckEpisode).toHaveBeenCalledOnce()
  })
})

// ── Case 5 ────────────────────────────────────────────────────────────────────

describe('Case 5 — probingEpisodeIds 含 ep.id → 探测按钮 disabled + 文案 "探测…"', () => {
  it('disabled 状态 + 文本变化', () => {
    const onProbeEpisode = vi.fn()
    const line = makeLine({
      key: 'site_a|LineA',
      episodes: [makeEp({ id: 'ep-active', episodeNumber: 1 })],
    })
    renderExpanded(baseProps({
      lines: [line],
      onProbeEpisode,
      probingEpisodeIds: new Set(['ep-active']),
    }))
    const btn = screen.getByRole('button', { name: /探测第 1 集线路状态/ }) as HTMLButtonElement
    expect(btn.disabled).toBe(true)
    expect(btn.textContent).toBe('探测…')
    // 点击 disabled 按钮无效
    fireEvent.click(btn)
    expect(onProbeEpisode).not.toHaveBeenCalled()
  })
})

// ── Case 6 ────────────────────────────────────────────────────────────────────

describe('Case 6 — renderCheckingEpisodeIds 含 ep.id → 试播按钮 disabled + 文案 "试播…"', () => {
  it('disabled 状态 + 文本变化', () => {
    const onRenderCheckEpisode = vi.fn()
    const line = makeLine({
      key: 'site_a|LineA',
      episodes: [makeEp({ id: 'ep-active', episodeNumber: 1 })],
    })
    renderExpanded(baseProps({
      lines: [line],
      onRenderCheckEpisode,
      renderCheckingEpisodeIds: new Set(['ep-active']),
    }))
    const btn = screen.getByRole('button', { name: /试播第 1 集渲染检测/ }) as HTMLButtonElement
    expect(btn.disabled).toBe(true)
    expect(btn.textContent).toBe('试播…')
    fireEvent.click(btn)
    expect(onRenderCheckEpisode).not.toHaveBeenCalled()
  })
})

// ── Case 7 ────────────────────────────────────────────────────────────────────

describe('Case 7 — a11y aria-label 与现有按钮范式对齐', () => {
  it('episodeNumber=null → "第 ? 集" fallback（与启用按钮 line 109 范式一致）', () => {
    const onProbeEpisode = vi.fn()
    const onRenderCheckEpisode = vi.fn()
    const line = makeLine({
      key: 'site_a|LineA',
      episodes: [makeEp({ id: 'ep-no-num', episodeNumber: null })],
    })
    renderExpanded(baseProps({ lines: [line], onProbeEpisode, onRenderCheckEpisode }))
    // 用 regex 因 '?' 在 testing-library exact match 中有特殊处理
    expect(screen.getByRole('button', { name: /探测第 \? 集线路状态/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /试播第 \? 集渲染检测/ })).toBeTruthy()
  })
})

// ── Case 8 ────────────────────────────────────────────────────────────────────

describe('Case 8 — 既有功能 smoke：启用/停用 + 健康 + 选中态不回归', () => {
  it('启用按钮 + 健康按钮 + 受控选择 R1 仍然工作', () => {
    const onToggleEpisode = vi.fn()
    const onHealthOpen = vi.fn()
    const onLineSelect = vi.fn()
    const line = makeLine({
      key: 'site_a|LineA',
      episodes: [makeEp({ id: 'ep1', episodeNumber: 7, isActive: true })],
    })
    renderExpanded(baseProps({
      lines: [line],
      onToggleEpisode,
      onHealthOpen,
      // R1 受控对：selectedKey + onLineSelect 同时出现
      selectedKey: null,
      onLineSelect,
    }))
    // 启用按钮（line 107-115）
    const toggleBtn = screen.getByRole('button', { name: /停用第 7 集/ })
    fireEvent.click(toggleBtn)
    expect(onToggleEpisode).toHaveBeenCalledWith({
      lineKey: 'site_a|LineA',
      episodeId: 'ep1',
      nextActive: false,
      updatedAt: '2026-05-27T00:00:00Z',
    })
    // 健康按钮（line 116-123）
    const healthBtn = screen.getByRole('button', { name: /第 7 集健康报告/ })
    fireEvent.click(healthBtn)
    expect(onHealthOpen).toHaveBeenCalledWith({ lineKey: 'site_a|LineA', episodeId: 'ep1' })
    // 选中态触发（点击 line 行）
    const lineRow = screen.getByRole('row', { selected: false })
    fireEvent.click(lineRow)
    expect(onLineSelect).toHaveBeenCalled()
    expect(onLineSelect.mock.calls[0][0].lineKey).toBe('site_a|LineA')
  })
})

// ── Case 9 ────────────────────────────────────────────────────────────────────

describe('Case 9 — I2 防 race + 并行不污染', () => {
  it('toggling 含 ep1 → ep1 探测/试播按钮均 disabled / ep2 不受影响', () => {
    const onProbeEpisode = vi.fn()
    const onRenderCheckEpisode = vi.fn()
    const line = makeLine({
      key: 'site_a|LineA',
      episodes: [
        makeEp({ id: 'ep1', episodeNumber: 1 }),
        makeEp({ id: 'ep2', episodeNumber: 2 }),
      ],
    })
    renderExpanded(baseProps({
      lines: [line],
      onProbeEpisode,
      onRenderCheckEpisode,
      toggling: new Set(['ep1']), // I2：toggle 期间 probe/render-check 同 disabled
    }))
    // ep1 探测 + 试播均 disabled（防 toggle+probe race）
    expect((screen.getByRole('button', { name: /探测第 1 集线路状态/ }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: /试播第 1 集渲染检测/ }) as HTMLButtonElement).disabled).toBe(true)
    // ep2 探测 + 试播仍可点（不受 ep1 toggling 影响）
    const ep2Probe = screen.getByRole('button', { name: /探测第 2 集线路状态/ }) as HTMLButtonElement
    expect(ep2Probe.disabled).toBe(false)
    fireEvent.click(ep2Probe)
    expect(onProbeEpisode).toHaveBeenCalledWith({ lineKey: 'site_a|LineA', episodeId: 'ep2' })
  })

  it('probingEpisodeIds 含 ep1 → ep2 探测按钮仍可点（独立 set 跨 epId 不污染）', () => {
    const onProbeEpisode = vi.fn()
    const line = makeLine({
      key: 'site_a|LineA',
      episodes: [
        makeEp({ id: 'ep1', episodeNumber: 1 }),
        makeEp({ id: 'ep2', episodeNumber: 2 }),
      ],
    })
    renderExpanded(baseProps({
      lines: [line],
      onProbeEpisode,
      probingEpisodeIds: new Set(['ep1']),
    }))
    expect((screen.getByRole('button', { name: /探测第 1 集线路状态/ }) as HTMLButtonElement).disabled).toBe(true)
    const ep2Probe = screen.getByRole('button', { name: /探测第 2 集线路状态/ }) as HTMLButtonElement
    expect(ep2Probe.disabled).toBe(false)
    fireEvent.click(ep2Probe)
    expect(onProbeEpisode).toHaveBeenCalledWith({ lineKey: 'site_a|LineA', episodeId: 'ep2' })
  })

  it('probingEpisodeIds 与 renderCheckingEpisodeIds 跨 set 独立（同 epId 两按钮独立 disabled）', () => {
    const onProbeEpisode = vi.fn()
    const onRenderCheckEpisode = vi.fn()
    const line = makeLine({
      key: 'site_a|LineA',
      episodes: [makeEp({ id: 'ep1', episodeNumber: 1 })],
    })
    renderExpanded(baseProps({
      lines: [line],
      onProbeEpisode,
      onRenderCheckEpisode,
      probingEpisodeIds: new Set(['ep1']),
      // renderCheckingEpisodeIds 不含 ep1
    }))
    // 探测 disabled / 试播仍可点（A1 决策：2 独立 set / 不混淆）
    expect((screen.getByRole('button', { name: /探测第 1 集线路状态/ }) as HTMLButtonElement).disabled).toBe(true)
    const renderBtn = screen.getByRole('button', { name: /试播第 1 集渲染检测/ }) as HTMLButtonElement
    expect(renderBtn.disabled).toBe(false)
    fireEvent.click(renderBtn)
    expect(onRenderCheckEpisode).toHaveBeenCalledOnce()
  })
})

// ── CHG-368-B-C-UI / ADR-164 D-164-2 + D-164-4：codename badge + 退役标识 ──

describe('CHG-368-B-C-UI — codename badge + 退役标识（ADR-164 §6）', () => {
  it('line.codename 非 NULL → 渲染 codename badge（data-line-codename / aria-label "运维代号"）', () => {
    const line = makeLine({
      key: 'site_a|LineA',
      codename: '泰山-2',
      episodes: [makeEp({ id: 'ep1' })],
    })
    const { container } = render(<LinesPanel {...baseProps({ lines: [line] })} />)
    const badge = container.querySelector('[data-line-codename]')
    expect(badge).not.toBeNull()
    expect(badge?.textContent).toBe('泰山-2')
    expect(badge?.getAttribute('aria-label')).toBe('运维代号 泰山-2')
  })

  it('line.codename = NULL → 不渲染 codename badge', () => {
    const line = makeLine({
      key: 'site_a|LineA',
      codename: null,
      episodes: [makeEp({ id: 'ep1' })],
    })
    const { container } = render(<LinesPanel {...baseProps({ lines: [line] })} />)
    expect(container.querySelector('[data-line-codename]')).toBeNull()
  })

  it('line.retiredAt 非 NULL → 行 data-retired=true + 渲染"（已退役）"标识 + aria-label "线路已退役"', () => {
    const line = makeLine({
      key: 'site_a|LineA',
      retiredAt: '2026-04-01T00:00:00Z',
      episodes: [makeEp({ id: 'ep1' })],
    })
    const { container } = render(<LinesPanel {...baseProps({ lines: [line] })} />)
    const row = container.querySelector('[data-line-row]')
    expect(row?.getAttribute('data-retired')).toBe('true')
    const retiredLabel = container.querySelector('[data-line-retired-label]')
    expect(retiredLabel).not.toBeNull()
    expect(retiredLabel?.textContent).toBe('（已退役）')
    expect(retiredLabel?.getAttribute('aria-label')).toBe('线路已退役')
  })

  it('line.retiredAt = NULL → 行无 data-retired 标记 / 无退役标识', () => {
    const line = makeLine({
      key: 'site_a|LineA',
      retiredAt: null,
      episodes: [makeEp({ id: 'ep1' })],
    })
    const { container } = render(<LinesPanel {...baseProps({ lines: [line] })} />)
    const row = container.querySelector('[data-line-row]')
    expect(row?.getAttribute('data-retired')).toBeNull()
    expect(container.querySelector('[data-line-retired-label]')).toBeNull()
  })
})
