/**
 * route-theme-selector.test.tsx — RouteThemeSelector 组件（CHG-369 / plan §17.2 #16）
 */
// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from 'vitest'
import { cleanup, render, fireEvent } from '@testing-library/react'
import React from 'react'
import { RouteThemeSelector } from '@/components/player/RouteThemeSelector'
import { ALL_THEMES, THEME_JIE_QI, THEME_NATO } from '@/lib/line-display-name'

afterEach(() => cleanup())

describe('RouteThemeSelector', () => {
  it('渲染 ALL_THEMES 5 个选项 + 自定义 option + 当前主题默认选中', () => {
    const { container, getByTestId } = render(
      <RouteThemeSelector
        currentTheme={THEME_NATO}
        customTheme={null}
        onThemeChange={() => {}}
        onOpenCustomDialog={() => {}}
      />
    )
    const select = getByTestId('route-theme-select') as HTMLSelectElement
    expect(select.value).toBe(THEME_NATO.id)
    // CHG-369-B：5 内置主题 + 末尾「自定义」option = ALL_THEMES.length + 1
    expect(container.querySelectorAll('option')).toHaveLength(ALL_THEMES.length + 1)
  })

  it('切换选项 → onThemeChange 收到匹配的 RouteTheme 实例', () => {
    const onChange = vi.fn()
    const { getByTestId } = render(
      <RouteThemeSelector
        currentTheme={THEME_JIE_QI}
        customTheme={null}
        onThemeChange={onChange}
        onOpenCustomDialog={() => {}}
      />
    )
    const select = getByTestId('route-theme-select') as HTMLSelectElement
    fireEvent.change(select, { target: { value: THEME_NATO.id } })
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith(THEME_NATO)
  })

  it('切换到非法 id（理论不可能出现 / 防御性测试）→ onThemeChange 不触发', () => {
    const onChange = vi.fn()
    const { getByTestId } = render(
      <RouteThemeSelector
        currentTheme={THEME_JIE_QI}
        customTheme={null}
        onThemeChange={onChange}
        onOpenCustomDialog={() => {}}
      />
    )
    const select = getByTestId('route-theme-select') as HTMLSelectElement
    // 直接派发非法 value（绕过浏览器 <option> 约束）
    fireEvent.change(select, { target: { value: 'not_a_real_id' } })
    expect(onChange).not.toHaveBeenCalled()
  })
})
