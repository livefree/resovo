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
})
