/**
 * tests/unit/components/admin/shared/modern-table/ColumnHeaderMenu.test.tsx
 * CHG-327: ColumnHeaderMenu 共享组件渲染验证
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ColumnHeaderMenu } from '@/components/admin/shared/modern-table/column-menu/ColumnHeaderMenu'

describe('ColumnHeaderMenu', () => {
  const noop = () => {}

  describe('排序区', () => {
    it('canSort=true 时渲染升序/降序按钮', () => {
      render(
        <ColumnHeaderMenu
          canSort={true}
          currentSortDir={null}
          canHide={false}
          onSortAsc={noop}
          onSortDesc={noop}
          onHide={noop}
        />
      )
      expect(screen.getByRole('button', { name: '升序' })).toBeTruthy()
      expect(screen.getByRole('button', { name: '降序' })).toBeTruthy()
    })

    it('canSort=false 时不渲染排序按钮', () => {
      render(
        <ColumnHeaderMenu
          canSort={false}
          currentSortDir={null}
          canHide={false}
          onSortAsc={noop}
          onSortDesc={noop}
          onHide={noop}
        />
      )
      expect(screen.queryByRole('button', { name: '升序' })).toBeNull()
      expect(screen.queryByRole('button', { name: '降序' })).toBeNull()
    })

    it('currentSortDir=asc 时升序按钮高亮', () => {
      render(
        <ColumnHeaderMenu
          canSort={true}
          currentSortDir="asc"
          canHide={false}
          onSortAsc={noop}
          onSortDesc={noop}
          onHide={noop}
        />
      )
      const ascBtn = screen.getByRole('button', { name: '升序' })
      expect(ascBtn.className).toContain('bg-[var(--accent)]')
    })

    it('currentSortDir=desc 时降序按钮高亮', () => {
      render(
        <ColumnHeaderMenu
          canSort={true}
          currentSortDir="desc"
          canHide={false}
          onSortAsc={noop}
          onSortDesc={noop}
          onHide={noop}
        />
      )
      const descBtn = screen.getByRole('button', { name: '降序' })
      expect(descBtn.className).toContain('bg-[var(--accent)]')
    })

    it('点击升序调用 onSortAsc', () => {
      const onSortAsc = vi.fn()
      render(
        <ColumnHeaderMenu
          canSort={true}
          currentSortDir={null}
          canHide={false}
          onSortAsc={onSortAsc}
          onSortDesc={noop}
          onHide={noop}
        />
      )
      fireEvent.click(screen.getByRole('button', { name: '升序' }))
      expect(onSortAsc).toHaveBeenCalledOnce()
    })

    it('点击降序调用 onSortDesc', () => {
      const onSortDesc = vi.fn()
      render(
        <ColumnHeaderMenu
          canSort={true}
          currentSortDir={null}
          canHide={false}
          onSortAsc={noop}
          onSortDesc={onSortDesc}
          onHide={noop}
        />
      )
      fireEvent.click(screen.getByRole('button', { name: '降序' }))
      expect(onSortDesc).toHaveBeenCalledOnce()
    })
  })

  describe('筛选区', () => {
    it('无 filterContent 时不渲染筛选区', () => {
      render(
        <ColumnHeaderMenu
          canSort={false}
          currentSortDir={null}
          canHide={false}
          onSortAsc={noop}
          onSortDesc={noop}
          onHide={noop}
        />
      )
      expect(screen.queryByRole('button', { name: '清除当前列筛选' })).toBeNull()
    })

    it('有 filterContent 时渲染 slot 内容', () => {
      render(
        <ColumnHeaderMenu
          canSort={false}
          currentSortDir={null}
          canHide={false}
          filterContent={<input placeholder="筛选关键字" />}
          onSortAsc={noop}
          onSortDesc={noop}
          onHide={noop}
        />
      )
      expect(screen.getByPlaceholderText('筛选关键字')).toBeTruthy()
    })

    it('有 filterContent + onClearFilter 时渲染清除按钮', () => {
      const onClearFilter = vi.fn()
      render(
        <ColumnHeaderMenu
          canSort={false}
          currentSortDir={null}
          canHide={false}
          filterContent={<span>filter</span>}
          onClearFilter={onClearFilter}
          onSortAsc={noop}
          onSortDesc={noop}
          onHide={noop}
        />
      )
      const clearBtn = screen.getByRole('button', { name: '清除当前列筛选' })
      fireEvent.click(clearBtn)
      expect(onClearFilter).toHaveBeenCalledOnce()
    })

    it('有 filterContent 但无 onClearFilter 时不渲染清除按钮', () => {
      render(
        <ColumnHeaderMenu
          canSort={false}
          currentSortDir={null}
          canHide={false}
          filterContent={<span>filter</span>}
          onSortAsc={noop}
          onSortDesc={noop}
          onHide={noop}
        />
      )
      expect(screen.queryByRole('button', { name: '清除当前列筛选' })).toBeNull()
    })
  })

  describe('隐藏按钮', () => {
    it('canHide=true 时渲染隐藏按钮', () => {
      render(
        <ColumnHeaderMenu
          canSort={false}
          currentSortDir={null}
          canHide={true}
          onSortAsc={noop}
          onSortDesc={noop}
          onHide={noop}
        />
      )
      expect(screen.getByRole('button', { name: '隐藏此列' })).toBeTruthy()
    })

    it('canHide=false 时不渲染隐藏按钮', () => {
      render(
        <ColumnHeaderMenu
          canSort={false}
          currentSortDir={null}
          canHide={false}
          onSortAsc={noop}
          onSortDesc={noop}
          onHide={noop}
        />
      )
      expect(screen.queryByRole('button', { name: '隐藏此列' })).toBeNull()
    })

    it('点击隐藏调用 onHide', () => {
      const onHide = vi.fn()
      render(
        <ColumnHeaderMenu
          canSort={false}
          currentSortDir={null}
          canHide={true}
          onSortAsc={noop}
          onSortDesc={noop}
          onHide={onHide}
        />
      )
      fireEvent.click(screen.getByRole('button', { name: '隐藏此列' }))
      expect(onHide).toHaveBeenCalledOnce()
    })
  })
})
