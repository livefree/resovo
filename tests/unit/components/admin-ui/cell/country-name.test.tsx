/**
 * country-name.test.tsx — CountryName React 组件（CHG-366 / plan §10.4.3）
 */
import { afterEach, describe, it, expect } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import React from 'react'
import { CountryName } from '../../../../../packages/admin-ui/src/components/cell/country-name'

afterEach(() => cleanup())

describe('CountryName', () => {
  it('合法 ISO code → 渲染本地化名称 + data-country-code 挂载', () => {
    const { container } = render(<CountryName code="US" />)
    const el = container.querySelector('[data-testid="country-name"]') as HTMLElement
    expect(el).toBeTruthy()
    expect(el.textContent).toBe('美国')
    expect(el.getAttribute('data-country-code')).toBe('US')
    // 显示与原 code 不同时挂 title 提示原 ISO（运营对账用）
    expect(el.getAttribute('title')).toBe('US')
  })

  it('locale=en → 英文显示', () => {
    const { container } = render(<CountryName code="CN" locale="en" />)
    const el = container.querySelector('[data-testid="country-name"]')!
    expect(el.textContent).toBe('China')
  })

  it('null/无效 code → fallback "—" / 不挂 title', () => {
    const { container } = render(<CountryName code={null} />)
    const el = container.querySelector('[data-testid="country-name"]') as HTMLElement
    expect(el.textContent).toBe('—')
    expect(el.getAttribute('title')).toBeNull()
  })
})
