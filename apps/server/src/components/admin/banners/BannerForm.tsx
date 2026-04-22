'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiClient } from '@/lib/api-client'
import { notify } from '@/components/admin/shared/toast/useAdminToast'
import { AdminInput } from '@/components/admin/shared/form/AdminInput'
import { AdminSelect } from '@/components/admin/shared/form/AdminSelect'
import { AdminFormField } from '@/components/admin/shared/form/AdminFormField'
import { AdminFormActions } from '@/components/admin/shared/form/AdminFormActions'
import { AdminButton } from '@/components/admin/shared/button/AdminButton'
import type { Banner, CreateBannerInput, UpdateBannerInput } from '@resovo/types'

// IMG-08: 上传契约对齐 ImageStorageService
const ACCEPTED_MIMETYPES = 'image/jpeg,image/png,image/webp,image/avif,image/gif'
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024

function formatUploadError(err: unknown): string {
  if (err instanceof Error) {
    const msg = err.message
    if (msg.includes('PAYLOAD_TOO_LARGE') || msg.includes('413')) return '图片超过 5MB'
    if (msg.includes('UNSUPPORTED_MEDIA_TYPE') || msg.includes('415')) return '仅支持 JPEG / PNG / WebP / AVIF / GIF'
    if (msg.includes('STORAGE_NOT_CONFIGURED') || msg.includes('503')) return '服务端存储未配置'
    if (msg.includes('OWNER_NOT_FOUND') || msg.includes('404')) return 'Banner 不存在'
    return msg
  }
  return '上传失败'
}

interface UploadResponse {
  data: {
    url: string
    key: string
    kind: string
    contentType: string
    size: number
    hash: string
    blurhashJobId: string | null
    provider: 'r2' | 'local-fs'
  }
}

// ── 类型 ─────────────────────────────────────────────────────────────────────

export interface BannerFormProps {
  /** 编辑模式传入；新建模式为 undefined */
  initial?: Banner
}

interface FormState {
  titleZh: string
  titleEn: string
  imageUrl: string
  linkType: 'video' | 'external'
  linkTarget: string
  sortOrder: string
  activeFrom: string
  activeTo: string
  isActive: boolean
  brandScope: 'all-brands' | 'brand-specific'
  brandSlug: string
}

function toFormState(banner?: Banner): FormState {
  return {
    titleZh: banner?.title?.['zh-CN'] ?? '',
    titleEn: banner?.title?.['en'] ?? '',
    imageUrl: banner?.imageUrl ?? '',
    linkType: banner?.linkType ?? 'external',
    linkTarget: banner?.linkTarget ?? '',
    sortOrder: String(banner?.sortOrder ?? 0),
    activeFrom: banner?.activeFrom ? banner.activeFrom.slice(0, 16) : '',
    activeTo: banner?.activeTo ? banner.activeTo.slice(0, 16) : '',
    isActive: banner?.isActive ?? true,
    brandScope: banner?.brandScope ?? 'all-brands',
    brandSlug: banner?.brandSlug ?? '',
  }
}

function formStateToPayload(state: FormState): CreateBannerInput | UpdateBannerInput {
  const title: Record<string, string> = {}
  if (state.titleZh) title['zh-CN'] = state.titleZh
  if (state.titleEn) title['en'] = state.titleEn

  return {
    title,
    imageUrl: state.imageUrl,
    linkType: state.linkType,
    linkTarget: state.linkTarget,
    sortOrder: parseInt(state.sortOrder, 10) || 0,
    activeFrom: state.activeFrom ? new Date(state.activeFrom).toISOString() : null,
    activeTo: state.activeTo ? new Date(state.activeTo).toISOString() : null,
    isActive: state.isActive,
    brandScope: state.brandScope,
    brandSlug: state.brandScope === 'brand-specific' ? (state.brandSlug || null) : null,
  }
}

// ── 组件 ─────────────────────────────────────────────────────────────────────

