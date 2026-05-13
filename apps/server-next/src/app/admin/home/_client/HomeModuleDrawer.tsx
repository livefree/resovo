'use client'

/**
 * HomeModuleDrawer.tsx — 运营位模块创建/编辑 Drawer 表单（CHG-SN-5-07）
 *
 * 职责：展示表单（所有字段）+ 本地状态管理 + 提交调用
 */

import { useState, useEffect, type CSSProperties, type ChangeEvent, type FormEvent } from 'react'
import { Drawer, AdminButton, AdminInput, AdminSelect, type AdminSelectOption } from '@resovo/admin-ui'
import type {
  HomeModule,
  HomeModuleSlot,
  HomeModuleContentRefType,
  HomeBrandScope,
  CreateHomeModuleBody,
  UpdateHomeModuleBody,
} from '@/lib/home-modules/types'

// ── 常量 ─────────────────────────────────────────────────────────

const SLOT_OPTIONS: readonly AdminSelectOption[] = [
  { value: 'banner', label: '轮播广告 (banner)' },
  { value: 'featured', label: '精选推荐 (featured)' },
  { value: 'top10', label: 'TOP 10' },
  { value: 'type_shortcuts', label: '类型快捷方式 (type_shortcuts)' },
]

const BRAND_SCOPE_OPTIONS: readonly AdminSelectOption[] = [
  { value: 'all-brands', label: '全品牌 (all-brands)' },
  { value: 'brand-specific', label: '指定品牌 (brand-specific)' },
]

const SLOT_CONTENT_REF_TYPES: Record<HomeModuleSlot, readonly HomeModuleContentRefType[]> = {
  banner: ['video', 'external_url', 'custom_html'],
  featured: ['video'],
  top10: ['video'],
  type_shortcuts: ['video_type'],
}

const CONTENT_REF_TYPE_LABELS: Record<HomeModuleContentRefType, string> = {
  video: '视频 (video)',
  external_url: '外部链接 (external_url)',
  custom_html: '自定义 HTML (custom_html)',
  video_type: '视频类型 (video_type)',
}

const FORM_STYLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '14px',
}

const FIELD_STYLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
}

const LABEL_STYLE: CSSProperties = {
  fontSize: 'var(--font-size-xs)',
  fontWeight: 500,
  color: 'var(--fg-default)',
}

const HINT_STYLE: CSSProperties = {
  fontSize: 'var(--font-size-2xs)',
  color: 'var(--fg-muted)',
}

const ROW_STYLE: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '10px',
}

const FOOTER_STYLE: CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: '8px',
  paddingTop: '16px',
  borderTop: '1px solid var(--border-subtle)',
  marginTop: '4px',
}

const ERROR_STYLE: CSSProperties = {
  fontSize: 'var(--font-size-xs)',
  color: 'var(--state-error-fg)',
  padding: '8px 12px',
  background: 'var(--state-error-bg)',
  borderRadius: 'var(--radius-sm)',
}

// ── 表单默认值 ────────────────────────────────────────────────────

interface FormState {
  slot: HomeModuleSlot
  brandScope: HomeBrandScope
  brandSlug: string
  ordering: string
  contentRefType: HomeModuleContentRefType
  contentRefId: string
  startAt: string
  endAt: string
}

function moduleToForm(module: HomeModule | null, defaultSlot: HomeModuleSlot): FormState {
  if (!module) {
    return {
      slot: defaultSlot,
      brandScope: 'all-brands',
      brandSlug: '',
      ordering: '0',
      contentRefType: SLOT_CONTENT_REF_TYPES[defaultSlot][0],
      contentRefId: '',
      startAt: '',
      endAt: '',
    }
  }
  return {
    slot: module.slot,
    brandScope: module.brandScope,
    brandSlug: module.brandSlug ?? '',
    ordering: String(module.ordering),
    contentRefType: module.contentRefType,
    contentRefId: module.contentRefId,
    startAt: module.startAt ?? '',
    endAt: module.endAt ?? '',
  }
}

// ── Props ─────────────────────────────────────────────────────────

export interface HomeModuleDrawerProps {
  readonly open: boolean
  readonly module: HomeModule | null
  readonly defaultSlot: HomeModuleSlot
  readonly onClose: () => void
  readonly onSave: (data: CreateHomeModuleBody | UpdateHomeModuleBody, id: string | null) => Promise<void>
}

// ── 组件 ─────────────────────────────────────────────────────────

