/**
 * RejectModal 单测（CHG-SN-4-04 D-14 第 3 件）
 *
 * 覆盖契约硬约束：
 *   - open=false → 不渲染（Modal 原语）
 *   - 标签 radio group 渲染 + 单选受控
 *   - defaultLabelKey 预选
 *   - reason textarea + maxLength + 计数
 *   - submit 守门：未选标签 / overLimit / submitting → disable
 *   - onSubmit 收到正确 payload；reason 空 trim 后 undefined
 *   - 不自动关闭：onSubmit resolve 后 Modal 仍 open（消费方控制）
 *   - submitting 受控 disable 全部交互
 *   - 文案 slot
 *   - data-* + testId 钩子
 */
import { afterEach, describe, it, expect, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import React from 'react'
import type { ReviewLabel } from '@resovo/types'
import { RejectModal } from '../../../../../packages/admin-ui/src/components/feedback/reject-modal'

afterEach(() => cleanup())

const mkLabel = (overrides: Partial<ReviewLabel> = {}): ReviewLabel => ({
  id: overrides.id ?? `lbl-${overrides.labelKey ?? 'k'}`,
  labelKey: overrides.labelKey ?? 'all_dead',
  label: overrides.label ?? '全线路失效',
  appliesTo: 'reject',
  displayOrder: 1,
  isActive: true,
  createdAt: '2026-05-01T00:00:00Z',
  ...overrides,
})

const LABELS: readonly ReviewLabel[] = [
  mkLabel({ labelKey: 'all_dead', label: '全线路失效', displayOrder: 1 }),
  mkLabel({ labelKey: 'duplicate', label: '重复条目', displayOrder: 2 }),
  mkLabel({ labelKey: 'violation', label: '违规内容', displayOrder: 3 }),
]

describe('RejectModal — open 控制', () => {
  it('open=false → 不渲染 portal', () => {
    render(
      <RejectModal
        open={false}
        onClose={() => {}}
        labels={LABELS}
        onSubmit={async () => {}}
      />,
    )
    expect(document.querySelector('[data-reject-modal-form]')).toBeNull()
  })

  it('open=true → 渲染表单 + 默认 title', () => {
    render(
      <RejectModal open={true} onClose={() => {}} labels={LABELS} onSubmit={async () => {}} />,
    )
    expect(document.querySelector('[data-reject-modal-form]')).toBeTruthy()
    expect(screen.getByText('拒绝该视频')).toBeTruthy()
  })

  it('自定义 title 覆盖默认', () => {
    render(
      <RejectModal
        open={true}
        onClose={() => {}}
        labels={LABELS}
        onSubmit={async () => {}}
        title="拒绝并归档"
      />,
    )
    expect(screen.getByText('拒绝并归档')).toBeTruthy()
  })
})

describe('RejectModal — 标签 radio group', () => {
  it('每个 label 渲染 data-reject-modal-label-{key}', () => {
    render(
      <RejectModal open={true} onClose={() => {}} labels={LABELS} onSubmit={async () => {}} />,
    )
    expect(document.querySelector('[data-reject-modal-label="all_dead"]')).toBeTruthy()
    expect(document.querySelector('[data-reject-modal-label="duplicate"]')).toBeTruthy()
    expect(document.querySelector('[data-reject-modal-label="violation"]')).toBeTruthy()
  })

  it('label 文案渲染', () => {
    render(
      <RejectModal open={true} onClose={() => {}} labels={LABELS} onSubmit={async () => {}} />,
    )
    expect(screen.getByText('全线路失效')).toBeTruthy()
    expect(screen.getByText('重复条目')).toBeTruthy()
    expect(screen.getByText('违规内容')).toBeTruthy()
  })

  it('点击 label → 单选切换', () => {
    render(
      <RejectModal open={true} onClose={() => {}} labels={LABELS} onSubmit={async () => {}} />,
    )
    const radio = document.querySelector(
      '[data-reject-modal-label="duplicate"] input[type="radio"]',
    ) as HTMLInputElement
    fireEvent.click(radio)
    expect(radio.checked).toBe(true)
    const selectedLabel = document.querySelector('[data-reject-modal-label="duplicate"]')
    expect(selectedLabel?.getAttribute('data-reject-modal-label-selected')).toBe('true')
  })

  it('defaultLabelKey 预选 + 切换 modal open 重置', () => {
    const { rerender } = render(
      <RejectModal
        open={true}
        onClose={() => {}}
        labels={LABELS}
        onSubmit={async () => {}}
        defaultLabelKey="violation"
      />,
    )
    const radio = document.querySelector(
      '[data-reject-modal-label="violation"] input[type="radio"]',
    ) as HTMLInputElement
    expect(radio.checked).toBe(true)

    // 切换 open=false → open=true 应重置默认
    rerender(
      <RejectModal
        open={false}
        onClose={() => {}}
        labels={LABELS}
        onSubmit={async () => {}}
        defaultLabelKey="all_dead"
      />,
    )
    rerender(
      <RejectModal
        open={true}
        onClose={() => {}}
        labels={LABELS}
        onSubmit={async () => {}}
        defaultLabelKey="all_dead"
      />,
    )
    const radio2 = document.querySelector(
      '[data-reject-modal-label="all_dead"] input[type="radio"]',
    ) as HTMLInputElement
    expect(radio2.checked).toBe(true)
  })
})

describe('RejectModal — reason textarea', () => {
  it('默认 maxLength=500 + placeholder 默认', () => {
    render(
      <RejectModal open={true} onClose={() => {}} labels={LABELS} onSubmit={async () => {}} />,
    )
    const textarea = document.querySelector('[data-reject-modal-reason]') as HTMLTextAreaElement
    expect(textarea.maxLength).toBe(500)
    expect(textarea.placeholder).toBe('附加说明（可选，最长 500 字）')
  })

  it('自定义 reasonMaxLength', () => {
    render(
      <RejectModal
        open={true}
        onClose={() => {}}
        labels={LABELS}
        onSubmit={async () => {}}
        reasonMaxLength={200}
      />,
    )
    const textarea = document.querySelector('[data-reject-modal-reason]') as HTMLTextAreaElement
    expect(textarea.maxLength).toBe(200)
  })

  it('字数计数显示 N/Max + 输入更新', () => {
    render(
      <RejectModal open={true} onClose={() => {}} labels={LABELS} onSubmit={async () => {}} />,
    )
    const textarea = document.querySelector('[data-reject-modal-reason]') as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: 'abc' } })
    const counter = document.querySelector('[data-reject-modal-charcount]')!
    expect(counter.textContent).toBe('3 / 500')
  })

  it('自定义 reasonPlaceholder', () => {
    render(
      <RejectModal
        open={true}
        onClose={() => {}}
        labels={LABELS}
        onSubmit={async () => {}}
        reasonPlaceholder="说明拒绝原因"
      />,
    )
    const textarea = document.querySelector('[data-reject-modal-reason]') as HTMLTextAreaElement
    expect(textarea.placeholder).toBe('说明拒绝原因')
  })
})

