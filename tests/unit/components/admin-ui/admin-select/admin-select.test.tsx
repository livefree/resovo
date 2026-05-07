/**
 * AdminSelect 单测（CHG-SN-5-PRE-03-D / SEQ-20260506-02）
 * 覆盖：单选 / 多选 / 搜索（client-side filter + server onSearch）/ 异步 loading / 键盘导航
 *      / 受控值 / placeholder / size / error / disabled / a11y combobox+listbox / chip 移除
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, fireEvent, screen, cleanup } from '@testing-library/react'
import React from 'react'
import { AdminSelect, type AdminSelectOption } from '../../../../../packages/admin-ui/src/components/admin-select/admin-select'

const OPTIONS: AdminSelectOption[] = [
  { value: 'movie', label: '电影' },
  { value: 'tv', label: '剧集' },
  { value: 'anime', label: '动漫' },
  { value: 'doc', label: '纪录片', disabled: true },
]

beforeEach(() => {
  // listbox 走 portal → document.body；测试结束清理
})
afterEach(() => cleanup())

// ── 单选基础 ─────────────────────────────────────────────────────

describe('AdminSelect — 单选基础', () => {
  it('placeholder 默认 "请选择" + 未选时显示', () => {
    render(<AdminSelect options={OPTIONS} value={null} onChange={() => {}} />)
    expect(screen.getByRole('combobox').textContent).toContain('请选择')
  })

  it('value 受控显示对应 label', () => {
    render(<AdminSelect options={OPTIONS} value="tv" onChange={() => {}} />)
    expect(screen.getByRole('combobox').textContent).toContain('剧集')
  })

  it('点击 trigger 打开 listbox（aria-expanded=true）', () => {
    render(<AdminSelect options={OPTIONS} value={null} onChange={() => {}} />)
    const trigger = screen.getByRole('combobox')
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(trigger)
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByRole('listbox')).toBeTruthy()
  })

  it('点击 option onMouseDown commit 单选 + 关闭 listbox', () => {
    const onChange = vi.fn()
    render(<AdminSelect options={OPTIONS} value={null} onChange={onChange} />)
    fireEvent.click(screen.getByRole('combobox'))
    const opts = screen.getAllByRole('option')
    fireEvent.mouseDown(opts[1])  // 'tv'
    expect(onChange).toHaveBeenCalledWith('tv')
  })

  it('点击当前已选 option → 切换为 null（取消选择）', () => {
    const onChange = vi.fn()
    render(<AdminSelect options={OPTIONS} value="movie" onChange={onChange} />)
    fireEvent.click(screen.getByRole('combobox'))
    const movieOpt = screen.getAllByRole('option').find((o) => o.getAttribute('data-value') === 'movie')!
    fireEvent.mouseDown(movieOpt)
    expect(onChange).toHaveBeenCalledWith(null)
  })

  it('disabled option 不触发 onChange', () => {
    const onChange = vi.fn()
    render(<AdminSelect options={OPTIONS} value={null} onChange={onChange} />)
    fireEvent.click(screen.getByRole('combobox'))
    const docOpt = screen.getAllByRole('option').find((o) => o.getAttribute('data-value') === 'doc')!
    fireEvent.mouseDown(docOpt)
    expect(onChange).not.toHaveBeenCalled()
  })
})

// ── 多选 ─────────────────────────────────────────────────────────

describe('AdminSelect — 多选', () => {
  it('multiple=true + 空 value 显示 placeholder', () => {
    render(<AdminSelect multiple options={OPTIONS} value={[]} onChange={() => {}} />)
    expect(screen.getByRole('combobox').textContent).toContain('请选择')
  })

  it('multiple=true 渲染 chip 列表', () => {
    render(<AdminSelect multiple options={OPTIONS} value={['movie', 'tv']} onChange={() => {}} />)
    const chips = screen.getByRole('combobox').querySelectorAll('[data-admin-select-chip]')
    expect(chips.length).toBe(2)
  })

  it('多选 commit → toggle add', () => {
    const onChange = vi.fn()
    render(<AdminSelect multiple options={OPTIONS} value={['movie']} onChange={onChange} />)
    fireEvent.click(screen.getByRole('combobox'))
    const tvOpt = screen.getAllByRole('option').find((o) => o.getAttribute('data-value') === 'tv')!
    fireEvent.mouseDown(tvOpt)
    expect(onChange).toHaveBeenCalledWith(['movie', 'tv'])
  })

  it('多选 commit 已选 → toggle remove', () => {
    const onChange = vi.fn()
    render(<AdminSelect multiple options={OPTIONS} value={['movie', 'tv']} onChange={onChange} />)
    fireEvent.click(screen.getByRole('combobox'))
    const movieOpt = screen.getAllByRole('option').find((o) => o.getAttribute('data-value') === 'movie')!
    fireEvent.mouseDown(movieOpt)
    expect(onChange).toHaveBeenCalledWith(['tv'])
  })

  it('多选 listbox aria-multiselectable=true', () => {
    render(<AdminSelect multiple options={OPTIONS} value={[]} onChange={() => {}} />)
    fireEvent.click(screen.getByRole('combobox'))
    expect(screen.getByRole('listbox').getAttribute('aria-multiselectable')).toBe('true')
  })

  it('多选 chip × 移除单个', () => {
    const onChange = vi.fn()
    render(<AdminSelect multiple options={OPTIONS} value={['movie', 'tv']} onChange={onChange} />)
    const removeBtn = screen.getByRole('combobox').querySelectorAll('[role="button"][aria-label^="移除"]')[0] as HTMLElement
    fireEvent.click(removeBtn)
    expect(onChange).toHaveBeenCalledWith(['tv'])
  })
})

// ── 搜索 ─────────────────────────────────────────────────────────

describe('AdminSelect — 搜索', () => {
  it('searchable=true 打开后渲染 search input + 自动聚焦', () => {
    render(<AdminSelect searchable options={OPTIONS} value={null} onChange={() => {}} />)
    fireEvent.click(screen.getByRole('combobox'))
    const search = screen.getByPlaceholderText('搜索...') as HTMLInputElement
    expect(search).toBeTruthy()
    expect(document.activeElement).toBe(search)
  })

  it('client-side 过滤（无 onSearch）→ 输入 "剧" 仅显示剧集', () => {
    render(<AdminSelect searchable options={OPTIONS} value={null} onChange={() => {}} />)
    fireEvent.click(screen.getByRole('combobox'))
    const search = screen.getByPlaceholderText('搜索...') as HTMLInputElement
    fireEvent.change(search, { target: { value: '剧' } })
    const opts = screen.getAllByRole('option')
    expect(opts.length).toBe(1)
    expect(opts[0].getAttribute('data-value')).toBe('tv')
  })

  it('server-side onSearch 模式 → 不本地过滤，调用 onSearch', () => {
    const onSearch = vi.fn()
    render(<AdminSelect searchable onSearch={onSearch} options={OPTIONS} value={null} onChange={() => {}} />)
    fireEvent.click(screen.getByRole('combobox'))
    fireEvent.change(screen.getByPlaceholderText('搜索...'), { target: { value: 'q' } })
    expect(onSearch).toHaveBeenCalledWith('q')
    // server 模式不本地过滤，仍显示全部 options
    expect(screen.getAllByRole('option').length).toBe(OPTIONS.length)
  })

  it('搜索无匹配 → 渲染 data-admin-select-empty', () => {
    render(<AdminSelect searchable options={OPTIONS} value={null} onChange={() => {}} />)
    fireEvent.click(screen.getByRole('combobox'))
    fireEvent.change(screen.getByPlaceholderText('搜索...'), { target: { value: 'zzz' } })
    expect(screen.getByText('无匹配项')).toBeTruthy()
  })
})

// ── 异步 loading ─────────────────────────────────────────────────

describe('AdminSelect — 异步 loading', () => {
  it('loading=true 渲染加载占位 + 不渲染 options', () => {
    render(<AdminSelect loading options={OPTIONS} value={null} onChange={() => {}} />)
    fireEvent.click(screen.getByRole('combobox'))
    expect(screen.getByText('加载中...')).toBeTruthy()
    expect(screen.queryAllByRole('option').length).toBe(0)
  })
})

// ── 键盘导航 ─────────────────────────────────────────────────────

describe('AdminSelect — 键盘导航', () => {
  it('未打开时 ArrowDown 打开 listbox', () => {
    render(<AdminSelect options={OPTIONS} value={null} onChange={() => {}} />)
    const trigger = screen.getByRole('combobox')
    fireEvent.keyDown(trigger, { key: 'ArrowDown' })
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
  })

  it('Enter 选中 active option', () => {
    const onChange = vi.fn()
    render(<AdminSelect options={OPTIONS} value={null} onChange={onChange} />)
    const trigger = screen.getByRole('combobox')
    fireEvent.keyDown(trigger, { key: 'ArrowDown' })  // open + activeIndex=0
    fireEvent.keyDown(trigger, { key: 'ArrowDown' })  // activeIndex=1
    fireEvent.keyDown(trigger, { key: 'Enter' })       // commit options[1] = 'tv'
    expect(onChange).toHaveBeenCalledWith('tv')
  })

  it('Escape 关闭 listbox + 清空 query', () => {
    render(<AdminSelect options={OPTIONS} value={null} onChange={() => {}} />)
    const trigger = screen.getByRole('combobox')
    fireEvent.click(trigger)
    fireEvent.keyDown(trigger, { key: 'Escape' })
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
  })

  it('ArrowDown 越界停在最后一项', () => {
    render(<AdminSelect options={OPTIONS} value={null} onChange={() => {}} />)
    const trigger = screen.getByRole('combobox')
    fireEvent.keyDown(trigger, { key: 'ArrowDown' })
    fireEvent.keyDown(trigger, { key: 'ArrowDown' })
    fireEvent.keyDown(trigger, { key: 'ArrowDown' })
    fireEvent.keyDown(trigger, { key: 'ArrowDown' })
    fireEvent.keyDown(trigger, { key: 'ArrowDown' })  // 越界
    const opts = screen.getAllByRole('option')
    expect(opts[opts.length - 1].getAttribute('data-active')).toBe('')
  })

  // arch-reviewer 建议补充：Space / Tab / disabled-skip
  it('Space 也打开 listbox', () => {
    render(<AdminSelect options={OPTIONS} value={null} onChange={() => {}} />)
    const trigger = screen.getByRole('combobox')
    fireEvent.keyDown(trigger, { key: ' ' })
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
  })

  it('Tab 关闭 listbox', () => {
    render(<AdminSelect options={OPTIONS} value={null} onChange={() => {}} />)
    const trigger = screen.getByRole('combobox')
    fireEvent.click(trigger)
    fireEvent.keyDown(trigger, { key: 'Tab' })
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
  })

  it('Enter 在 disabled option active 时不 commit', () => {
    const onChange = vi.fn()
    render(<AdminSelect options={OPTIONS} value={null} onChange={onChange} />)
    const trigger = screen.getByRole('combobox')
    fireEvent.keyDown(trigger, { key: 'ArrowDown' })  // open + 0
    fireEvent.keyDown(trigger, { key: 'ArrowDown' })  // 1
    fireEvent.keyDown(trigger, { key: 'ArrowDown' })  // 2
    fireEvent.keyDown(trigger, { key: 'ArrowDown' })  // 3 = disabled 'doc'
    fireEvent.keyDown(trigger, { key: 'Enter' })
    expect(onChange).not.toHaveBeenCalled()
  })
})

// ── a11y combobox aria-activedescendant ───────────────────────────

describe('AdminSelect — a11y combobox aria-activedescendant', () => {
  it('打开后 active option 有 id + trigger aria-activedescendant 指向该 id', () => {
    render(<AdminSelect options={OPTIONS} value={null} onChange={() => {}} />)
    const trigger = screen.getByRole('combobox')
    fireEvent.keyDown(trigger, { key: 'ArrowDown' })  // open + activeIndex=0
    const activeOpt = screen.getAllByRole('option')[0]
    const id = activeOpt.getAttribute('id')
    expect(id).toMatch(/^as-/)
    expect(trigger.getAttribute('aria-activedescendant')).toBe(id)
  })

  it('打开后 aria-controls 指向 listbox id', () => {
    render(<AdminSelect options={OPTIONS} value={null} onChange={() => {}} />)
    const trigger = screen.getByRole('combobox')
    fireEvent.click(trigger)
    const listbox = screen.getByRole('listbox')
    expect(trigger.getAttribute('aria-controls')).toBe(listbox.id)
  })
})

// ── size / error / disabled / a11y ───────────────────────────────

describe('AdminSelect — size / error / disabled / a11y', () => {
  it('默认 size=md → 28px 高', () => {
    render(<AdminSelect options={OPTIONS} value={null} onChange={() => {}} />)
    const trigger = screen.getByRole('combobox')
    expect(trigger.getAttribute('data-size')).toBe('md')
    expect((trigger as HTMLElement).style.height).toBe('28px')
  })

  it('size=lg → 32px', () => {
    render(<AdminSelect size="lg" options={OPTIONS} value={null} onChange={() => {}} />)
    expect((screen.getByRole('combobox') as HTMLElement).style.height).toBe('32px')
  })

  it('error=true → aria-invalid + danger border', () => {
    render(<AdminSelect error options={OPTIONS} value={null} onChange={() => {}} />)
    const trigger = screen.getByRole('combobox') as HTMLElement
    expect(trigger.getAttribute('aria-invalid')).toBe('true')
    expect(trigger.style.borderColor).toContain('var(--border-danger')
  })

  it('disabled=true → 不响应 click', () => {
    const onChange = vi.fn()
    render(<AdminSelect disabled options={OPTIONS} value={null} onChange={onChange} />)
    const trigger = screen.getByRole('combobox')
    fireEvent.click(trigger)
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
  })

  it('aria-label / data-testid 透传', () => {
    render(
      <AdminSelect aria-label="选择类型" data-testid="as-type" options={OPTIONS} value={null} onChange={() => {}} />,
    )
    const trigger = screen.getByTestId('as-type')
    expect(trigger.getAttribute('aria-label')).toBe('选择类型')
    expect(trigger.getAttribute('role')).toBe('combobox')
    expect(trigger.getAttribute('aria-haspopup')).toBe('listbox')
  })
})
