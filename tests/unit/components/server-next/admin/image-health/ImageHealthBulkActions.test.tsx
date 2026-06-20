/**
 * ImageHealthBulkActions.test.tsx — Tab B 批量操作条（IMGH-P2-3B / SEQ-20260619-02）
 *
 * 覆盖（0A CONCERN-3：无伪批量；仅「批量重扫」真实端点 +「打开候选队列」逐个入口）：
 *   - 渲染两按钮（含选中计数）
 *   - 批量重扫 → rescanSelectedVideos(ids) + toast（含跳过提示）+ onResolved(ids)
 *   - 重扫失败 → toast danger + onResolved 不调
 *   - 打开候选队列 → onOpenQueue(ids)
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

const rescanMock = vi.hoisted(() => vi.fn())
vi.mock('../../../../../../apps/server-next/src/lib/image-health/api', () => ({
  rescanSelectedVideos: rescanMock,
}))

const toastPushMock = vi.hoisted(() => vi.fn())
vi.mock('@resovo/admin-ui', async () => {
  const actual = await vi.importActual<typeof import('@resovo/admin-ui')>('@resovo/admin-ui')
  return {
    ...actual,
    useToast: () => ({ push: toastPushMock, dismiss: vi.fn(), dismissAll: vi.fn() }),
  }
})

import { ImageHealthBulkActions } from '../../../../../../apps/server-next/src/app/admin/image-health/_client/ImageHealthBulkActions'

beforeEach(() => {
  rescanMock.mockReset().mockResolvedValue({ updatedCount: 2, enqueuedCount: 2 })
  toastPushMock.mockReset()
})
afterEach(() => cleanup())

const SEL = new Set(['v-1', 'v-2'])

describe('ImageHealthBulkActions', () => {
  it('渲染两按钮 + 选中计数', () => {
    render(<ImageHealthBulkActions selectedKeys={SEL} onResolved={vi.fn()} onOpenQueue={vi.fn()} />)
    expect(screen.getByText('批量重扫选中（2）')).not.toBeNull()
    expect(screen.getByText('打开候选队列（2）')).not.toBeNull()
  })

  it('批量重扫 → rescanSelectedVideos(ids) + toast success + onResolved(ids)', async () => {
    const onResolved = vi.fn()
    render(<ImageHealthBulkActions selectedKeys={SEL} onResolved={onResolved} onOpenQueue={vi.fn()} />)
    fireEvent.click(screen.getByText('批量重扫选中（2）'))
    await waitFor(() => expect(rescanMock).toHaveBeenCalledWith(['v-1', 'v-2']))
    await waitFor(() => expect(toastPushMock).toHaveBeenCalledWith(expect.objectContaining({ level: 'success' })))
    await waitFor(() => expect(onResolved).toHaveBeenCalledWith(['v-1', 'v-2']))
  })

  it('部分行无 URL → toast 含「跳过」提示', async () => {
    rescanMock.mockResolvedValueOnce({ updatedCount: 1, enqueuedCount: 1 })
    render(<ImageHealthBulkActions selectedKeys={SEL} onResolved={vi.fn()} onOpenQueue={vi.fn()} />)
    fireEvent.click(screen.getByText('批量重扫选中（2）'))
    await waitFor(() => {
      const arg = toastPushMock.mock.calls[0][0] as { description: string }
      expect(arg.description).toContain('跳过')
    })
  })

  it('重扫失败 → toast danger + onResolved 不调', async () => {
    rescanMock.mockRejectedValueOnce(new Error('boom'))
    const onResolved = vi.fn()
    render(<ImageHealthBulkActions selectedKeys={SEL} onResolved={onResolved} onOpenQueue={vi.fn()} />)
    fireEvent.click(screen.getByText('批量重扫选中（2）'))
    await waitFor(() => expect(toastPushMock).toHaveBeenCalledWith(expect.objectContaining({ level: 'danger' })))
    expect(onResolved).not.toHaveBeenCalled()
  })

  it('打开候选队列 → onOpenQueue(ids)（不伪批量补图）', () => {
    const onOpenQueue = vi.fn()
    render(<ImageHealthBulkActions selectedKeys={SEL} onResolved={vi.fn()} onOpenQueue={onOpenQueue} />)
    fireEvent.click(screen.getByText('打开候选队列（2）'))
    expect(onOpenQueue).toHaveBeenCalledWith(['v-1', 'v-2'])
    expect(rescanMock).not.toHaveBeenCalled()
  })
})