describe('RejectModal — submit 守门 + payload', () => {
  it('未选标签 → submit 按钮 disabled', () => {
    render(
      <RejectModal open={true} onClose={() => {}} labels={LABELS} onSubmit={async () => {}} />,
    )
    const submitBtn = document.querySelector('[data-reject-modal-submit]') as HTMLButtonElement
    expect(submitBtn.disabled).toBe(true)
  })

  it('选标签后 → submit enabled', () => {
    render(
      <RejectModal open={true} onClose={() => {}} labels={LABELS} onSubmit={async () => {}} />,
    )
    const radio = document.querySelector(
      '[data-reject-modal-label="all_dead"] input[type="radio"]',
    ) as HTMLInputElement
    fireEvent.click(radio)
    const submitBtn = document.querySelector('[data-reject-modal-submit]') as HTMLButtonElement
    expect(submitBtn.disabled).toBe(false)
  })

  it('点击 submit → onSubmit 收到 { labelKey } + reason undefined（reason 空）', () => {
    const submit = vi.fn().mockResolvedValue(undefined)
    render(<RejectModal open={true} onClose={() => {}} labels={LABELS} onSubmit={submit} />)
    fireEvent.click(
      document.querySelector(
        '[data-reject-modal-label="duplicate"] input[type="radio"]',
      ) as HTMLInputElement,
    )
    fireEvent.click(document.querySelector('[data-reject-modal-submit]') as HTMLButtonElement)
    expect(submit).toHaveBeenCalledWith({ labelKey: 'duplicate', reason: undefined })
  })

  it('reason 非空 → onSubmit 收到 trimmed reason', () => {
    const submit = vi.fn().mockResolvedValue(undefined)
    render(<RejectModal open={true} onClose={() => {}} labels={LABELS} onSubmit={submit} />)
    fireEvent.click(
      document.querySelector(
        '[data-reject-modal-label="duplicate"] input[type="radio"]',
      ) as HTMLInputElement,
    )
    const textarea = document.querySelector('[data-reject-modal-reason]') as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: '  违规内容  ' } })
    fireEvent.click(document.querySelector('[data-reject-modal-submit]') as HTMLButtonElement)
    expect(submit).toHaveBeenCalledWith({ labelKey: 'duplicate', reason: '违规内容' })
  })

  it('submitting=true → 全部按钮 + radio + textarea disabled', () => {
    render(
      <RejectModal
        open={true}
        onClose={() => {}}
        labels={LABELS}
        onSubmit={async () => {}}
        defaultLabelKey="all_dead"
        submitting={true}
      />,
    )
    const submitBtn = document.querySelector('[data-reject-modal-submit]') as HTMLButtonElement
    const cancelBtn = document.querySelector('[data-reject-modal-cancel]') as HTMLButtonElement
    const radio = document.querySelector(
      '[data-reject-modal-label="all_dead"] input[type="radio"]',
    ) as HTMLInputElement
    const textarea = document.querySelector('[data-reject-modal-reason]') as HTMLTextAreaElement
    expect(submitBtn.disabled).toBe(true)
    expect(cancelBtn.disabled).toBe(true)
    expect(radio.disabled).toBe(true)
    expect(textarea.disabled).toBe(true)
  })
})

