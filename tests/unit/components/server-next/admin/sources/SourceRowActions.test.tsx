// @vitest-environment jsdom
/**
 * SourceRowActions.test.tsx — 播放线路表格行操作列三键（CHG-VSR-SOURCES-ROW-ACTIONS / 设计 §6.2）
 *
 * 覆盖：refresh→batchProbeVideo / zap→batchRenderCheckVideo / more 菜单（展开·重采·停用全失效[条件]·别名）
 *       + onReload 刷新 + toast level（success/warn/danger）+ pending 禁用 + 失败不刷新。
 * 范式：相对路径 import + jsdom + mock api/next-navigation/useToast（与 SourcesClient.test 同范式）。
 */
import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import type { VideoGroupRow } from '../../../../../../apps/server-next/src/lib/sources/types'

// ── mocks ─────────────────────────────────────────────────────────

const batchProbeVideoMock = vi.fn()
const batchRenderCheckVideoMock = vi.fn()
const refetchSourcesMock = vi.fn()
const disableDeadSourcesMock = vi.fn()
const toastPushMock = vi.fn()
const routerPushMock = vi.fn()

vi.mock('../../../../../../apps/server-next/src/lib/sources/api', () => ({
  batchProbeVideo: (...a: unknown[]) => batchProbeVideoMock(...a),
  batchRenderCheckVideo: (...a: unknown[]) => batchRenderCheckVideoMock(...a),
  refetchSources: (...a: unknown[]) => refetchSourcesMock(...a),
  disableDeadSources: (...a: unknown[]) => disableDeadSourcesMock(...a),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: routerPushMock, replace: vi.fn(), back: vi.fn(), forward: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
}))

vi.mock('@resovo/admin-ui', async () => {
  const actual = await vi.importActual<typeof import('@resovo/admin-ui')>('@resovo/admin-ui')
  return { ...actual, useToast: () => ({ push: toastPushMock, dismiss: vi.fn(), dismissAll: vi.fn() }) }
})

import { SourceRowActions } from '../../../../../../apps/server-next/src/app/admin/sources/_client/SourceRowActions'

// ── fixtures ──────────────────────────────────────────────────────

function makeRow(overrides: Partial<VideoGroupRow> = {}): VideoGroupRow {
  return {
    videoId: 'vid-1', title: '测试视频', shortId: 'abc', type: 'series', year: 2024,
    coverUrl: null, lineCount: 3, sourceCount: 12,
    probeStatus: 'ok', renderStatus: 'ok', updatedAt: '2026-06-01T00:00:00Z', siteKeys: ['s1'],
    ...overrides,
  }
}

const SUMMARY_OK = { videoId: 'vid-1', results: [], summary: { total: 3, ok: 3, dead: 0, failed: 0 } }
const SUMMARY_ISSUE = { videoId: 'vid-1', results: [], summary: { total: 3, ok: 2, dead: 1, failed: 0 } }

function renderActions(props: Partial<React.ComponentProps<typeof SourceRowActions>> = {}) {
  const onExpandToggle = vi.fn()
  const onReload = vi.fn()
  render(
    <SourceRowActions
      row={makeRow()}
      expanded={false}
      onExpandToggle={onExpandToggle}
      onReload={onReload}
      {...props}
    />,
  )
  return { onExpandToggle, onReload }
}

beforeEach(() => { vi.clearAllMocks() })

// ── refresh / zap inline 键 ───────────────────────────────────────

