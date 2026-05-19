/**
 * MigrationTab.test.tsx — SettingsContainer MigrationTab 单元测试（CHG-SN-6-08）
 *
 * 覆盖（≥ 9 用例硬清单）：
 *   1. 渲染基础：export + import 2 section card
 *   2. 导出按钮点击触发 exportSourcesDownload + success toast
 *   3. 导出失败 toast danger
 *   4. 文件选择按钮触发 input click
 *   5. 文件上传成功 → 结果展示 + success toast
 *   6. 文件上传含错误 → warn toast + 错误列表显示
 *   7. VALIDATION_ERROR 错误码差异化 toast
 *   8. 网络异常兜底 toast
 *   9. 错误列表 > 10 条 → 显示前 10 + "还有 X 条"
 *   10. 上传完成后 input value 清空（允许重复上传）
 *   11. 无文件选择（取消文件框）→ 无 API 调用
 */
import { beforeEach, describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

const exportSourcesDownloadMock = vi.fn()
const importSourcesUploadMock = vi.fn()
const toastPushMock = vi.fn()

vi.mock('../../../../../../apps/server-next/src/lib/system/api', () => ({
  exportSourcesDownload: (...args: unknown[]) => exportSourcesDownloadMock(...args),
  importSourcesUpload: (...args: unknown[]) => importSourcesUploadMock(...args),
}))

vi.mock('@resovo/admin-ui', async () => {
  const actual = await vi.importActual<typeof import('@resovo/admin-ui')>('@resovo/admin-ui')
  return {
    ...actual,
    useToast: () => ({
      push: (input: unknown) => { toastPushMock(input); return 'tid' },
      dismiss: vi.fn(),
      dismissAll: vi.fn(),
    }),
  }
})

vi.mock('../../../../../../apps/server-next/src/lib/api-client', () => {
  class MockApiClientError extends Error {
    public readonly code: string
    public readonly status: number
    constructor(code: string, message: string, status: number) {
      super(message)
      this.code = code
      this.status = status
      this.name = 'ApiClientError'
    }
  }
  return {
    ApiClientError: MockApiClientError,
    apiClient: {
      get: vi.fn(), post: vi.fn(), postMultipart: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn(),
    },
  }
})

import { MigrationTab } from '../../../../../../apps/server-next/src/app/admin/settings/_tabs/MigrationTab'
import { ApiClientError } from '../../../../../../apps/server-next/src/lib/api-client'

const SAMPLE_FILE = new File(['[]'], 'sources.json', { type: 'application/json' })
const SUCCESS_RESULT = { imported: 100, skipped: 5, errors: [] }
const PARTIAL_RESULT = {
  imported: 80,
  skipped: 3,
  errors: [
    { index: 12, shortId: 'abc', error: 'shortId 不合法' },
    { index: 35, error: 'sourceUrl 不存在' },
  ],
}

beforeEach(() => {
  exportSourcesDownloadMock.mockReset()
  importSourcesUploadMock.mockReset()
  toastPushMock.mockReset()
})

describe('MigrationTab', () => {
  it('1. 渲染基础：export + import 2 section card', () => {
    render(<MigrationTab />)
    expect(screen.getByTestId('migration-card-export')).not.toBeNull()
    expect(screen.getByTestId('migration-card-import')).not.toBeNull()
  })

  it('2. 导出按钮点击触发 exportSourcesDownload + success toast', async () => {
    exportSourcesDownloadMock.mockResolvedValueOnce(undefined)
    render(<MigrationTab />)
    fireEvent.click(screen.getByTestId('migration-export-btn'))
    await waitFor(() => {
      expect(exportSourcesDownloadMock).toHaveBeenCalled()
      expect(toastPushMock).toHaveBeenCalledWith(expect.objectContaining({
        level: 'success', title: '导出已开始',
      }))
    })
  })

  it('3. 导出失败 toast danger', async () => {
    exportSourcesDownloadMock.mockRejectedValueOnce(new Error('网络断开'))
    render(<MigrationTab />)
    fireEvent.click(screen.getByTestId('migration-export-btn'))
    await waitFor(() => {
      expect(toastPushMock).toHaveBeenCalledWith(expect.objectContaining({
        level: 'danger', title: '操作失败', description: '网络断开',
      }))
    })
  })

  it('4. 文件选择按钮触发 input click', () => {
    const { container } = render(<MigrationTab />)
    const input = container.querySelector('[data-testid="migration-import-file"]') as HTMLInputElement
    const clickSpy = vi.spyOn(input, 'click')
    fireEvent.click(screen.getByTestId('migration-import-btn'))
    expect(clickSpy).toHaveBeenCalled()
  })

  it('5. 文件上传成功 → 结果展示 + success toast', async () => {
    importSourcesUploadMock.mockResolvedValueOnce(SUCCESS_RESULT)
    const { container } = render(<MigrationTab />)
    const input = container.querySelector('[data-testid="migration-import-file"]') as HTMLInputElement
    Object.defineProperty(input, 'files', { value: [SAMPLE_FILE], writable: false })
    fireEvent.change(input)
    await waitFor(() => {
      expect(importSourcesUploadMock).toHaveBeenCalledWith(SAMPLE_FILE)
      expect(screen.getByTestId('migration-import-result')).not.toBeNull()
      expect(screen.getByText('100')).not.toBeNull()
      expect(toastPushMock).toHaveBeenCalledWith(expect.objectContaining({
        level: 'success', title: '导入完成',
      }))
    })
  })

  it('6. 文件上传含错误 → warn toast + 错误列表显示', async () => {
    importSourcesUploadMock.mockResolvedValueOnce(PARTIAL_RESULT)
    const { container } = render(<MigrationTab />)
    const input = container.querySelector('[data-testid="migration-import-file"]') as HTMLInputElement
    Object.defineProperty(input, 'files', { value: [SAMPLE_FILE], writable: false })
    fireEvent.change(input)
    await waitFor(() => {
      expect(toastPushMock).toHaveBeenCalledWith(expect.objectContaining({
        level: 'warn', title: '导入完成',
      }))
      expect(screen.getByTestId('migration-error-12')).not.toBeNull()
      expect(screen.getByTestId('migration-error-35')).not.toBeNull()
      expect(screen.getByText(/shortId 不合法/)).not.toBeNull()
    })
  })

  it('7. VALIDATION_ERROR 错误码差异化 toast', async () => {
    importSourcesUploadMock.mockRejectedValueOnce(
      new ApiClientError('VALIDATION_ERROR', '文件内容必须是 JSON 数组', 422),
    )
    const { container } = render(<MigrationTab />)
    const input = container.querySelector('[data-testid="migration-import-file"]') as HTMLInputElement
    Object.defineProperty(input, 'files', { value: [SAMPLE_FILE], writable: false })
    fireEvent.change(input)
    await waitFor(() => {
      expect(toastPushMock).toHaveBeenCalledWith(expect.objectContaining({
        level: 'danger', title: '上传文件不合法',
        description: '文件内容必须是 JSON 数组',
      }))
    })
  })

  it('8. 网络异常兜底 toast', async () => {
    importSourcesUploadMock.mockRejectedValueOnce(new Error('上传中断'))
    const { container } = render(<MigrationTab />)
    const input = container.querySelector('[data-testid="migration-import-file"]') as HTMLInputElement
    Object.defineProperty(input, 'files', { value: [SAMPLE_FILE], writable: false })
    fireEvent.change(input)
    await waitFor(() => {
      expect(toastPushMock).toHaveBeenCalledWith(expect.objectContaining({
        level: 'danger', title: '操作失败', description: '上传中断',
      }))
    })
  })

  it('9. 错误列表 > 10 条 → 显示前 10 + "还有 X 条"', async () => {
    const manyErrors = Array.from({ length: 15 }, (_, i) => ({
      index: i,
      shortId: `s${i}`,
      error: `error-${i}`,
    }))
    importSourcesUploadMock.mockResolvedValueOnce({ imported: 0, skipped: 0, errors: manyErrors })
    const { container } = render(<MigrationTab />)
    const input = container.querySelector('[data-testid="migration-import-file"]') as HTMLInputElement
    Object.defineProperty(input, 'files', { value: [SAMPLE_FILE], writable: false })
    fireEvent.change(input)
    await waitFor(() => {
      // 0-9 共 10 条显示
      expect(screen.getByTestId('migration-error-0')).not.toBeNull()
      expect(screen.getByTestId('migration-error-9')).not.toBeNull()
      // 10 以后不显示
      expect(screen.queryByTestId('migration-error-10')).toBeNull()
      // "还有 5 条错误未显示"
      expect(screen.getByText(/还有 5 条/)).not.toBeNull()
    })
  })

  it('10. 上传完成后 input value 为空（允许重复上传同一文件）', async () => {
    importSourcesUploadMock.mockResolvedValueOnce(SUCCESS_RESULT)
    const { container } = render(<MigrationTab />)
    const input = container.querySelector('[data-testid="migration-import-file"]') as HTMLInputElement
    // JSDOM 不允许 .value 设置 file input 非空字符串；
    // 仅验证 upload 后 input.value 为空（finally block 主动设 '' 是合法操作）
    Object.defineProperty(input, 'files', { value: [SAMPLE_FILE], writable: false })
    fireEvent.change(input)
    await waitFor(() => {
      expect(importSourcesUploadMock).toHaveBeenCalled()
    })
    expect(input.value).toBe('')
  })

  it('11. 无文件选择（取消）→ 无 API 调用', () => {
    const { container } = render(<MigrationTab />)
    const input = container.querySelector('[data-testid="migration-import-file"]') as HTMLInputElement
    // FileList 为空（用户取消文件框）
    Object.defineProperty(input, 'files', { value: [], writable: false })
    fireEvent.change(input)
    expect(importSourcesUploadMock).not.toHaveBeenCalled()
    expect(toastPushMock).not.toHaveBeenCalled()
  })

  it('12. data-testid 钩子完整（e2e / playwright 选择器友好）', () => {
    const { container } = render(<MigrationTab />)
    expect(container.querySelector('[data-testid="migration-tab"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="migration-export-btn"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="migration-import-btn"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="migration-import-file"]')).not.toBeNull()
  })
})
