/**
 * StaffNoteBar 单测（CHG-SN-4-04 D-14 第 4 件）
 *
 * 覆盖契约硬约束：
 *   - note 空（null/undefined/空串）+ 非编辑态 → return null
 *   - display 态 / edit 态切换（受控 editing prop）
 *   - 编辑入口 onEdit 信号
 *   - onSubmit(null) 清空语义
 *   - onCancelEdit 取消（不传 → disable）
 *   - submitting 受控
 *   - 文案 slot 默认 + 自定义
 *   - data-* + testId 钩子
 *   - amber token 引用（var(--state-warning-*)）
 *   - forwardRef 转发
 */
import { afterEach, describe, it, expect, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import React from 'react'
import { StaffNoteBar } from '../../../../../packages/admin-ui/src/components/feedback/staff-note-bar'

afterEach(() => cleanup())

describe('StaffNoteBar — return null 契约', () => {
  it('note=null + 非编辑态 → 不渲染任何 DOM', () => {
    const { container } = render(<StaffNoteBar note={null} />)
    expect(container.firstChild).toBeNull()
  })

  it('note=undefined + 非编辑态 → 不渲染', () => {
    const { container } = render(<StaffNoteBar note={undefined} />)
    expect(container.firstChild).toBeNull()
  })

  it('note="" 空串 + 非编辑态 → 不渲染', () => {
    const { container } = render(<StaffNoteBar note="" />)
    expect(container.firstChild).toBeNull()
  })

  it('note="  " 全空白 + 非编辑态 → 不渲染（trimmed 后为空）', () => {
    const { container } = render(<StaffNoteBar note="   " />)
    expect(container.firstChild).toBeNull()
  })

  it('note=空 + editing=true 但缺 onEdit/onSubmit → 不渲染（不满足 isEditMode）', () => {
    const { container } = render(<StaffNoteBar note="" editing={true} />)
    expect(container.firstChild).toBeNull()
  })
})

describe('StaffNoteBar — display 态', () => {
  it('note 非空 → 渲染 data-staff-note-mode="display"', () => {
    const { container } = render(<StaffNoteBar note="封面有水印" />)
    const root = container.querySelector('[data-staff-note-bar]')
    expect(root?.getAttribute('data-staff-note-mode')).toBe('display')
    expect(root?.getAttribute('role')).toBe('note')
  })

  it('note 文本渲染', () => {
    render(<StaffNoteBar note="封面有水印，先 hold" />)
    expect(screen.getByText('封面有水印，先 hold')).toBeTruthy()
  })

  it('readonly 模式（onEdit 不传）→ 无编辑入口', () => {
    const { container } = render(<StaffNoteBar note="abc" />)
    expect(container.querySelector('[data-staff-note-edit-trigger]')).toBeNull()
  })

  it('onEdit 已传 → 渲染编辑入口按钮 + 默认文案"编辑"', () => {
    const handler = vi.fn()
    const { container } = render(<StaffNoteBar note="abc" onEdit={handler} />)
    const trigger = container.querySelector('[data-staff-note-edit-trigger]') as HTMLButtonElement
    expect(trigger).toBeTruthy()
    expect(trigger.textContent).toBe('编辑')
  })

  it('点击编辑入口触发 onEdit 回调', () => {
    const handler = vi.fn()
    const { container } = render(<StaffNoteBar note="abc" onEdit={handler} />)
    const trigger = container.querySelector('[data-staff-note-edit-trigger]') as HTMLButtonElement
    fireEvent.click(trigger)
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('自定义 editLabel 覆盖默认', () => {
    const { container } = render(
      <StaffNoteBar note="abc" onEdit={() => {}} editLabel="改备注" />,
    )
    const trigger = container.querySelector('[data-staff-note-edit-trigger]')!
    expect(trigger.textContent).toBe('改备注')
  })
})

describe('StaffNoteBar — edit 态', () => {
  it('editing=true + onEdit + onSubmit → 渲染 data-staff-note-mode="edit"', () => {
    const { container } = render(
      <StaffNoteBar
        note="abc"
        editing={true}
        onEdit={() => {}}
        onSubmit={async () => {}}
      />,
    )
    const root = container.querySelector('[data-staff-note-bar]')
    expect(root?.getAttribute('data-staff-note-mode')).toBe('edit')
    expect(container.querySelector('[data-staff-note-textarea]')).toBeTruthy()
    expect(container.querySelector('[data-staff-note-submit]')).toBeTruthy()
    expect(container.querySelector('[data-staff-note-cancel]')).toBeTruthy()
  })

  it('textarea 初始值 = note', () => {
    const { container } = render(
      <StaffNoteBar
        note="初始内容"
        editing={true}
        onEdit={() => {}}
        onSubmit={async () => {}}
      />,
    )
    const textarea = container.querySelector('[data-staff-note-textarea]') as HTMLTextAreaElement
    expect(textarea.value).toBe('初始内容')
  })

  it('点击保存 → onSubmit 收到 trimmed 文本', async () => {
    const submit = vi.fn().mockResolvedValue(undefined)
    const { container } = render(
      <StaffNoteBar
        note="原文"
        editing={true}
        onEdit={() => {}}
        onSubmit={submit}
      />,
    )
    const textarea = container.querySelector('[data-staff-note-textarea]') as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: '  新内容  ' } })
    const submitBtn = container.querySelector('[data-staff-note-submit]') as HTMLButtonElement
    fireEvent.click(submitBtn)
    expect(submit).toHaveBeenCalledWith('新内容')
  })

  it('保存空文本 → onSubmit(null)（清空语义）', async () => {
    const submit = vi.fn().mockResolvedValue(undefined)
    const { container } = render(
      <StaffNoteBar
        note="原文"
        editing={true}
        onEdit={() => {}}
        onSubmit={submit}
      />,
    )
    const textarea = container.querySelector('[data-staff-note-textarea]') as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: '   ' } })
    const submitBtn = container.querySelector('[data-staff-note-submit]') as HTMLButtonElement
    fireEvent.click(submitBtn)
    expect(submit).toHaveBeenCalledWith(null)
  })

  it('点击取消触发 onCancelEdit', () => {
    const cancel = vi.fn()
    const { container } = render(
      <StaffNoteBar
        note="原文"
        editing={true}
        onEdit={() => {}}
        onSubmit={async () => {}}
        onCancelEdit={cancel}
      />,
    )
    const cancelBtn = container.querySelector('[data-staff-note-cancel]') as HTMLButtonElement
    fireEvent.click(cancelBtn)
    expect(cancel).toHaveBeenCalledTimes(1)
  })

  it('onCancelEdit 不传 → 取消按钮 disabled', () => {
    const { container } = render(
      <StaffNoteBar
        note="原文"
        editing={true}
        onEdit={() => {}}
        onSubmit={async () => {}}
      />,
    )
    const cancelBtn = container.querySelector('[data-staff-note-cancel]') as HTMLButtonElement
    expect(cancelBtn.disabled).toBe(true)
  })

  it('submitting=true → 保存按钮 + 取消按钮 disabled', () => {
    const { container } = render(
      <StaffNoteBar
        note="原文"
        editing={true}
        onEdit={() => {}}
        onSubmit={async () => {}}
        onCancelEdit={() => {}}
        submitting={true}
      />,
    )
    const submitBtn = container.querySelector('[data-staff-note-submit]') as HTMLButtonElement
    const cancelBtn = container.querySelector('[data-staff-note-cancel]') as HTMLButtonElement
    expect(submitBtn.disabled).toBe(true)
    expect(cancelBtn.disabled).toBe(true)
  })

  it('noteMaxLength → textarea maxLength + 字数计数显示 N/Max', () => {
    const { container } = render(
      <StaffNoteBar
        note="abc"
        editing={true}
        onEdit={() => {}}
        onSubmit={async () => {}}
        noteMaxLength={500}
      />,
    )
    const textarea = container.querySelector('[data-staff-note-textarea]') as HTMLTextAreaElement
    expect(textarea.maxLength).toBe(500)
    const counter = container.querySelector('[data-staff-note-charcount]')!
    expect(counter.textContent).toBe('3 / 500')
  })

  it('无 noteMaxLength → 仅显示当前字数', () => {
    const { container } = render(
      <StaffNoteBar
        note="abc"
        editing={true}
        onEdit={() => {}}
        onSubmit={async () => {}}
      />,
    )
    const counter = container.querySelector('[data-staff-note-charcount]')!
    expect(counter.textContent).toBe('3')
  })

  it('自定义 saveLabel / cancelLabel 覆盖默认', () => {
    const { container } = render(
      <StaffNoteBar
        note="abc"
        editing={true}
        onEdit={() => {}}
        onSubmit={async () => {}}
        onCancelEdit={() => {}}
        saveLabel="提交备注"
        cancelLabel="放弃"
      />,
    )
    expect(container.querySelector('[data-staff-note-submit]')!.textContent).toBe('提交备注')
    expect(container.querySelector('[data-staff-note-cancel]')!.textContent).toBe('放弃')
  })

  it('emptyHint 注入 textarea placeholder', () => {
    const { container } = render(
      <StaffNoteBar
        note=""
        editing={true}
        onEdit={() => {}}
        onSubmit={async () => {}}
        emptyHint="请输入审核备注…"
      />,
    )
    const textarea = container.querySelector('[data-staff-note-textarea]') as HTMLTextAreaElement
    expect(textarea.placeholder).toBe('请输入审核备注…')
  })
})