describe('SourceRowActions — refresh / zap inline 键', () => {
  it('U-1 ↻ refresh → batchProbeVideo(videoId) + onReload + success toast（无失效）', async () => {
    batchProbeVideoMock.mockResolvedValue(SUMMARY_OK)
    const { onReload } = renderActions()
    fireEvent.click(screen.getByTestId('source-row-probe'))
    await waitFor(() => expect(batchProbeVideoMock).toHaveBeenCalledWith('vid-1'))
    await waitFor(() => expect(onReload).toHaveBeenCalledTimes(1))
    expect(toastPushMock).toHaveBeenCalledWith(expect.objectContaining({ level: 'success' }))
  })

  it('U-2 ⚡ zap → batchRenderCheckVideo(videoId) + onReload + warn toast（有失效）', async () => {
    batchRenderCheckVideoMock.mockResolvedValue(SUMMARY_ISSUE)
    const { onReload } = renderActions()
    fireEvent.click(screen.getByTestId('source-row-render-check'))
    await waitFor(() => expect(batchRenderCheckVideoMock).toHaveBeenCalledWith('vid-1'))
    await waitFor(() => expect(onReload).toHaveBeenCalledTimes(1))
    expect(toastPushMock).toHaveBeenCalledWith(expect.objectContaining({ level: 'warn' }))
  })

  it('U-3 probe 失败 → danger toast，不调 onReload', async () => {
    batchProbeVideoMock.mockRejectedValue(new Error('boom'))
    const { onReload } = renderActions()
    fireEvent.click(screen.getByTestId('source-row-probe'))
    await waitFor(() => expect(toastPushMock).toHaveBeenCalledWith(expect.objectContaining({ level: 'danger' })))
    expect(onReload).not.toHaveBeenCalled()
  })

  it('U-4 pending 期间禁用全部按钮（异步未决）', async () => {
    let resolve!: (v: unknown) => void
    batchProbeVideoMock.mockImplementation(() => new Promise((r) => { resolve = r }))
    renderActions()
    fireEvent.click(screen.getByTestId('source-row-probe'))
    // pending 在首个 await 前同步 setState → click 后立即生效（用 DOM .disabled 属性，本仓未装 jest-dom matcher）
    const btn = (id: string) => screen.getByTestId(id) as HTMLButtonElement
    expect(btn('source-row-probe').disabled).toBe(true)
    expect(btn('source-row-render-check').disabled).toBe(true)
    expect(btn('source-row-more').disabled).toBe(true)
    await act(async () => { resolve(SUMMARY_OK) })
    expect(btn('source-row-probe').disabled).toBe(false)
  })
})

// ── more 下拉菜单 ─────────────────────────────────────────────────

describe('SourceRowActions — more 下拉菜单', () => {
  it('U-5 重新采集源 → refetchSources(videoId) + onReload', async () => {
    refetchSourcesMock.mockResolvedValue(undefined)
    const { onReload } = renderActions()
    fireEvent.click(screen.getByTestId('source-row-more'))
    fireEvent.click(await screen.findByText('重新采集源'))
    await waitFor(() => expect(refetchSourcesMock).toHaveBeenCalledWith('vid-1'))
    await waitFor(() => expect(onReload).toHaveBeenCalledTimes(1))
  })

  it('U-6 无失效源（connectFail+renderFail=0）→「停用全失效源」不出现', async () => {
    renderActions({ row: makeRow({ connectFailCount: 0, renderFailCount: 0 }) })
    fireEvent.click(screen.getByTestId('source-row-more'))
    await screen.findByText('重新采集源') // 菜单已展开
    expect(screen.queryByText('停用全失效源')).toBeNull()
  })

  it('U-7 有失效源 →「停用全失效源」出现 + 点击 → disableDeadSources(videoId) + onReload', async () => {
    disableDeadSourcesMock.mockResolvedValue({ disabled: 2 })
    const { onReload } = renderActions({ row: makeRow({ connectFailCount: 2, renderFailCount: 0 }) })
    fireEvent.click(screen.getByTestId('source-row-more'))
    fireEvent.click(await screen.findByText('停用全失效源'))
    await waitFor(() => expect(disableDeadSourcesMock).toHaveBeenCalledWith('vid-1'))
    await waitFor(() => expect(onReload).toHaveBeenCalledTimes(1))
  })

  it('U-8 展开线路矩阵（expanded=false）→ onExpandToggle(videoId)，不调 api', async () => {
    const { onExpandToggle } = renderActions({ expanded: false })
    fireEvent.click(screen.getByTestId('source-row-more'))
    fireEvent.click(await screen.findByText('展开线路矩阵'))
    expect(onExpandToggle).toHaveBeenCalledWith('vid-1')
    expect(batchProbeVideoMock).not.toHaveBeenCalled()
  })

  it('U-9 expanded=true → 菜单文案为「收起线路」', async () => {
    renderActions({ expanded: true })
    fireEvent.click(screen.getByTestId('source-row-more'))
    expect(await screen.findByText('收起线路')).toBeTruthy()
  })

  it('U-10 线路别名管理 → router.push(/admin/source-line-aliases)', async () => {
    renderActions()
    fireEvent.click(screen.getByTestId('source-row-more'))
    fireEvent.click(await screen.findByText('线路别名管理'))
    expect(routerPushMock).toHaveBeenCalledWith('/admin/source-line-aliases')
  })
})
