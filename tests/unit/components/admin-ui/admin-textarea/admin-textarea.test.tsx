/**
 * admin-textarea.test.tsx — AdminTextarea 单测（CHG-SN-6-09 / arch-reviewer Opus PASS）
 *
 * 覆盖契约：
 *   - size sm/md/lg 字号档 + padding
 *   - error 态 border-danger + aria-invalid
 *   - resize 'vertical' 默认 + 自定义
 *   - monospace fontFamily 切 var(--font-mono)
 *   - focus 态 borderColor 切 var(--border-strong)
 *   - rows 默认 4 + 自定义透传
 *   - disabled opacity + cursor
 *   - data-testid 透传到 textarea
 */
import { afterEach, describe, it, expect } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { AdminTextarea } from '../../../../../packages/admin-ui/src/components/admin-textarea/admin-textarea'

afterEach(() => cleanup())

describe('AdminTextarea — 基础渲染', () => {
  it('1. 渲染 textarea + wrapper 包裹', () => {
    const { container } = render(<AdminTextarea data-testid="ta-1" />)
    const ta = container.querySelector('[data-testid="ta-1"]') as HTMLTextAreaElement
    expect(ta).not.toBeNull()
    expect(ta.tagName.toLowerCase()).toBe('textarea')
    expect(container.querySelector('div[data-admin-textarea]')).not.toBeNull()
  })

  it('2. rows 默认 4', () => {
    const { container } = render(<AdminTextarea />)
    const ta = container.querySelector('textarea') as HTMLTextAreaElement
    expect(ta.rows).toBe(4)
  })

  it('3. rows 自定义透传', () => {
    const { container } = render(<AdminTextarea rows={12} />)
    expect((container.querySelector('textarea') as HTMLTextAreaElement).rows).toBe(12)
  })
})

describe('AdminTextarea — size 变体', () => {
  it('4. size="sm" → fontSize var(--font-size-xs) + padding 4px 8px', () => {
    const { container } = render(<AdminTextarea size="sm" />)
    const wrapper = container.querySelector('[data-admin-textarea]') as HTMLElement
    expect(wrapper.style.fontSize).toContain('--font-size-xs')
    expect(wrapper.style.padding).toBe('4px 8px')
    expect(wrapper.dataset.size).toBe('sm')
  })

  it('5. size="lg" → fontSize var(--font-size-sm) + padding 8px 12px', () => {
    const { container } = render(<AdminTextarea size="lg" />)
    const wrapper = container.querySelector('[data-admin-textarea]') as HTMLElement
    expect(wrapper.style.fontSize).toContain('--font-size-sm')
    expect(wrapper.style.padding).toBe('8px 12px')
  })
})

describe('AdminTextarea — error 态', () => {
  it('6. error=true → borderColor danger + aria-invalid', () => {
    const { container } = render(<AdminTextarea error />)
    const wrapper = container.querySelector('[data-admin-textarea]') as HTMLElement
    const ta = container.querySelector('textarea') as HTMLTextAreaElement
    expect(wrapper.style.borderColor).toContain('--border-danger')
    expect(ta.getAttribute('aria-invalid')).toBe('true')
    expect(wrapper.dataset.error).toBe('')
  })

  it('7. error=false（默认）→ borderColor default', () => {
    const { container } = render(<AdminTextarea />)
    const wrapper = container.querySelector('[data-admin-textarea]') as HTMLElement
    expect(wrapper.style.borderColor).toContain('--border-default')
  })
})

describe('AdminTextarea — resize', () => {
  it('8. resize 默认 vertical', () => {
    const { container } = render(<AdminTextarea />)
    const ta = container.querySelector('textarea') as HTMLTextAreaElement
    expect(ta.style.resize).toBe('vertical')
  })

  it('9. resize="none" 自定义', () => {
    const { container } = render(<AdminTextarea resize="none" />)
    const ta = container.querySelector('textarea') as HTMLTextAreaElement
    expect(ta.style.resize).toBe('none')
  })
})

describe('AdminTextarea — monospace', () => {
  it('10. monospace=true → fontFamily var(--font-mono)', () => {
    const { container } = render(<AdminTextarea monospace />)
    const ta = container.querySelector('textarea') as HTMLTextAreaElement
    const wrapper = container.querySelector('[data-admin-textarea]') as HTMLElement
    expect(ta.style.fontFamily).toContain('--font-mono')
    expect(wrapper.dataset.monospace).toBe('')
  })

  it('11. monospace=false → fontFamily inherit', () => {
    const { container } = render(<AdminTextarea />)
    const ta = container.querySelector('textarea') as HTMLTextAreaElement
    expect(ta.style.fontFamily).toBe('inherit')
  })
})

describe('AdminTextarea — focus 态', () => {
  it('12. focus 后 borderColor 切 strong + box-shadow', () => {
    const { container } = render(<AdminTextarea />)
    const ta = container.querySelector('textarea') as HTMLTextAreaElement
    fireEvent.focus(ta)
    const wrapper = container.querySelector('[data-admin-textarea]') as HTMLElement
    expect(wrapper.style.borderColor).toContain('--border-strong')
    expect(wrapper.style.boxShadow).toContain('--accent-soft')
    fireEvent.blur(ta)
    expect(wrapper.style.borderColor).toContain('--border-default')
  })
})

describe('AdminTextarea — disabled', () => {
  it('13. disabled → textarea.disabled + wrapper opacity 0.5', () => {
    const { container } = render(<AdminTextarea disabled />)
    const ta = container.querySelector('textarea') as HTMLTextAreaElement
    const wrapper = container.querySelector('[data-admin-textarea]') as HTMLElement
    expect(ta.disabled).toBe(true)
    expect(wrapper.style.opacity).toBe('0.5')
    expect(wrapper.style.cursor).toBe('not-allowed')
  })
})

describe('AdminTextarea — onChange 透传', () => {
  it('14. onChange 触发 + value 透传', () => {
    let captured = ''
    const { container } = render(
      <AdminTextarea value="abc" onChange={(e) => { captured = e.target.value }} />,
    )
    const ta = container.querySelector('textarea') as HTMLTextAreaElement
    expect(ta.value).toBe('abc')
    fireEvent.change(ta, { target: { value: 'new' } })
    expect(captured).toBe('new')
  })
})