describe('StaffNoteBar — token & forwardRef & testId', () => {
  it('未硬编码颜色：根 style 走 var(--state-warning-*)', () => {
    const { container } = render(<StaffNoteBar note="abc" />)
    const root = container.querySelector('[data-staff-note-bar]') as HTMLElement
    const style = root.getAttribute('style') ?? ''
    expect(style).toMatch(/var\(--state-warning-bg\)/)
    expect(style).toMatch(/var\(--state-warning-fg\)/)
    expect(style).toMatch(/var\(--state-warning-border\)/)
  })

  it('forwardRef 转发到根 div（display 态）', () => {
    const ref = React.createRef<HTMLDivElement>()
    render(<StaffNoteBar note="abc" ref={ref} />)
    expect(ref.current).toBeInstanceOf(HTMLDivElement)
    expect(ref.current?.getAttribute('data-staff-note-bar')).toBeTruthy()
  })

  it('testId 渲染为 data-testid（display 态）', () => {
    const { container } = render(
      <StaffNoteBar note="abc" testId="staff-note-1" />,
    )
    expect(container.querySelector('[data-testid="staff-note-1"]')).toBeTruthy()
  })

  it('testId 渲染为 data-testid（edit 态）', () => {
    const { container } = render(
      <StaffNoteBar
        note="abc"
        editing={true}
        onEdit={() => {}}
        onSubmit={async () => {}}
        testId="staff-note-edit"
      />,
    )
    const node = container.querySelector('[data-testid="staff-note-edit"]')
    expect(node).toBeTruthy()
    expect(node?.getAttribute('data-staff-note-mode')).toBe('edit')
  })
})
