/**
 * SubtitleUploadModalPicker.test.tsx — CHG-SN-8-FUP-SUB
 *
 * 范围（4 用例）：
 *  1. Modal 打开时显示 VideoPicker 触发器（替代旧 UUID 输入）+ 无原 sub-video-id input
 *  2. video 未选 → 提交触发「必选」错误，onSubmit 未调用
 *  3. video 选中后 → 提交携带 video.id (UUID) 而非用户键入文本
 *  4. Modal 关闭再打开 → video 复位为 null（useEffect open 清理）
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

const listVideosMock = vi.fn()

vi.mock('../../../../../../apps/server-next/src/lib/videos/api', () => ({
  listVideos: (...args: unknown[]) => listVideosMock(...args),
}))

import { SubtitleUploadModal } from '../../../../../../apps/server-next/src/app/admin/subtitles/_client/SubtitleUploadModal'

const VIDEO_ROW = {
  id: 'video-uuid-aaaa-1111',
  short_id: 'V001',
  title: '银河护卫队',
  title_en: 'Guardians of the Galaxy',
  cover_url: null,
  type: 'movie',
  year: 2014,
  is_published: true,
  source_count: '5',
  created_at: '2026-05-01T00:00:00Z',
}

beforeEach(() => {
  listVideosMock.mockReset()
  listVideosMock.mockResolvedValue({ data: [VIDEO_ROW], total: 1, page: 1, limit: 20 })
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('SubtitleUploadModal · VideoPicker 集成 (CHG-SN-8-FUP-SUB)', () => {
  it('1. Modal 打开时显示 VideoPicker 触发器；不再有原 UUID input', () => {
    const onSubmit = vi.fn()
    render(<SubtitleUploadModal open onClose={() => {}} onSubmit={onSubmit} />)
    expect(screen.getByTestId('sub-video-picker')).not.toBeNull()
    // 旧 input 已废
    expect(screen.queryByPlaceholderText('xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx')).toBeNull()
  })

  it('2. video 未选 → 提交触发「必选」错误 + onSubmit 未调用', async () => {
    const onSubmit = vi.fn()
    const { container } = render(<SubtitleUploadModal open onClose={() => {}} onSubmit={onSubmit} />)
    // 填充其它必填字段
    const labelInput = document.querySelector('#sub-label') as HTMLInputElement
    fireEvent.change(labelInput, { target: { value: '中文简体' } })
    const urlInput = document.querySelector('#sub-file-url') as HTMLInputElement
    fireEvent.change(urlInput, { target: { value: 'https://r2.example.com/a.srt' } })
    // 提交
    const form = document.querySelector('form') as HTMLFormElement
    fireEvent.submit(form)
    expect(onSubmit).not.toHaveBeenCalled()
    await waitFor(() => {
      expect(screen.getByText('必选')).not.toBeNull()
    })
  })

  it('3. video 选中后 → 提交携带 video.id UUID', async () => {
    const onSubmit = vi.fn()
    const { container } = render(<SubtitleUploadModal open onClose={() => {}} onSubmit={onSubmit} />)
    // 打开 VideoPicker dialog
    fireEvent.click(screen.getByTestId('sub-video-picker'))
    // 等待 fetcher 返回 + 选中
    await waitFor(() => screen.getByTestId('sub-video-picker-dialog'))
    await waitFor(() => screen.getByTestId(`sub-video-picker-row-${VIDEO_ROW.id}`))
    fireEvent.click(screen.getByTestId(`sub-video-picker-row-${VIDEO_ROW.id}`))
    // 填其它字段
    const labelInput = document.querySelector('#sub-label') as HTMLInputElement
    fireEvent.change(labelInput, { target: { value: '中文简体' } })
    const urlInput = document.querySelector('#sub-file-url') as HTMLInputElement
    fireEvent.change(urlInput, { target: { value: 'https://r2.example.com/a.srt' } })
    // 提交
    const form = document.querySelector('form') as HTMLFormElement
    fireEvent.submit(form)
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1)
    })
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      videoId: VIDEO_ROW.id,
      language: 'zh-CN',
      label: '中文简体',
      fileUrl: 'https://r2.example.com/a.srt',
    })
  })

  it('4. Modal 关闭再打开 → video 复位为 null', async () => {
    const onSubmit = vi.fn()
    const { rerender } = render(<SubtitleUploadModal open onClose={() => {}} onSubmit={onSubmit} />)
    // 选中视频
    fireEvent.click(screen.getByTestId('sub-video-picker'))
    await waitFor(() => screen.getByTestId(`sub-video-picker-row-${VIDEO_ROW.id}`))
    fireEvent.click(screen.getByTestId(`sub-video-picker-row-${VIDEO_ROW.id}`))
    // 触发器回显 title
    await waitFor(() => {
      expect(screen.getByTestId('sub-video-picker').textContent).toContain('银河护卫队')
    })
    // 关闭再打开
    rerender(<SubtitleUploadModal open={false} onClose={() => {}} onSubmit={onSubmit} />)
    rerender(<SubtitleUploadModal open onClose={() => {}} onSubmit={onSubmit} />)
    // video 应复位
    await waitFor(() => {
      expect(screen.getByTestId('sub-video-picker').textContent).not.toContain('银河护卫队')
      expect(screen.getByTestId('sub-video-picker').textContent).toContain('选择视频')
    })
  })
})
