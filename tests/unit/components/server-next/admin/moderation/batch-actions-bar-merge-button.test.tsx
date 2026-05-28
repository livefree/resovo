/**
 * batch-actions-bar-merge-button.test.tsx — CHG-364-A MERGE-INLINE -A
 *
 * 范围：BatchActionsBar "↔ 合并" 按钮条件渲染 + onMerge 回调（plan §10.2 / plan #11）
 *
 * 覆盖：
 *  1. selectedCount >= 2 + onMerge 提供 → 合并按钮显示
 *  2. selectedCount === 1 → 合并按钮不显示（merge 协议至少 1 source + 1 target = 2）
 *  3. selectedCount >= 2 + onMerge 未提供 → 合并按钮不显示（向后兼容）
 *  4. 点击合并按钮 → onMerge 回调被调用
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, cleanup } from '@testing-library/react'

import { BatchActionsBar } from '../../../../../../apps/server-next/src/app/admin/moderation/_client/BatchActionsBar'

afterEach(() => {
  cleanup()
})

describe('BatchActionsBar — CHG-364-A "↔ 合并" 按钮入口', () => {
  it('selectedCount >= 2 + onMerge 提供 → 合并按钮显示', () => {
    render(
      <BatchActionsBar
        selectedCount={3}
        onApprove={vi.fn()}
        onReject={vi.fn()}
        onClear={vi.fn()}
        pending={false}
        onMerge={vi.fn()}
      />
    )
    expect(screen.getByTestId('moderation-batch-merge')).toBeTruthy()
  })

  it('selectedCount === 1 → 合并按钮不显示（merge 协议至少 2 条）', () => {
    render(
      <BatchActionsBar
        selectedCount={1}
        onApprove={vi.fn()}
        onReject={vi.fn()}
        onClear={vi.fn()}
        pending={false}
        onMerge={vi.fn()}
      />
    )
    expect(screen.queryByTestId('moderation-batch-merge')).toBeNull()
  })

  it('selectedCount >= 2 + onMerge 未提供 → 合并按钮不显示（向后兼容）', () => {
    render(
      <BatchActionsBar
        selectedCount={5}
        onApprove={vi.fn()}
        onReject={vi.fn()}
        onClear={vi.fn()}
        pending={false}
      />
    )
    expect(screen.queryByTestId('moderation-batch-merge')).toBeNull()
  })

  it('点击合并按钮 → onMerge 回调被调用', () => {
    const onMerge = vi.fn()
    render(
      <BatchActionsBar
        selectedCount={2}
        onApprove={vi.fn()}
        onReject={vi.fn()}
        onClear={vi.fn()}
        pending={false}
        onMerge={onMerge}
      />
    )
    fireEvent.click(screen.getByTestId('moderation-batch-merge'))
    expect(onMerge).toHaveBeenCalledTimes(1)
  })
})
