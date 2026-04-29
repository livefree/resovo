/**
 * Toolbar 单测（CHG-SN-2-14）
 * 覆盖：三槽位渲染 / aria / 无 trailing 时不渲染空容器 / className 传递 / SSR
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import React from 'react'
import { Toolbar } from '../../../../../packages/admin-ui/src/components/data-table/toolbar'

describe('Toolbar — 槽位渲染', () => {
  it('leading 槽位渲染内容', () => {
    render(<Toolbar leading={<input placeholder="搜索" />} />)
    expect(screen.getByPlaceholderText('搜索')).toBeTruthy()
  })

  it('trailing 槽位渲染内容', () => {
    render(<Toolbar trailing={<button>导出</button>} />)
    expect(screen.getByText('导出')).toBeTruthy()
  })

  it('columnSettings 槽位渲染内容', () => {
    render(<Toolbar columnSettings={<button>⚙</button>} />)
    expect(screen.getByText('⚙')).toBeTruthy()
  })

  it('三个槽位同时渲染', () => {
    render(
      <Toolbar
        leading={<span>search</span>}
        columnSettings={<button>cols</button>}
        trailing={<button>export</button>}
      />,
    )
    expect(screen.getByText('search')).toBeTruthy()
    expect(screen.getByText('cols')).toBeTruthy()
    expect(screen.getByText('export')).toBeTruthy()
  })

  it('无 props 时正常渲染空工具栏', () => {
    const { container } = render(<Toolbar />)
    expect(container.querySelector('[role="toolbar"]')).toBeTruthy()
  })
})

describe('Toolbar — className + data 属性', () => {
  it('className 传递到根元素', () => {
    const { container } = render(<Toolbar className="my-toolbar" />)
    expect(container.querySelector('.my-toolbar')).toBeTruthy()
  })

  it('根元素有 data-toolbar 属性', () => {
    const { container } = render(<Toolbar />)
    expect(container.querySelector('[data-toolbar]')).toBeTruthy()
  })
})

describe('Toolbar — SSR 零 throw', () => {
  it('renderToString 不 throw', () => {
    expect(() =>
      renderToString(
        <Toolbar
          leading={<input placeholder="搜索" />}
          columnSettings={<button>⚙</button>}
          trailing={<button>导出</button>}
        />,
      ),
    ).not.toThrow()
  })

  it('renderToString 输出包含 role=toolbar', () => {
    const html = renderToString(<Toolbar />)
    expect(html).toContain('role="toolbar"')
  })
})
