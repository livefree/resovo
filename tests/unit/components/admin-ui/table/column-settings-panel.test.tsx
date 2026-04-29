/**
 * ColumnSettingsPanel 单测（CHG-SN-2-14）
 * 覆盖：open=false 不渲染 / 列勾选渲染 / toggle visible / pinned 不可 toggle /
 *       ESC 触发 onClose / 关闭按钮 / focus trap 结构 / SSR 零 throw
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import React, { createRef } from 'react'
import { ColumnSettingsPanel } from '../../../../../packages/admin-ui/src/components/data-table/column-settings-panel'
import type { ColumnDescriptor, ColumnPreference } from '../../../../../packages/admin-ui/src/components/data-table/types'

const COLUMNS: ColumnDescriptor[] = [
  { id: 'name', header: 'Name', defaultVisible: true },
  { id: 'status', header: 'Status', defaultVisible: true },
  { id: 'score', header: 'Score', defaultVisible: false },
  { id: 'id', header: 'ID', defaultVisible: true, pinned: true },
]

const VALUE: ReadonlyMap<string, ColumnPreference> = new Map([
  ['name', { visible: true }],
  ['status', { visible: true }],
  ['score', { visible: false }],
  ['id', { visible: true }],
])

function makeAnchorRef() {
  const ref = createRef<HTMLElement>()
  return ref as React.RefObject<HTMLElement | null>
}

function renderPanel(overrides: Partial<Parameters<typeof ColumnSettingsPanel>[0]> = {}) {
  const anchorRef = makeAnchorRef()
  const onClose = vi.fn()
  const onChange = vi.fn()
  const result = render(
    <div>
      <button ref={anchorRef as React.RefObject<HTMLButtonElement>} data-anchor>锚点</button>
      <ColumnSettingsPanel
        open={true}
        columns={COLUMNS}
        value={VALUE}
        onChange={onChange}
        onClose={onClose}
        anchorRef={anchorRef}
        {...overrides}
      />
    </div>,
  )
  return { ...result, onClose, onChange, anchorRef }
}

// ── open state ───────────────────────────────────────────────────

describe('ColumnSettingsPanel — open 状态', () => {
  it('open=false 时不渲染面板', () => {
    const { container } = render(
      <ColumnSettingsPanel
        open={false}
        columns={COLUMNS}
        value={VALUE}
        onChange={vi.fn()}
        onClose={vi.fn()}
        anchorRef={makeAnchorRef()}
      />,
    )
    expect(container.querySelector('[data-column-settings-panel]')).toBeNull()
  })

  it('open=true 时渲染面板', () => {
    renderPanel()
    expect(document.querySelector('[data-column-settings-panel]')).toBeTruthy()
  })
})

// ── column list ──────────────────────────────────────────────────

describe('ColumnSettingsPanel — 列渲染', () => {
  it('渲染所有列', () => {
    renderPanel()
    expect(screen.getByText('Name')).toBeTruthy()
    expect(screen.getByText('Status')).toBeTruthy()
    expect(screen.getByText('Score')).toBeTruthy()
  })

  it('visible=true 的列 checkbox 为 checked', () => {
    renderPanel()
    const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[]
    // name（visible:true）→ checked
    const nameCheckbox = checkboxes.find((cb) => cb.getAttribute('aria-label')?.includes('Name'))
    expect(nameCheckbox?.checked).toBe(true)
  })

  it('visible=false 的列 checkbox 为 unchecked', () => {
    renderPanel()
    const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[]
    const scoreCheckbox = checkboxes.find((cb) => cb.getAttribute('aria-label')?.includes('Score'))
    expect(scoreCheckbox?.checked).toBe(false)
  })

  it('pinned 列 checkbox 为 disabled', () => {
    renderPanel()
    const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[]
    const pinnedCheckbox = checkboxes.find((cb) => cb.getAttribute('aria-label')?.includes('ID'))
    expect(pinnedCheckbox?.disabled).toBe(true)
  })
})

// ── toggle ───────────────────────────────────────────────────────

describe('ColumnSettingsPanel — toggle 列可见性', () => {
  it('点击 visible=true 的列 → onChange 传入 visible=false', () => {
    const { onChange } = renderPanel()
    const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[]
    const nameCheckbox = checkboxes.find((cb) => cb.getAttribute('aria-label')?.includes('Name'))
    expect(nameCheckbox).toBeTruthy()
    fireEvent.click(nameCheckbox!)
    expect(onChange).toHaveBeenCalledTimes(1)
    const newMap = onChange.mock.calls[0][0] as ReadonlyMap<string, ColumnPreference>
    expect(newMap.get('name')?.visible).toBe(false)
  })

  it('点击 visible=false 的列 → onChange 传入 visible=true', () => {
    const { onChange } = renderPanel()
    const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[]
    const scoreCheckbox = checkboxes.find((cb) => cb.getAttribute('aria-label')?.includes('Score'))
    fireEvent.click(scoreCheckbox!)
    const newMap = onChange.mock.calls[0][0] as ReadonlyMap<string, ColumnPreference>
    expect(newMap.get('score')?.visible).toBe(true)
  })

  it('pinned 列点击不触发 onChange', () => {
    const { onChange } = renderPanel()
    const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[]
    const idCheckbox = checkboxes.find((cb) => cb.getAttribute('aria-label')?.includes('ID'))
    if (idCheckbox) fireEvent.click(idCheckbox)
    expect(onChange).not.toHaveBeenCalled()
  })
})

// ── onClose ──────────────────────────────────────────────────────

describe('ColumnSettingsPanel — onClose', () => {
  it('点击关闭按钮触发 onClose', () => {
    const { onClose } = renderPanel()
    fireEvent.click(screen.getByRole('button', { name: '关闭列设置' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('ESC 键触发 onClose', () => {
    const { onClose } = renderPanel()
    const panel = document.querySelector('[data-column-settings-panel]')
    expect(panel).toBeTruthy()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

// ── a11y ─────────────────────────────────────────────────────────

describe('ColumnSettingsPanel — a11y', () => {
  it('面板有 role=dialog + aria-modal=true', () => {
    renderPanel()
    const panel = document.querySelector('[data-column-settings-panel]')
    expect(panel?.getAttribute('role')).toBe('dialog')
    expect(panel?.getAttribute('aria-modal')).toBe('true')
  })

  it('面板有 aria-label', () => {
    renderPanel()
    const panel = document.querySelector('[data-column-settings-panel]')
    expect(panel?.getAttribute('aria-label')).toBeTruthy()
  })
})

// ── SSR ──────────────────────────────────────────────────────────

describe('ColumnSettingsPanel — SSR 零 throw', () => {
  it('open=false renderToString 不 throw（输出空）', () => {
    expect(() =>
      renderToString(
        <ColumnSettingsPanel
          open={false}
          columns={COLUMNS}
          value={VALUE}
          onChange={vi.fn()}
          onClose={vi.fn()}
          anchorRef={makeAnchorRef()}
        />,
      ),
    ).not.toThrow()
  })

  it('open=true renderToString 不 throw（mounted=false 时 return null）', () => {
    expect(() =>
      renderToString(
        <ColumnSettingsPanel
          open={true}
          columns={COLUMNS}
          value={VALUE}
          onChange={vi.fn()}
          onClose={vi.fn()}
          anchorRef={makeAnchorRef()}
        />,
      ),
    ).not.toThrow()
  })
})