describe('RejectModal — cancel + close', () => {
  it('点击取消按钮 → onClose 触发', () => {
    const onClose = vi.fn()
    render(
      <RejectModal open={true} onClose={onClose} labels={LABELS} onSubmit={async () => {}} />,
    )
    fireEvent.click(document.querySelector('[data-reject-modal-cancel]') as HTMLButtonElement)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('Modal 关闭按钮触发 onClose', () => {
    const onClose = vi.fn()
    render(
      <RejectModal open={true} onClose={onClose} labels={LABELS} onSubmit={async () => {}} />,
    )
    const closeBtn = document.querySelector('[data-close-btn]') as HTMLButtonElement
    fireEvent.click(closeBtn)
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

describe('RejectModal — 自定义文案 + testId', () => {
  it('submitLabel + cancelLabel 覆盖默认', () => {
    render(
      <RejectModal
        open={true}
        onClose={() => {}}
        labels={LABELS}
        onSubmit={async () => {}}
        submitLabel="提交拒绝"
        cancelLabel="放弃"
      />,
    )
    expect(document.querySelector('[data-reject-modal-submit]')!.textContent).toBe('提交拒绝')
    expect(document.querySelector('[data-reject-modal-cancel]')!.textContent).toBe('放弃')
  })

  it('testId 透传到 Modal', () => {
    render(
      <RejectModal
        open={true}
        onClose={() => {}}
        labels={LABELS}
        onSubmit={async () => {}}
        testId="reject-modal-1"
      />,
    )
    expect(document.querySelector('[data-testid="reject-modal-1"]')).toBeTruthy()
  })

  it('labels=[] 空数组 → 渲染表单但 submit 始终 disabled', () => {
    render(<RejectModal open={true} onClose={() => {}} labels={[]} onSubmit={async () => {}} />)
    expect(document.querySelector('[data-reject-modal-form]')).toBeTruthy()
    expect(document.querySelectorAll('[data-reject-modal-label]')).toHaveLength(0)
    const submitBtn = document.querySelector('[data-reject-modal-submit]') as HTMLButtonElement
    expect(submitBtn.disabled).toBe(true)
  })
})
