/**
 * tests/unit/components/admin/videos/VideoImageSection.test.tsx — IMG-07
 *
 * 验证 VideoImageSection 的上传流：
 * - 4 种 kind 均渲染"上传新图"按钮
 * - 选文件 → apiClient.upload 被调用（multipart 字段正确）
 * - 上传成功 → onSaved 触发（乐观更新 URL + pending_review 状态）
 * - 超大文件 → 客户端前置校验 → 显示"图片超过 5MB"
 * - 非白名单 mimetype → 客户端前置校验 → 显示"仅支持..."
 * - 服务端返 413/415 → 显示对应友好提示
 * - 缩略图渲染（有 url 时）
 * - 缩略图破图 → 降级为 URL 文本
 * - "改 URL" 兜底流程保留
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

const getMock = vi.fn()
const putMock = vi.fn()
const uploadMock = vi.fn()
const uploadWithProgressMock = vi.fn()

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: (...args: unknown[]) => getMock(...args),
    put: (...args: unknown[]) => putMock(...args),
    upload: (...args: unknown[]) => uploadMock(...args),
    uploadWithProgress: (...args: unknown[]) => uploadWithProgressMock(...args),
  },
}))

import { VideoImageSection } from '@/components/admin/videos/VideoImageSection'

function makeImagesData(overrides: Partial<Record<string, { url: string | null; status: string | null }>> = {}) {
  return {
    poster:          { url: null, status: null },
    backdrop:        { url: null, status: null },
    logo:            { url: null, status: null },
    banner_backdrop: { url: null, status: null },
    lastStatusUpdatedAt: null,
    ...overrides,
  }
}

function makeFile(name: string, type: string, size: number): File {
  const blob = new Blob(['x'.repeat(size)], { type })
  return new File([blob], name, { type })
}

describe('VideoImageSection — 渲染', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getMock.mockResolvedValue({ data: makeImagesData() })
  })

  it('加载后 4 种 kind 均渲染"上传新图"按钮', async () => {
    render(<VideoImageSection videoId="vid-1" />)
    await screen.findByTestId('image-upload-btn-poster')
    expect(screen.getByTestId('image-upload-btn-backdrop')).toBeDefined()
    expect(screen.getByTestId('image-upload-btn-logo')).toBeDefined()
    expect(screen.getByTestId('image-upload-btn-banner_backdrop')).toBeDefined()
  })

  it('4 种 kind 均渲染"改 URL"兜底按钮', async () => {
    render(<VideoImageSection videoId="vid-1" />)
    await screen.findByTestId('image-url-btn-poster')
    expect(screen.getByTestId('image-url-btn-backdrop')).toBeDefined()
    expect(screen.getByTestId('image-url-btn-logo')).toBeDefined()
    expect(screen.getByTestId('image-url-btn-banner_backdrop')).toBeDefined()
  })

  it('有 url 时渲染缩略图 <img>', async () => {
    getMock.mockResolvedValue({
      data: makeImagesData({
        poster: { url: 'https://cdn.example/p.jpg', status: 'ok' },
      }),
    })
    render(<VideoImageSection videoId="vid-1" />)
    const img = await screen.findByTestId('image-preview-poster') as HTMLImageElement
    expect(img.src).toContain('https://cdn.example/p.jpg')
  })

  it('无 url 时不渲染缩略图', async () => {
    render(<VideoImageSection videoId="vid-1" />)
    await screen.findByTestId('image-upload-btn-poster')
    expect(screen.queryByTestId('image-preview-poster')).toBeNull()
  })
})

describe('VideoImageSection — 上传流', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getMock.mockResolvedValue({ data: makeImagesData() })
  })

  it('选择合法图片 → apiClient.upload 被调用，multipart 字段正确', async () => {
    uploadWithProgressMock.mockResolvedValue({
      data: {
        url: 'https://cdn.example/uploaded.png',
        key: 'posters/vid-1-abcdef12.png',
        kind: 'poster',
        contentType: 'image/png',
        size: 1024,
        hash: 'abcdef12',
        blurhashJobId: 'job-1',
        provider: 'r2',
      },
    })
    render(<VideoImageSection videoId="vid-1" />)
    const fileInput = (await screen.findByTestId('image-file-input-poster')) as HTMLInputElement
    const file = makeFile('demo.png', 'image/png', 1024)
    fireEvent.change(fileInput, { target: { files: [file] } })

    await waitFor(() => expect(uploadWithProgressMock).toHaveBeenCalledTimes(1))
    const [path, formData] = uploadWithProgressMock.mock.calls[0]
    expect(path).toBe('/admin/media/images')
    const fd = formData as FormData
    expect(fd.get('ownerType')).toBe('video')
    expect(fd.get('ownerId')).toBe('vid-1')
    expect(fd.get('kind')).toBe('poster')
    expect(fd.get('file')).toBeInstanceOf(File)
  })

  it('上传成功 → 乐观更新显示新 url（pending_review 状态）', async () => {
    uploadWithProgressMock.mockResolvedValue({
      data: {
        url: 'https://cdn.example/new.png',
        key: 'posters/vid-1-h.png',
        kind: 'poster',
        contentType: 'image/png',
        size: 100,
        hash: 'h',
        blurhashJobId: null,
        provider: 'local-fs',
      },
    })
    render(<VideoImageSection videoId="vid-1" />)
    const fileInput = (await screen.findByTestId('image-file-input-poster')) as HTMLInputElement
    fireEvent.change(fileInput, { target: { files: [makeFile('a.png', 'image/png', 100)] } })

    await waitFor(() => {
      const img = screen.queryByTestId('image-preview-poster') as HTMLImageElement | null
      expect(img?.src).toContain('https://cdn.example/new.png')
    })
    // pending_review 状态标签
    const status = await screen.findByTestId('image-status-poster')
    expect(status.textContent).toContain('检测中')
  })

  it('超过 5MB → 前置校验 → 显示"图片超过 5MB" + 不调 upload', async () => {
    render(<VideoImageSection videoId="vid-1" />)
    const fileInput = (await screen.findByTestId('image-file-input-poster')) as HTMLInputElement
    const big = makeFile('big.png', 'image/png', 5 * 1024 * 1024 + 1)
    fireEvent.change(fileInput, { target: { files: [big] } })

    const err = await screen.findByTestId('image-upload-error-poster')
    expect(err.textContent).toContain('超过 5MB')
    expect(uploadWithProgressMock).not.toHaveBeenCalled()
  })

  it('非白名单 mimetype → 前置校验 → 显示"仅支持..." + 不调 upload', async () => {
    render(<VideoImageSection videoId="vid-1" />)
    const fileInput = (await screen.findByTestId('image-file-input-backdrop')) as HTMLInputElement
    const pdf = makeFile('doc.pdf', 'application/pdf', 100)
    fireEvent.change(fileInput, { target: { files: [pdf] } })

    const err = await screen.findByTestId('image-upload-error-backdrop')
    expect(err.textContent).toContain('仅支持')
    expect(uploadWithProgressMock).not.toHaveBeenCalled()
  })

  it('服务端返 413 → 映射为"图片超过 5MB"', async () => {
    uploadWithProgressMock.mockRejectedValue(new Error('413 PAYLOAD_TOO_LARGE: ...'))
    render(<VideoImageSection videoId="vid-1" />)
    const fileInput = (await screen.findByTestId('image-file-input-poster')) as HTMLInputElement
    fireEvent.change(fileInput, { target: { files: [makeFile('a.png', 'image/png', 100)] } })

    const err = await screen.findByTestId('image-upload-error-poster')
    await waitFor(() => expect(err.textContent).toContain('超过 5MB'))
  })

  it('服务端返 415 → 映射为"仅支持..."', async () => {
    uploadWithProgressMock.mockRejectedValue(new Error('415 UNSUPPORTED_MEDIA_TYPE: ...'))
    render(<VideoImageSection videoId="vid-1" />)
    const fileInput = (await screen.findByTestId('image-file-input-poster')) as HTMLInputElement
    fireEvent.change(fileInput, { target: { files: [makeFile('a.png', 'image/png', 100)] } })

    const err = await screen.findByTestId('image-upload-error-poster')
    await waitFor(() => expect(err.textContent).toContain('仅支持'))
  })

  it('上传中按钮显示"上传中…"并 disabled', async () => {
    let resolve: ((v: unknown) => void) | undefined
    uploadWithProgressMock.mockImplementationOnce(() => new Promise((r) => { resolve = r }))
    render(<VideoImageSection videoId="vid-1" />)
    const fileInput = (await screen.findByTestId('image-file-input-poster')) as HTMLInputElement
    fireEvent.change(fileInput, { target: { files: [makeFile('a.png', 'image/png', 100)] } })

    const btn = await screen.findByTestId('image-upload-btn-poster')
    await waitFor(() => expect(btn.textContent).toContain('上传中'))
    expect((btn as HTMLButtonElement).disabled).toBe(true)

    resolve!({
      data: { url: 'https://cdn.example/r.png', key: 'k', kind: 'poster', contentType: 'image/png', size: 1, hash: 'h', blurhashJobId: null, provider: 'r2' },
    })
  })
})

describe('VideoImageSection — 上传进度（IMG-07 follow-up P2-b）', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getMock.mockResolvedValue({ data: makeImagesData() })
  })

  function makeUploadWithProgressHandler() {
    // 捕获 onProgress 回调，延迟 resolve 以模拟真实上传过程
    let capturedOnProgress: ((p: { percent: number | null; loaded: number; total: number | null }) => void) | null = null
    let doResolve: ((v: unknown) => void) | null = null
    uploadWithProgressMock.mockImplementationOnce(
      (_path: string, _form: FormData, opts?: {
        onProgress?: (p: { percent: number | null; loaded: number; total: number | null }) => void
      }) => {
        capturedOnProgress = opts?.onProgress ?? null
        return new Promise((r) => { doResolve = r })
      },
    )
    return {
      emitProgress: (percent: number, loaded: number, total: number) =>
        capturedOnProgress?.({ percent, loaded, total }),
      resolve: (data: unknown) => doResolve?.(data),
    }
  }

  it('按钮文案显示百分比："上传中 42%"', async () => {
    const { emitProgress, resolve } = makeUploadWithProgressHandler()
    render(<VideoImageSection videoId="vid-1" />)
    const fileInput = (await screen.findByTestId('image-file-input-poster')) as HTMLInputElement
    fireEvent.change(fileInput, { target: { files: [makeFile('a.png', 'image/png', 100)] } })

    const btn = await screen.findByTestId('image-upload-btn-poster')
    await waitFor(() => expect(btn.textContent).toContain('上传中'))

    emitProgress(42, 42000, 100000)
    await waitFor(() => expect(btn.textContent).toContain('42%'))

    resolve({
      data: { url: 'https://cdn.example/done.png', key: 'k', kind: 'poster', contentType: 'image/png', size: 1, hash: 'h', blurhashJobId: null, provider: 'r2' },
    })
  })

  it('进度条 role=progressbar 含 aria-valuenow', async () => {
    const { emitProgress, resolve } = makeUploadWithProgressHandler()
    render(<VideoImageSection videoId="vid-1" />)
    const fileInput = (await screen.findByTestId('image-file-input-poster')) as HTMLInputElement
    fireEvent.change(fileInput, { target: { files: [makeFile('a.png', 'image/png', 100)] } })

    emitProgress(75, 750, 1000)
    const bar = await screen.findByTestId('image-upload-progress-poster')
    expect(bar.getAttribute('role')).toBe('progressbar')
    expect(bar.getAttribute('aria-valuenow')).toBe('75')
    expect(bar.getAttribute('aria-valuemin')).toBe('0')
    expect(bar.getAttribute('aria-valuemax')).toBe('100')

    resolve({
      data: { url: 'https://cdn.example/r.png', key: 'k', kind: 'poster', contentType: 'image/png', size: 1, hash: 'h', blurhashJobId: null, provider: 'r2' },
    })
  })

  it('onProgress 未报告时（percent=null）不渲染进度条，按钮仍显示"上传中…"', async () => {
    const { emitProgress, resolve } = makeUploadWithProgressHandler()
    render(<VideoImageSection videoId="vid-1" />)
    const fileInput = (await screen.findByTestId('image-file-input-poster')) as HTMLInputElement
    fireEvent.change(fileInput, { target: { files: [makeFile('a.png', 'image/png', 100)] } })

    emitProgress(null as unknown as number, 0, 0) // 模拟 lengthComputable=false
    // 这里 emitProgress 用 null 等同于浏览器 ProgressEvent lengthComputable=false 场景
    const btn = await screen.findByTestId('image-upload-btn-poster')
    await waitFor(() => expect(btn.textContent).toContain('上传中'))
    expect(screen.queryByTestId('image-upload-progress-poster')).toBeNull()

    resolve({
      data: { url: 'https://cdn.example/r.png', key: 'k', kind: 'poster', contentType: 'image/png', size: 1, hash: 'h', blurhashJobId: null, provider: 'r2' },
    })
  })
})

describe('VideoImageSection — 点击放大预览（IMG-07 follow-up P2-a）', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getMock.mockResolvedValue({
      data: makeImagesData({ poster: { url: 'https://cdn.example/poster.jpg', status: 'ok' } }),
    })
    // jsdom 不支持 <dialog> 的 showModal/close 方法，手动 polyfill
    HTMLDialogElement.prototype.showModal = function () {
      this.setAttribute('open', '')
    }
    HTMLDialogElement.prototype.close = function () {
      this.removeAttribute('open')
    }
  })

  it('有 url 时渲染"放大查看"触发按钮 + <dialog> 元素', async () => {
    render(<VideoImageSection videoId="vid-1" />)
    expect(await screen.findByTestId('image-preview-trigger-poster')).toBeDefined()
    expect(screen.getByTestId('image-preview-dialog-poster')).toBeDefined()
  })

  it('点击缩略图触发按钮 → <dialog> 打开', async () => {
    render(<VideoImageSection videoId="vid-1" />)
    const trigger = await screen.findByTestId('image-preview-trigger-poster')
    const dialog = screen.getByTestId('image-preview-dialog-poster') as HTMLDialogElement
    expect(dialog.hasAttribute('open')).toBe(false)
    fireEvent.click(trigger)
    expect(dialog.hasAttribute('open')).toBe(true)
  })

  it('点击关闭按钮 → <dialog> 关闭', async () => {
    render(<VideoImageSection videoId="vid-1" />)
    const trigger = await screen.findByTestId('image-preview-trigger-poster')
    fireEvent.click(trigger)
    const dialog = screen.getByTestId('image-preview-dialog-poster') as HTMLDialogElement
    expect(dialog.hasAttribute('open')).toBe(true)
    fireEvent.click(screen.getByTestId('image-preview-close-poster'))
    expect(dialog.hasAttribute('open')).toBe(false)
  })

  it('触发按钮有 aria-label 标识放大', async () => {
    render(<VideoImageSection videoId="vid-1" />)
    const trigger = await screen.findByTestId('image-preview-trigger-poster')
    expect(trigger.getAttribute('aria-label')).toContain('放大查看')
  })

  it('dialog 内大图 src 与缩略图一致', async () => {
    render(<VideoImageSection videoId="vid-1" />)
    await screen.findByTestId('image-preview-trigger-poster')
    const dialog = screen.getByTestId('image-preview-dialog-poster')
    const imgs = dialog.querySelectorAll('img')
    expect(imgs.length).toBeGreaterThan(0)
    const largeImg = imgs[imgs.length - 1] as HTMLImageElement
    expect(largeImg.src).toContain('https://cdn.example/poster.jpg')
  })
})

describe('VideoImageSection — 缩略图破图降级', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getMock.mockResolvedValue({
      data: makeImagesData({ poster: { url: 'https://cdn.example/404.jpg', status: 'broken' } }),
    })
  })

  it('<img onError> 触发 → 切换为"⚠ 预览加载失败" + URL 文本', async () => {
    render(<VideoImageSection videoId="vid-1" />)
    const img = (await screen.findByTestId('image-preview-poster')) as HTMLImageElement
    fireEvent.error(img)
    await waitFor(() => {
      expect(screen.queryByTestId('image-preview-poster')).toBeNull()
    })
    expect(screen.getByText(/预览加载失败/)).toBeDefined()
  })
})

describe('VideoImageSection — 改 URL 流程保留', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getMock.mockResolvedValue({ data: makeImagesData() })
    putMock.mockResolvedValue({})
  })

  it('点"改 URL" → input 显示 → 输入 URL + 保存 → 调 PUT /admin/videos/:id/images', async () => {
    render(<VideoImageSection videoId="vid-1" />)
    fireEvent.click(await screen.findByTestId('image-url-btn-poster'))
    const urlInput = await screen.findByPlaceholderText('https://...')
    fireEvent.change(urlInput, { target: { value: 'https://custom.example/img.jpg' } })
    fireEvent.click(screen.getByText('保存'))

    await waitFor(() => expect(putMock).toHaveBeenCalledTimes(1))
    expect(putMock.mock.calls[0][0]).toBe('/admin/videos/vid-1/images')
    expect(putMock.mock.calls[0][1]).toEqual({ kind: 'poster', url: 'https://custom.example/img.jpg' })
  })
})