export function BannerForm({ initial }: BannerFormProps) {
  const router = useRouter()
  const isEdit = !!initial
  const bannerId = initial?.id ?? null
  const [form, setForm] = useState<FormState>(() => toFormState(initial))
  const [saving, setSaving] = useState(false)
  // IMG-08 上传状态
  const [uploading, setUploading] = useState(false)
  const [uploadPercent, setUploadPercent] = useState<number | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [imgBroken, setImgBroken] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  // imageUrl 变化时重置破图
  useEffect(() => { setImgBroken(false) }, [form.imageUrl])

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!bannerId) return // 编辑模式才会显示按钮，不应到这里
    if (file.size > MAX_UPLOAD_BYTES) { setUploadError('图片超过 5MB'); return }
    if (file.type && !ACCEPTED_MIMETYPES.split(',').includes(file.type)) {
      setUploadError('仅支持 JPEG / PNG / WebP / AVIF / GIF'); return
    }
    setUploading(true)
    setUploadPercent(null)
    setUploadError(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('ownerType', 'banner')
      fd.append('ownerId', bannerId)
      const res = await apiClient.uploadWithProgress<UploadResponse>(
        '/admin/media/images',
        fd,
        { onProgress: ({ percent }) => { if (percent !== null) setUploadPercent(percent) } },
      )
      // 上传成功：后端 MediaImageService 已写 home_banners.image_url，这里同步本地 form state
      set('imageUrl', res.data.url)
      notify.success('图片已上传')
    } catch (err) {
      setUploadError(formatUploadError(err))
    } finally {
      setUploading(false)
      setUploadPercent(null)
    }
  }

  function triggerFilePicker() { fileInputRef.current?.click() }
  function openPreviewDialog() { dialogRef.current?.showModal() }
  function closePreviewDialog() { dialogRef.current?.close() }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.imageUrl) { notify.error('图片地址不能为空'); return }
    if (!form.linkTarget) { notify.error('跳转目标不能为空'); return }
    if (form.brandScope === 'brand-specific' && !form.brandSlug) {
      notify.error('品牌专属模式下品牌标识不能为空')
      return
    }

    setSaving(true)
    try {
      const payload = formStateToPayload(form)
      if (isEdit && initial) {
        await apiClient.put(`/admin/banners/${initial.id}`, payload)
        notify.success('Banner 已更新')
      } else {
        await apiClient.post('/admin/banners', payload)
        notify.success('Banner 已创建')
      }
      router.push('/admin/banners')
      router.refresh()
    } catch (err) {
      const msg = err instanceof Error ? err.message : '保存失败'
      notify.error(msg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} data-testid="banner-form" className="space-y-5 max-w-2xl">

      {/* 标题（多语言） */}
      <AdminFormField label="标题（中文）*">
        <AdminInput
          value={form.titleZh}
          onChange={(v) => set('titleZh', v)}
          placeholder="zh-CN 标题"
        />
      </AdminFormField>
      <AdminFormField label="标题（英文）">
        <AdminInput
          value={form.titleEn}
          onChange={(v) => set('titleEn', v)}
          placeholder="en 标题（可选）"
        />
      </AdminFormField>

      {/* 图片（IMG-08: 编辑模式接上传 + 16:9 预览 + 点击放大） */}
      <AdminFormField label="图片地址 *">
        <AdminInput
          value={form.imageUrl}
          onChange={(v) => set('imageUrl', v)}
          placeholder="https://cdn.example.com/banner.jpg"
        />

        {/* 预览 */}
        {form.imageUrl && !imgBroken && (
          <div className="mt-2 space-y-1">
            <button
              type="button"
              onClick={openPreviewDialog}
              className="cursor-zoom-in border-0 p-0 bg-transparent block"
              data-testid="banner-image-preview-trigger"
              aria-label="放大查看 Banner 图片"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={form.imageUrl}
                alt="预览"
                style={{
                  height: 100,
                  aspectRatio: '16 / 9',
                  objectFit: 'cover',
                  background: 'var(--bg3)',
                  borderRadius: 6,
                  border: '1px solid var(--border)',
                  display: 'block',
                }}
                onError={() => setImgBroken(true)}
                data-testid="banner-image-preview"
              />
            </button>
            {/* 放大弹层 */}
            <dialog
              ref={dialogRef}
              onClick={(e) => { if (e.target === dialogRef.current) closePreviewDialog() }}
              className="p-0 rounded"
              style={{
                border: '1px solid var(--border)',
                background: 'var(--bg2)',
                maxWidth: '90vw',
                maxHeight: '90vh',
              }}
              data-testid="banner-image-preview-dialog"
            >
              <div className="p-4 space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>
                    Banner 图片预览
                  </span>
                  <button
                    type="button"
                    onClick={closePreviewDialog}
                    className="rounded border px-2 py-1 text-xs"
                    style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}
                    data-testid="banner-image-preview-close"
                  >
                    关闭 (Esc)
                  </button>
                </div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={form.imageUrl}
                  alt="Banner 原图"
                  style={{
                    maxWidth: 'min(90vw - 2rem, 1200px)',
                    maxHeight: 'calc(90vh - 5rem)',
                    objectFit: 'contain',
                    background: 'var(--bg3)',
                    borderRadius: 4,
                    display: 'block',
                  }}
                />
                <p
                  className="break-all text-xs"
                  style={{ color: 'var(--muted)' }}
                >
                  {form.imageUrl}
                </p>
              </div>
            </dialog>
          </div>
        )}

        {form.imageUrl && imgBroken && (
          <div className="mt-2 space-y-1">
            <p className="text-xs" style={{ color: 'var(--status-danger)' }}>
              ⚠ 预览加载失败
            </p>
          </div>
        )}

        {/* 上传控件：编辑模式才显示（新建无 bannerId） */}
        {isEdit ? (
          <div className="mt-2 space-y-2">
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_MIMETYPES}
              onChange={(e) => { void handleFileChange(e) }}
              style={{ display: 'none' }}
              data-testid="banner-image-file-input"
            />
            {uploadError && (
              <p className="text-xs" style={{ color: 'var(--status-danger)' }} data-testid="banner-image-upload-error">
                {uploadError}
              </p>
            )}
            <div className="flex items-center gap-2">
              <AdminButton
                type="button"
                variant="secondary"
                disabled={uploading || saving}
                onClick={triggerFilePicker}
                data-testid="banner-image-upload-btn"
              >
                {uploading
                  ? uploadPercent !== null
                    ? `上传中 ${uploadPercent}%`
                    : '上传中…'
                  : '上传新图'}
              </AdminButton>
              {uploading && uploadPercent !== null && (
                <div
                  className="flex-1 min-w-[6rem] h-1 rounded overflow-hidden"
                  style={{ background: 'var(--bg3)' }}
                  data-testid="banner-image-upload-progress"
                  role="progressbar"
                  aria-valuenow={uploadPercent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Banner 图片上传进度"
                >
                  <div
                    style={{
                      width: `${uploadPercent}%`,
                      height: '100%',
                      background: 'var(--accent)',
                      transition: 'width 0.15s linear',
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        ) : (
          <p
            className="mt-2 text-xs"
            style={{ color: 'var(--muted)' }}
            data-testid="banner-image-upload-hint"
          >
            新建 Banner 时需先填写外链地址；保存后可在编辑页上传图片
          </p>
        )}
      </AdminFormField>

      {/* 链接类型 */}
      <AdminFormField label="链接类型 *">
        <AdminSelect
          value={form.linkType}
          onChange={(v) => set('linkType', v as 'video' | 'external')}
          options={[
            { value: 'video', label: '站内视频' },
            { value: 'external', label: '外部链接' },
          ]}
        />
      </AdminFormField>

      {/* 跳转目标 */}
      <AdminFormField
        label={form.linkType === 'video' ? '视频 short_id *' : '外部 URL *'}
      >
        <AdminInput
          value={form.linkTarget}
          onChange={(v) => set('linkTarget', v)}
          placeholder={form.linkType === 'video' ? '如 mv-spring-2026' : 'https://example.com'}
        />
      </AdminFormField>

      {/* 排序序号 */}
      <AdminFormField label="排序序号">
        <AdminInput
          type="number"
          value={form.sortOrder}
          onChange={(v) => set('sortOrder', v)}
          placeholder="0"
        />
      </AdminFormField>

      {/* 时间窗 */}
      <AdminFormField label="生效开始时间">
        <AdminInput
          type="datetime-local"
          value={form.activeFrom}
          onChange={(v) => set('activeFrom', v)}
        />
      </AdminFormField>
      <AdminFormField label="生效结束时间">
        <AdminInput
          type="datetime-local"
          value={form.activeTo}
          onChange={(v) => set('activeTo', v)}
        />
      </AdminFormField>

      {/* 启用状态 */}
      <AdminFormField label="启用">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={(e) => set('isActive', e.target.checked)}
            data-testid="banner-is-active"
            className="h-4 w-4 accent-[var(--accent)]"
          />
          <span className="text-sm text-[var(--text)]">启用此 Banner</span>
        </label>
      </AdminFormField>

      {/* 品牌范围 */}
      <AdminFormField label="品牌范围">
        <AdminSelect
          value={form.brandScope}
          onChange={(v) => set('brandScope', v as 'all-brands' | 'brand-specific')}
          options={[
            { value: 'all-brands', label: '所有品牌' },
            { value: 'brand-specific', label: '指定品牌' },
          ]}
        />
      </AdminFormField>

      {form.brandScope === 'brand-specific' && (
        <AdminFormField label="品牌标识 (slug) *">
          <AdminInput
            value={form.brandSlug}
            onChange={(v) => set('brandSlug', v)}
            placeholder="如 alpha"
          />
        </AdminFormField>
      )}

      <AdminFormActions>
        <AdminButton
          type="button"
          variant="secondary"
          onClick={() => router.push('/admin/banners')}
          disabled={saving}
        >
          取消
        </AdminButton>
        <AdminButton
          type="submit"
          variant="primary"
          disabled={saving}
          data-testid="banner-form-submit"
        >
          {saving ? '保存中…' : isEdit ? '保存更改' : '创建 Banner'}
        </AdminButton>
      </AdminFormActions>
    </form>
  )
}
