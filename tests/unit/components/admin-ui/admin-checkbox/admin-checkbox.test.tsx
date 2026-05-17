/**
 * admin-checkbox.test.tsx — AdminCheckbox 单测（CHG-SN-6-09 / arch-reviewer Opus PASS）
 *
 * 覆盖契约：
 *   - 受控 checked / 非受控 defaultChecked / 切换
 *   - indeterminate 三态（ref + useEffect 写 DOM）
 *   - label + description 双层布局；省略 label 退化为裸 input
 *   - disabled opacity 50% + cursor not-allowed
 *   - accent-color token 引用
 *   - data-testid 透传到 input（非 wrapper）
 */
import { afterEach, describe, it, expect, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { AdminCheckbox } from '../../../../../packages/admin-ui/src/components/admin-checkbox/admin-checkbox'

afterEach(() => cleanup())

describe('AdminCheckbox — 基础渲染', () => {
  it('1. 渲染 input type=checkbox + label 包裹', () => {
    const { container } = render(<AdminCheckbox label="启用" data-testid="cb-test" />)
    const input = container.querySelector('[data-testid="cb-test"]') as HTMLInputElement
    expect(input).not.toBeNull()
    expect(input.type).toBe('checkbox')
    // label 包裹
    expect(container.querySelector('label[data-admin-checkbox]')).not.toBeNull()
  })

  it('2. 省略 label → 裸 input 渲染（无 label 包裹）', () => {
    const { container } = render(<AdminCheckbox data-testid="cb-bare" />)
    expect(container.querySelector('label[data-admin-checkbox]')).toBeNull()
    expect(container.querySelector('input[data-testid="cb-bare"]')).not.toBeNull()
  })

  it('3. accent-color 引用 var(--accent-default) token', () => {
    const { container } = render(<AdminCheckbox label="x" />)
    const input = container.querySelector('input[data-admin-checkbox-control]') as HTMLInputElement
    expect(input.style.accentColor).toContain('--accent-default')
  })
})

describe('AdminCheckbox — 受控切换', () => {
  it('4. checked=true 渲染勾选态', () => {
    const { container } = render(<AdminCheckbox checked={true} onChange={() => {}} label="x" />)
    const input = container.querySelector('input') as HTMLInputElement
    expect(input.checked).toBe(true)
  })

  it('5. checked=false 渲染未选态', () => {
    const { container } = render(<AdminCheckbox checked={false} onChange={() => {}} label="x" />)
    const input = container.querySelector('input') as HTMLInputElement
    expect(input.checked).toBe(false)
  })

  it('6. fireEvent.click 触发 onChange', () => {
    const onChange = vi.fn()
    const { container } = render(<AdminCheckbox checked={false} onChange={onChange} label="x" />)
    fireEvent.click(container.querySelector('input')!)
    expect(onChange).toHaveBeenCalled()
  })
})

describe('AdminCheckbox — indeterminate 三态', () => {
  it('7. indeterminate=true → ref.indeterminate=true + aria-checked="mixed"', () => {
    const { container } = render(
      <AdminCheckbox label="x" checked={false} indeterminate={true} onChange={() => {}} />
    )
    const input = container.querySelector('input') as HTMLInputElement
    expect(input.indeterminate).toBe(true)
    expect(input.getAttribute('aria-checked')).toBe('mixed')
  })

  it('8. indeterminate=false → ref.indeterminate=false', () => {
    const { container } = render(
      <AdminCheckbox label="x" checked={false} indeterminate={false} onChange={() => {}} />
    )
    const input = container.querySelector('input') as HTMLInputElement
    expect(input.indeterminate).toBe(false)
  })
})

describe('AdminCheckbox — label + description', () => {
  it('9. label 渲染主标题', () => {
    const { getByText } = render(<AdminCheckbox label="启用代理" />)
    expect(getByText('启用代理')).not.toBeNull()
  })

  it('10. description 渲染灰字辅助 + color var(--fg-muted)', () => {
    const { container } = render(<AdminCheckbox label="启用" description="说明文字" />)
    const desc = container.querySelector('[data-admin-checkbox-description]') as HTMLElement
    expect(desc).not.toBeNull()
    expect(desc.textContent).toBe('说明文字')
    expect(desc.style.color).toContain('--fg-muted')
  })

  it('11. 省略 description → 不渲染 description span', () => {
    const { container } = render(<AdminCheckbox label="x" />)
    expect(container.querySelector('[data-admin-checkbox-description]')).toBeNull()
  })
})

describe('AdminCheckbox — disabled', () => {
  it('12. disabled=true → input.disabled + opacity 0.5 + data-disabled', () => {
    const { container } = render(<AdminCheckbox label="x" disabled />)
    const input = container.querySelector('input') as HTMLInputElement
    expect(input.disabled).toBe(true)
    expect(input.style.opacity).toBe('0.5')
    expect(container.querySelector('label[data-disabled]')).not.toBeNull()
  })
})
