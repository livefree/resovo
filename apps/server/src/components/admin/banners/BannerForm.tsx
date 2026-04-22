'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiClient } from '@/lib/api-client'
import { notify } from '@/components/admin/shared/toast/useAdminToast'
import { AdminInput } from '@/components/admin/shared/form/AdminInput'
import { AdminSelect } from '@/components/admin/shared/form/AdminSelect'
import { AdminFormField } from '@/components/admin/shared/form/AdminFormField'
import { AdminFormActions } from '@/components/admin/shared/form/AdminFormActions'
import { AdminButton } from '@/components/admin/shared/button/AdminButton'
import type { Banner, CreateBannerInput, UpdateBannerInput } from '@resovo/types'

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
  const [form, setForm] = useState<FormState>(() => toFormState(initial))
  const [saving, setSaving] = useState(false)

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

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

      {/* 图片 */}
      <AdminFormField label="图片地址 *">
        <AdminInput
          value={form.imageUrl}
          onChange={(v) => set('imageUrl', v)}
          placeholder="https://cdn.example.com/banner.jpg"
        />
        {form.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={form.imageUrl}
            alt="预览"
            className="mt-2 h-24 rounded-md object-cover border border-[var(--border)]"
            data-testid="banner-image-preview"
          />
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
