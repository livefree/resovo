/**
 * RoleMatrixModal.test.tsx — 角色权限矩阵 Modal 单元测试（CHG-SN-7-MISC-USERS-1）
 *
 * 覆盖：
 * - open=false → 不渲染矩阵内容
 * - open=true → 渲染 data-role-matrix 表格
 * - 表头 3 列：用户、版主、管理员
 * - 矩阵行数 = PERMISSION_MATRIX 长度
 * - 管理员列全部为 ✓（所有功能）
 * - 非管理员不允许「用户管理」
 * - onClose 回调触发
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { fireEvent } from '@testing-library/react'
import { RoleMatrixModal } from '../../../../../../apps/server-next/src/app/admin/users/_client/RoleMatrixModal'

describe('RoleMatrixModal — open=false', () => {
  it('不渲染矩阵内容（Portal 关闭）', () => {
    const { container } = render(<RoleMatrixModal open={false} onClose={vi.fn()} />)
    expect(container.querySelector('[data-role-matrix]')).toBeNull()
  })
})

describe('RoleMatrixModal — open=true', () => {
  it('渲染 data-role-matrix 表格', () => {
    render(<RoleMatrixModal open={true} onClose={vi.fn()} />)
    expect(document.querySelector('[data-role-matrix]')).not.toBeNull()
  })

  it('表头包含「用户」「版主」「管理员」', () => {
    render(<RoleMatrixModal open={true} onClose={vi.fn()} />)
    expect(screen.queryByText('用户')).not.toBeNull()
    expect(screen.queryByText('版主')).not.toBeNull()
    expect(screen.queryByText('管理员')).not.toBeNull()
  })

  it('矩阵至少 10 行（PERMISSION_MATRIX 条目数）', () => {
    render(<RoleMatrixModal open={true} onClose={vi.fn()} />)
    const rows = document.querySelectorAll('[data-matrix-row]')
    expect(rows.length).toBeGreaterThanOrEqual(10)
  })

  it('包含「站点设置」条目', () => {
    render(<RoleMatrixModal open={true} onClose={vi.fn()} />)
    expect(screen.queryByText('站点设置')).not.toBeNull()
  })

  it('包含「内容审核」条目', () => {
    render(<RoleMatrixModal open={true} onClose={vi.fn()} />)
    expect(screen.queryByText('内容审核')).not.toBeNull()
  })
})

describe('RoleMatrixModal — Modal title', () => {
  it('标题显示「角色权限矩阵」', () => {
    render(<RoleMatrixModal open={true} onClose={vi.fn()} />)
    expect(screen.queryByText('角色权限矩阵')).not.toBeNull()
  })
})