export function HomeModuleDrawer({ open, module, defaultSlot, onClose, onSave }: HomeModuleDrawerProps) {
  const [form, setForm] = useState<FormState>(() => moduleToForm(module, defaultSlot))
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setForm(moduleToForm(module, defaultSlot))
      setError(null)
    }
  }, [open, module, defaultSlot])

  const contentRefTypeOptions: readonly AdminSelectOption[] = SLOT_CONTENT_REF_TYPES[form.slot].map(t => ({
    value: t,
    label: CONTENT_REF_TYPE_LABELS[t],
  }))

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(prev => {
      const next = { ...prev, [key]: value }
      if (key === 'slot') {
        const allowedTypes = SLOT_CONTENT_REF_TYPES[value as HomeModuleSlot]
        if (!allowedTypes.includes(next.contentRefType)) {
          next.contentRefType = allowedTypes[0]
        }
      }
      return next
    })
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!form.contentRefId.trim()) {
      setError('内容引用 ID 不能为空')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const body: CreateHomeModuleBody = {
        slot: form.slot,
        brandScope: form.brandScope,
        brandSlug: form.brandScope === 'brand-specific' ? (form.brandSlug || null) : null,
        ordering: parseInt(form.ordering, 10) || 0,
        contentRefType: form.contentRefType,
        contentRefId: form.contentRefId.trim(),
        startAt: form.startAt || null,
        endAt: form.endAt || null,
      }
      await onSave(body, module?.id ?? null)
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '操作失败，请稍后重试')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Drawer
      open={open}
      placement="right"
      onClose={onClose}
      title={module ? '编辑运营位模块' : '新建运营位模块'}
      width={440}
      data-testid="home-module-drawer"
    >
      <form onSubmit={(e) => void handleSubmit(e)} style={FORM_STYLE}>
        {error && <div style={ERROR_STYLE} role="alert">{error}</div>}

        <div style={FIELD_STYLE}>
          <label style={LABEL_STYLE}>运营位 (slot)</label>
          <AdminSelect
            options={SLOT_OPTIONS as AdminSelectOption[]}
            value={form.slot}
            onChange={(v) => setField('slot', (v ?? defaultSlot) as HomeModuleSlot)}
            size="md"
            data-testid="drawer-slot"
            aria-label="运营位类型"
          />
        </div>

        <div style={FIELD_STYLE}>
          <label style={LABEL_STYLE}>品牌作用域</label>
          <AdminSelect
            options={BRAND_SCOPE_OPTIONS as AdminSelectOption[]}
            value={form.brandScope}
            onChange={(v) => setField('brandScope', (v ?? 'all-brands') as HomeBrandScope)}
            size="md"
            data-testid="drawer-brand-scope"
            aria-label="品牌作用域"
          />
        </div>

        {form.brandScope === 'brand-specific' && (
          <div style={FIELD_STYLE}>
            <label style={LABEL_STYLE}>品牌 Slug</label>
            <AdminInput
              type="text"
              value={form.brandSlug}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setField('brandSlug', e.target.value)}
              placeholder="例如：resovo"
              size="md"
              data-testid="drawer-brand-slug"
              aria-label="品牌 Slug"
            />
          </div>
        )}

        <div style={FIELD_STYLE}>
          <label style={LABEL_STYLE}>内容类型</label>
          <AdminSelect
            options={contentRefTypeOptions as AdminSelectOption[]}
            value={form.contentRefType}
            onChange={(v) => setField('contentRefType', (v ?? form.contentRefType) as HomeModuleContentRefType)}
            size="md"
            data-testid="drawer-content-ref-type"
            aria-label="内容类型"
          />
        </div>

        <div style={FIELD_STYLE}>
          <label style={LABEL_STYLE}>内容引用 ID *</label>
          <AdminInput
            type="text"
            value={form.contentRefId}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setField('contentRefId', e.target.value)}
            placeholder="视频 ID / URL / HTML ID / 类型枚举值"
            size="md"
            required
            data-testid="drawer-content-ref-id"
            aria-label="内容引用 ID"
          />
          <span style={HINT_STYLE}>
            {form.contentRefType === 'video' && '填写 videos.id'}
            {form.contentRefType === 'external_url' && '填写完整 URL'}
            {form.contentRefType === 'custom_html' && '填写 sanitized HTML 片段 ID'}
            {form.contentRefType === 'video_type' && '填写 VideoType 枚举值（如 movie）'}
          </span>
        </div>

        <div style={FIELD_STYLE}>
          <label style={LABEL_STYLE}>排序权重</label>
          <AdminInput
            type="number"
            value={form.ordering}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setField('ordering', e.target.value)}
            placeholder="0"
            size="md"
            data-testid="drawer-ordering"
            aria-label="排序权重"
          />
        </div>

        <div style={ROW_STYLE}>
          <div style={FIELD_STYLE}>
            <label style={LABEL_STYLE}>生效开始时间</label>
            <AdminInput
              type="text"
              value={form.startAt}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setField('startAt', e.target.value)}
              placeholder="ISO 8601（留空=立即）"
              size="md"
              data-testid="drawer-start-at"
              aria-label="生效开始时间"
            />
          </div>
          <div style={FIELD_STYLE}>
            <label style={LABEL_STYLE}>生效结束时间</label>
            <AdminInput
              type="text"
              value={form.endAt}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setField('endAt', e.target.value)}
              placeholder="ISO 8601（留空=永久）"
              size="md"
              data-testid="drawer-end-at"
              aria-label="生效结束时间"
            />
          </div>
        </div>

        <div style={FOOTER_STYLE}>
          <AdminButton variant="ghost" size="md" type="button" onClick={onClose} disabled={submitting}>
            取消
          </AdminButton>
          <AdminButton variant="primary" size="md" type="submit" loading={submitting} data-testid="drawer-submit">
            {module ? '保存' : '创建'}
          </AdminButton>
        </div>
      </form>
    </Drawer>
  )
}
