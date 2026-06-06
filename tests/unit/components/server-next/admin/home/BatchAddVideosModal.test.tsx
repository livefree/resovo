/**
 * BatchAddVideosModal.test.tsx — 批量添加统一确认面板（CHG-HOME-UX-07）
 *
 * 覆盖：
 *   #1 已在列项标灰「已在列 · 跳过」（展示层估计，不决定提交集）
 *   #2 确认提交全量 selected（FIX2：过滤唯一真源 = 服务端守卫）
 *   #3 全部本地标灰仍可提交（FIX3：本地估计不阻断）；仅 selected 空禁用
 *   #4 slot 切换 → 去重集合按目标 slot 重新比对
 *   #5 initialItems 预填（08 深链 / 09 趋势导入复用口）
 *   #6 defaultSlot=type_shortcuts（不适用）→ 回落 banner
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import type { PickerVideoItem } from '@resovo/admin-ui'

// mock VideoPicker（multiple 形态轻量化：按钮注入固定项）；其余 admin-ui 原样
vi.mock('@resovo/admin-ui', async () => {
  const actual = await vi.importActual<typeof import('@resovo/admin-ui')>('@resovo/admin-ui')
  return {
    ...actual,
    VideoPicker: ({ value, onChange }: { value: readonly PickerVideoItem[]; onChange: (next: readonly PickerVideoItem[]) => void }) => (
      <button
        type="button"
        data-testid="mock-video-picker"
        onClick={() => onChange([...value, makeItem(`v-${value.length + 1}`)])}
      >
        mock-picker ({value.length})
      </button>
    ),
  }
})

vi.mock('../../../../../../apps/server-next/src/lib/videos/picker-fetcher', () => ({
  videoPickerFetcher: vi.fn(),
}))

import { BatchAddVideosModal } from '../../../../../../apps/server-next/src/app/admin/home/_client/BatchAddVideosModal'
import type { HomeModuleSlot } from '../../../../../../apps/server-next/src/lib/home-modules/types'

function makeItem(id: string): PickerVideoItem {
  return {
    id,
    shortId: id,
    title: `视频 ${id}`,
    titleEn: null,
    type: 'movie',
    year: 2026,
    coverUrl: null,
    isPublished: true,
  }
}

beforeEach(() => {
  cleanup()
  vi.clearAllMocks()
})

function renderModal(over: Partial<Parameters<typeof BatchAddVideosModal>[0]> = {}) {
  const onConfirm = vi.fn().mockResolvedValue(undefined)
  const getExistingIds = over.getExistingIds ?? (() => new Set<string>())
  render(
    <BatchAddVideosModal
      open
      defaultSlot="featured"
      getExistingIds={getExistingIds}
      onClose={vi.fn()}
      onConfirm={onConfirm}
      {...over}
    />,
  )
  return onConfirm
}

describe('BatchAddVideosModal — 去重与确认', () => {
  it('已在列项标灰（展示层估计）+ 确认提交全量 selected（过滤唯一真源在服务端守卫，FIX2）', async () => {
    const items = [makeItem('v-a'), makeItem('v-b'), makeItem('v-c')]
    const onConfirm = renderModal({
      initialItems: items,
      getExistingIds: () => new Set(['v-b']),
    })

    // v-b 标灰（展示）
    expect(screen.queryByTestId('batch-add-existing-v-b')).not.toBeNull()
    expect(screen.queryByTestId('batch-add-existing-v-a')).toBeNull()
    // 摘要：预计添加 2 · 跳过 1（本地估计，确认后以服务端为准）
    expect(screen.getByTestId('batch-add-summary').textContent).toContain('预计添加 2 个')
    expect(screen.getByTestId('batch-add-summary').textContent).toContain('跳过 1 个')

    fireEvent.click(screen.getByTestId('batch-add-confirm'))
    await waitFor(() => expect(onConfirm).toHaveBeenCalled())
    const [slot, submitted] = onConfirm.mock.calls[0] as [HomeModuleSlot, readonly PickerVideoItem[]]
    expect(slot).toBe('featured')
    // FIX2 核心断言：提交全量（含本地标灰的 v-b）——本地预过滤不决定提交集，
    // 缓存陈旧时由 handleBatchAdd 服务端守卫统一裁决
    expect(submitted.map((i) => i.id)).toEqual(['v-a', 'v-b', 'v-c'])
  })

  it('全部本地标灰仍可提交（FIX3：本地估计不阻断服务端校验确认）', async () => {
    const onConfirm = renderModal({
      initialItems: [makeItem('v-a')],
      getExistingIds: () => new Set(['v-a']),  // 本地缓存认为全在列（可能陈旧）
    })
    const btn = screen.getByTestId('batch-add-confirm') as HTMLButtonElement
    expect(btn.disabled).toBe(false)  // 不被本地估计阻断
    fireEvent.click(btn)
    await waitFor(() => expect(onConfirm).toHaveBeenCalled())
    // 全量提交，服务端守卫裁决
    expect((onConfirm.mock.calls[0][1] as readonly { id: string }[]).map((i) => i.id)).toEqual(['v-a'])
  })

  it('selected 为空 → 确认按钮禁用 + onConfirm 不触发（唯一禁用条件）', () => {
    const onConfirm = renderModal()
    const btn = screen.getByTestId('batch-add-confirm') as HTMLButtonElement
    expect(btn.disabled).toBe(true)
    fireEvent.click(btn)
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('slot 切换 → 去重按目标 slot 重新比对', async () => {
    renderModal({
      initialItems: [makeItem('v-a')],
      getExistingIds: (slot: HomeModuleSlot) => (slot === 'top10' ? new Set(['v-a']) : new Set()),
    })
    // featured（默认）：v-a 可添加
    expect(screen.getByTestId('batch-add-summary').textContent).toContain('预计添加 1 个')
    // 切到 top10（AdminSelect 自定义 combobox：click 展开 → mouseDown option，admin-select.test 先例）
    fireEvent.click(screen.getByRole('combobox'))
    const options = screen.getAllByRole('option')
    const top10Opt = options.find((o) => o.textContent?.includes('TOP 10'))
    expect(top10Opt).toBeTruthy()
    fireEvent.mouseDown(top10Opt as HTMLElement)
    await waitFor(() => {
      expect(screen.getByTestId('batch-add-summary').textContent).toContain('预计添加 0 个')
    })
  })
})

describe('BatchAddVideosModal — 入口形态', () => {
  it('页内入口（无 initialItems）：经 VideoPicker multiple 增选', () => {
    renderModal()
    expect(screen.getByTestId('batch-add-summary').textContent).toContain('预计添加 0 个')
    fireEvent.click(screen.getByTestId('mock-video-picker'))
    expect(screen.getByTestId('batch-add-summary').textContent).toContain('预计添加 1 个')
  })

  it('initialItems 预填（深链/趋势导入复用口）渲染候选列表', () => {
    renderModal({ initialItems: [makeItem('v-x'), makeItem('v-y')] })
    expect(screen.queryByTestId('batch-add-item-v-x')).not.toBeNull()
    expect(screen.queryByTestId('batch-add-item-v-y')).not.toBeNull()
  })

  it('defaultSlot=type_shortcuts（不适用批量选片）→ 回落 banner', async () => {
    const onConfirm = renderModal({
      defaultSlot: 'type_shortcuts',
      initialItems: [makeItem('v-a')],
    })
    fireEvent.click(screen.getByTestId('batch-add-confirm'))
    await waitFor(() => expect(onConfirm).toHaveBeenCalled())
    expect(onConfirm.mock.calls[0][0]).toBe('banner')
  })
})
