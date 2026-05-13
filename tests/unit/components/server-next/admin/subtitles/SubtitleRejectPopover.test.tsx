/**
 * SubtitleRejectPopover 集成测试（CHG-SN-5-02）
 *
 * 覆盖：
 * - Popover trigger 点击展开（admin-ui Popover 真实消费）
 * - AdminInput 受控输入（admin-ui AdminInput 真实消费）
 * - 模板 chip 点击 → AdminInput 填入模板文本
 * - 确认按钮回调 onConfirm(reason)（AdminButton danger variant 真实消费）
 * - 空 reason 回调传 undefined（trim 后判空）
 * - pending=true 时禁用确认（AdminButton loading prop 透传）
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { SubtitleRejectPopover } from '../../../../../../apps/server-next/src/app/admin/subtitles/_client/SubtitleRejectPopover'

beforeEach(() => {
  cleanup()
})

function setup(props?: { pending?: boolean; onConfirm?: (reason: string | undefined) => void }) {
  const onConfirm = props?.onConfirm ?? vi.fn()
  render(
    <SubtitleRejectPopover
      pending={props?.pending}
      onConfirm={onConfirm}
      trigger={<button type="button" data-testid="trigger-btn">拒绝</button>}
    />
  )
  return { onConfirm }
}

describe('SubtitleRejectPopover — 触发开关', () => {
  it('初始 popover 未展开', () => {
    setup()
    expect(screen.queryByTestId('subtitle-reject-popover')).toBeNull()
  })

  it('点击 trigger → popover 展开', () => {
    setup()
    fireEvent.click(screen.getByTestId('trigger-btn'))
    expect(screen.queryByTestId('subtitle-reject-popover')).not.toBeNull()
  })

  it('点击取消 → popover 关闭', () => {
    setup()
    fireEvent.click(screen.getByTestId('trigger-btn'))
    fireEvent.click(screen.getByTestId('subtitle-reject-cancel'))
    expect(screen.queryByTestId('subtitle-reject-popover')).toBeNull()
  })
})

describe('SubtitleRejectPopover — 模板 + 自由文本', () => {
  it('点击模板 chip → AdminInput 受控填入模板文本', () => {
    setup()
    fireEvent.click(screen.getByTestId('trigger-btn'))
    fireEvent.click(screen.getByTestId('subtitle-reject-template-字幕语言不符'))
    const input = screen.getByTestId('subtitle-reject-reason-input').querySelector('input')!
    expect(input.value).toBe('字幕语言不符')
  })

  it('AdminInput 手工输入 → 受控更新', () => {
    setup()
    fireEvent.click(screen.getByTestId('trigger-btn'))
    const input = screen.getByTestId('subtitle-reject-reason-input').querySelector('input')!
    fireEvent.change(input, { target: { value: '自定义理由' } })
    expect(input.value).toBe('自定义理由')
  })
})

describe('SubtitleRejectPopover — 确认回调', () => {
  it('确认 + 有 reason → onConfirm(reason)', () => {
    const { onConfirm } = setup()
    fireEvent.click(screen.getByTestId('trigger-btn'))
    fireEvent.change(screen.getByTestId('subtitle-reject-reason-input').querySelector('input')!, { target: { value: '格式错误或损坏' } })
    fireEvent.click(screen.getByTestId('subtitle-reject-confirm'))
    expect(onConfirm).toHaveBeenCalledWith('格式错误或损坏')
  })

  it('确认 + 空 reason → onConfirm(undefined)', () => {
    const { onConfirm } = setup()
    fireEvent.click(screen.getByTestId('trigger-btn'))
    fireEvent.click(screen.getByTestId('subtitle-reject-confirm'))
    expect(onConfirm).toHaveBeenCalledWith(undefined)
  })

  it('确认 + 空格 reason → trim 后 undefined', () => {
    const { onConfirm } = setup()
    fireEvent.click(screen.getByTestId('trigger-btn'))
    fireEvent.change(screen.getByTestId('subtitle-reject-reason-input').querySelector('input')!, { target: { value: '   ' } })
    fireEvent.click(screen.getByTestId('subtitle-reject-confirm'))
    expect(onConfirm).toHaveBeenCalledWith(undefined)
  })

  it('确认后 popover 自动关闭', () => {
    setup()
    fireEvent.click(screen.getByTestId('trigger-btn'))
    fireEvent.click(screen.getByTestId('subtitle-reject-confirm'))
    expect(screen.queryByTestId('subtitle-reject-popover')).toBeNull()
  })

  it('pending=true 时点击确认不触发回调（loading 防重）', () => {
    const { onConfirm } = setup({ pending: true })
    fireEvent.click(screen.getByTestId('trigger-btn'))
    fireEvent.click(screen.getByTestId('subtitle-reject-confirm'))
    expect(onConfirm).not.toHaveBeenCalled()
  })
})
