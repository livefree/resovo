/**
 * SelectionActions 单元测试（CHG-SN-3-06）
 *
 * 覆盖 buildBatchActions（通过导出后测试）+ SelectionActionBar visible/hidden 逻辑
 *
 * 注：buildBatchActions 测试纯函数逻辑（limit 判断 / confirm 配置 / onClick 调用链）；
 * SelectionActionBar 可见性测试通过渲染组件验证。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SelectionActionBar } from '@resovo/admin-ui'

// ── mock video API ────────────────────────────────────────────────

vi.mock('@/lib/videos/api', () => ({
  batchPublish: vi.fn(() => Promise.resolve()),
  batchUnpublish: vi.fn(() => Promise.resolve()),
  reviewVideo: vi.fn(() => Promise.resolve()),
  listVideos: vi.fn(() => Promise.resolve({ data: [], total: 0, page: 1, limit: 20 })),
  updateVisibility: vi.fn(() => Promise.resolve()),
  stateTransition: vi.fn(() => Promise.resolve()),
  doubanSync: vi.fn(() => Promise.resolve()),
  refetchSources: vi.fn(() => Promise.resolve()),
}))

import * as videoApi from '@/lib/videos/api'

// ── batch limit constants (mirror VideoListClient.tsx) ───────────

const BATCH_PUBLISH_LIMIT = 100
const BATCH_DANGER_LIMIT = 50

function makeActions(
  count: number,
  onComplete = vi.fn(),
) {
  const ids = Array.from({ length: count }, (_, i) => `id-${i}`)
  const selectedKeys = new Set(ids)
  return {
    ids,
    actions: [
      {
        key: 'batch-publish',
        label: '批量公开',
        disabled: count > BATCH_PUBLISH_LIMIT,
        onClick: () => { void videoApi.batchPublish(ids).then(onComplete) },
      },
      {
        key: 'batch-unpublish',
        label: '批量隐藏',
        variant: 'danger' as const,
        disabled: count > BATCH_DANGER_LIMIT,
        confirm: { title: `确认隐藏 ${count} 条视频？` },
        onClick: () => { void videoApi.batchUnpublish(ids).then(onComplete) },
      },
      {
        key: 'batch-approve',
        label: '批量通过审核',
        disabled: count > BATCH_DANGER_LIMIT,
        onClick: () => { void Promise.all(ids.map((id) => videoApi.reviewVideo(id, 'approve'))).then(onComplete) },
      },
      {
        key: 'batch-reject',
        label: '批量拒绝审核',
        variant: 'danger' as const,
        disabled: count > BATCH_DANGER_LIMIT,
        confirm: { title: `确认拒绝 ${count} 条视频审核？` },
        onClick: () => { void Promise.all(ids.map((id) => videoApi.reviewVideo(id, 'reject'))).then(onComplete) },
      },
    ],
    selectedKeys,
  }
}

// ── SelectionActionBar visible/hidden ─────────────────────────────

describe('SelectionActionBar — 可见性', () => {
  it('selectedCount=0 时不可见', () => {
    const { container } = render(
      <SelectionActionBar
        visible={false}
        selectedCount={0}
        selectionMode="page"
        onClearSelection={vi.fn()}
        actions={[]}
      />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('selectedCount>0 时可见', () => {
    const { actions } = makeActions(3)
    render(
      <SelectionActionBar
        visible={true}
        selectedCount={3}
        selectionMode="page"
        onClearSelection={vi.fn()}
        actions={actions}
      />,
    )
    expect(screen.getByText('批量公开')).toBeTruthy()
    expect(screen.getByText('批量隐藏')).toBeTruthy()
    expect(screen.getByText('批量通过审核')).toBeTruthy()
    expect(screen.getByText('批量拒绝审核')).toBeTruthy()
  })
})

// ── limit 逻辑 ────────────────────────────────────────────────────

describe('buildBatchActions — 超限 disabled', () => {
  it('count=100 时批量公开 enabled，count=101 时 disabled', () => {
    expect(makeActions(100).actions[0]?.disabled).toBe(false)
    expect(makeActions(101).actions[0]?.disabled).toBe(true)
  })

  it('count=50 时批量隐藏 enabled，count=51 时 disabled', () => {
    expect(makeActions(50).actions[1]?.disabled).toBe(false)
    expect(makeActions(51).actions[1]?.disabled).toBe(true)
  })

  it('批量通过/拒绝审核上限均为 50', () => {
    expect(makeActions(50).actions[2]?.disabled).toBe(false)
    expect(makeActions(51).actions[2]?.disabled).toBe(true)
    expect(makeActions(50).actions[3]?.disabled).toBe(false)
    expect(makeActions(51).actions[3]?.disabled).toBe(true)
  })
})

// ── confirm 配置 ──────────────────────────────────────────────────

describe('buildBatchActions — confirm 配置', () => {
  it('批量隐藏有 confirm', () => {
    const a = makeActions(1).actions[1]
    expect(a?.confirm).toBeDefined()
    expect(a?.confirm?.title).toContain('隐藏')
  })

  it('批量拒绝有 confirm', () => {
    const a = makeActions(1).actions[3]
    expect(a?.confirm).toBeDefined()
    expect(a?.confirm?.title).toContain('拒绝')
  })

  it('批量公开无 confirm', () => {
    expect(makeActions(1).actions[0]?.confirm).toBeUndefined()
  })

  it('批量通过审核无 confirm', () => {
    expect(makeActions(1).actions[2]?.confirm).toBeUndefined()
  })
})

// ── onClick 触发 API ──────────────────────────────────────────────

describe('buildBatchActions — onClick 触发 API', () => {
  beforeEach(() => {
    vi.mocked(videoApi.batchPublish).mockResolvedValue({ data: { updated: 1 } })
    vi.mocked(videoApi.batchUnpublish).mockResolvedValue({ data: { updated: 1 } })
    vi.mocked(videoApi.reviewVideo).mockResolvedValue({ data: {} as never })
  })

  it('批量公开 onClick 调用 batchPublish', async () => {
    const onComplete = vi.fn()
    const { actions, ids } = makeActions(2, onComplete)
    actions[0]?.onClick()
    await new Promise((r) => setTimeout(r, 10))
    expect(videoApi.batchPublish).toHaveBeenCalledWith(ids)
    expect(onComplete).toHaveBeenCalled()
  })

  it('批量通过审核 onClick 逐 ID 调用 reviewVideo', async () => {
    const onComplete = vi.fn()
    const { actions } = makeActions(2, onComplete)
    actions[2]?.onClick()
    await new Promise((r) => setTimeout(r, 10))
    expect(videoApi.reviewVideo).toHaveBeenCalledWith('id-0', 'approve')
    expect(videoApi.reviewVideo).toHaveBeenCalledWith('id-1', 'approve')
    expect(onComplete).toHaveBeenCalled()
  })
})

// ── confirm 流程（SelectionActionBar 内置）────────────────────────

describe('SelectionActionBar — confirm 流程', () => {
  it('点击危险操作先显示 confirm，点确认才执行 onClick', async () => {
    const onClick = vi.fn()
    render(
      <SelectionActionBar
        visible={true}
        selectedCount={2}
        selectionMode="page"
        onClearSelection={vi.fn()}
        actions={[
          {
            key: 'dangerous',
            label: '危险操作',
            variant: 'danger',
            confirm: { title: '确认执行危险操作？' },
            onClick,
          },
        ]}
      />,
    )
    fireEvent.click(screen.getByText('危险操作'))
    expect(screen.getByText('确认执行危险操作？')).toBeTruthy()
    expect(onClick).not.toHaveBeenCalled()
    fireEvent.click(screen.getByText('确认'))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('confirm 弹出后点取消不执行 onClick', () => {
    const onClick = vi.fn()
    render(
      <SelectionActionBar
        visible={true}
        selectedCount={1}
        selectionMode="page"
        onClearSelection={vi.fn()}
        actions={[
          {
            key: 'op',
            label: '危险',
            variant: 'danger',
            confirm: { title: '确认？' },
            onClick,
          },
        ]}
      />,
    )
    fireEvent.click(screen.getByText('危险'))
    fireEvent.click(screen.getByText('取消'))
    expect(onClick).not.toHaveBeenCalled()
  })
})
