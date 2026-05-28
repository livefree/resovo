/**
 * batch-merge-workspace.test.tsx — CHG-364-B MERGE-INLINE -B
 *
 * 范围：BatchMergeWorkspace 接 ids props / target picker / mergeVideos 调用
 *
 * 覆盖：
 *  1. ids < 2 → 渲染 "需至少 2 个" 提示（不渲染 workspace）
 *  2. ids >= 2 → 渲染 workspace + radio 列表 + 默认第 1 个为 target
 *  3. 选 target 后点提交 → mergeVideos 用正确 sourceVideoIds + targetVideoId 调用
 *  4. ids 含非 uuid / 重复 → 去重 + 校验后只保留有效项
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, cleanup } from '@testing-library/react'

const mergeVideosMock = vi.fn()
const unmergeVideosMock = vi.fn()
const toastPushMock = vi.fn()

vi.mock('../../../../../../apps/server-next/src/lib/merge/api', () => ({
  mergeVideos: (...args: unknown[]) => mergeVideosMock(...args),
  unmergeVideos: (...args: unknown[]) => unmergeVideosMock(...args),
}))

vi.mock('../../../../../../apps/server-next/src/app/admin/merge/_client/MergeClient', () => ({
  describeError: (e: unknown) => (e instanceof Error ? e.message : '未知'),
}))

vi.mock('@resovo/admin-ui', async () => {
  const React = await import('react')
  return {
    AdminCard: ({ children, ...props }: { children: React.ReactNode }) =>
      React.createElement('div', props, children as React.ReactNode),
    AdminButton: ({ children, onClick, disabled, ...props }: {
      children: React.ReactNode
      onClick?: () => void
      disabled?: boolean
    }) =>
      React.createElement(
        'button',
        { onClick, disabled, ...props },
        children as React.ReactNode
      ),
    AdminInput: (props: Record<string, unknown>) =>
      React.createElement('input', props),
    useToast: () => ({ push: toastPushMock }),
  }
})

import { BatchMergeWorkspace } from '../../../../../../apps/server-next/src/app/admin/merge/_client/BatchMergeWorkspace'

const UUID_A = '11111111-1111-1111-1111-111111111111'
const UUID_B = '22222222-2222-2222-2222-222222222222'
const UUID_C = '33333333-3333-3333-3333-333333333333'

beforeEach(() => {
  mergeVideosMock.mockReset()
  unmergeVideosMock.mockReset()
  toastPushMock.mockReset()
})

afterEach(() => {
  cleanup()
})

describe('BatchMergeWorkspace — CHG-364-B 批量合并入口', () => {
  it('ids < 2 → 渲染 "需至少 2 个" 提示', () => {
    render(<BatchMergeWorkspace ids={[UUID_A]} />)
    expect(screen.getByTestId('batch-merge-empty')).toBeTruthy()
    expect(screen.queryByTestId('batch-merge-workspace')).toBeNull()
  })

  it('ids >= 2 → 渲染 workspace + radio 列表 + 默认第 1 个为 target', () => {
    render(<BatchMergeWorkspace ids={[UUID_A, UUID_B, UUID_C]} />)
    expect(screen.getByTestId('batch-merge-workspace')).toBeTruthy()
    expect(screen.getByTestId(`batch-merge-radio-${UUID_A}`)).toBeTruthy()
    expect(screen.getByTestId(`batch-merge-radio-${UUID_B}`)).toBeTruthy()
    expect(screen.getByTestId(`batch-merge-radio-${UUID_C}`)).toBeTruthy()
    // 默认 target 是第 1 个
    expect((screen.getByTestId(`batch-merge-radio-${UUID_A}`) as HTMLInputElement).checked).toBe(true)
  })

  it('选 target 后点提交 → mergeVideos 用正确 sourceVideoIds + targetVideoId 调用', async () => {
    mergeVideosMock.mockResolvedValueOnce({ auditId: 'audit-abc12345' })
    render(<BatchMergeWorkspace ids={[UUID_A, UUID_B, UUID_C]} />)
    // 切到 B 作为 target
    fireEvent.click(screen.getByTestId(`batch-merge-radio-${UUID_B}`))
    fireEvent.click(screen.getByTestId('batch-merge-submit'))
    await waitFor(() => expect(mergeVideosMock).toHaveBeenCalled())
    expect(mergeVideosMock).toHaveBeenCalledWith({
      sourceVideoIds: [UUID_A, UUID_C], // 顺序按 validIds 中非 target 顺序
      targetVideoId: UUID_B,
      reason: undefined,
    })
  })

  it('ids 含非 uuid / 重复 → 去重 + 校验后只保留有效项', () => {
    render(
      <BatchMergeWorkspace
        ids={[UUID_A, UUID_B, UUID_A, 'not-a-uuid', '', UUID_C]}
      />
    )
    // 去重 + 校验：剩 A/B/C 三个
    expect(screen.getByTestId(`batch-merge-radio-${UUID_A}`)).toBeTruthy()
    expect(screen.getByTestId(`batch-merge-radio-${UUID_B}`)).toBeTruthy()
    expect(screen.getByTestId(`batch-merge-radio-${UUID_C}`)).toBeTruthy()
    // 'not-a-uuid' 不会作为 testid 出现
    expect(screen.queryByTestId('batch-merge-radio-not-a-uuid')).toBeNull()
  })

  it('ids 切到新 batch（rerender）→ 旧 target 不在新 batch → 自动重置到新 batch 第 1 个（Codex stop-time review 回归防御）', async () => {
    mergeVideosMock.mockResolvedValueOnce({ auditId: 'audit-xyz' })
    const UUID_X = '99999999-9999-9999-9999-999999999999'
    const UUID_Y = '88888888-8888-8888-8888-888888888888'
    const { rerender } = render(<BatchMergeWorkspace ids={[UUID_A, UUID_B]} />)
    // 默认 target=A
    expect((screen.getByTestId(`batch-merge-radio-${UUID_A}`) as HTMLInputElement).checked).toBe(true)
    // 切到新 batch X/Y（A/B 都不在）
    rerender(<BatchMergeWorkspace ids={[UUID_X, UUID_Y]} />)
    await waitFor(() =>
      expect((screen.getByTestId(`batch-merge-radio-${UUID_X}`) as HTMLInputElement).checked).toBe(true)
    )
    // 提交合并：target 应是新 batch 的 X / 不是旧 batch 的 A
    fireEvent.click(screen.getByTestId('batch-merge-submit'))
    await waitFor(() => expect(mergeVideosMock).toHaveBeenCalled())
    expect(mergeVideosMock).toHaveBeenCalledWith({
      sourceVideoIds: [UUID_Y],
      targetVideoId: UUID_X, // ★ 关键断言：不是 UUID_A（旧 target）
      reason: undefined,
    })
  })

  it('ids 切到新 batch 中包含旧 target → 保留旧 target（用户已选择不重置）', async () => {
    const { rerender } = render(<BatchMergeWorkspace ids={[UUID_A, UUID_B, UUID_C]} />)
    // 切到 B 作为 target
    fireEvent.click(screen.getByTestId(`batch-merge-radio-${UUID_B}`))
    expect((screen.getByTestId(`batch-merge-radio-${UUID_B}`) as HTMLInputElement).checked).toBe(true)
    // rerender batch 仍包含 B（顺序变化 + 添加新 id）
    const UUID_D = '44444444-4444-4444-4444-444444444444'
    rerender(<BatchMergeWorkspace ids={[UUID_C, UUID_B, UUID_D]} />)
    // B 仍在新 batch 中 → 保留旧 target=B（不重置）
    await waitFor(() =>
      expect((screen.getByTestId(`batch-merge-radio-${UUID_B}`) as HTMLInputElement).checked).toBe(true)
    )
  })
})
