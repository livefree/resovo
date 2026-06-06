'use client'

/**
 * BannerDrawer.tsx — home_banners 创建/编辑 Drawer 表单
 * （CHG-HOME-BANNER-UNIFY-B / ADR-181 D-181-1）
 *
 * 职责：表单展示 + 本地状态 + 提交调用（onSave 由 BannerOpsSection 注入）。
 * 形态参照 HomeModuleDrawer；字段集对齐 /admin/banners CreateBannerSchema
 * （title 多语言 / imageUrl 必填 / linkType+linkTarget / 时间窗 / isActive / brand）。
 * imageUrl 尺寸·比例警告级校验归 Phase 2 CHG-HOME-IMAGE-GUARD-BANNER。
 */

import { useState, useEffect, type CSSProperties, type ChangeEvent, type FormEvent } from 'react'
import { Drawer, AdminButton, AdminInput, AdminSelect, type AdminSelectOption } from '@resovo/admin-ui'
import type { Banner, BannerBrandScope, BannerLinkType, CreateBannerInput, UpdateBannerInput } from '@/lib/banners/types'
// CHG-HOME-IMAGE-GUARD-BANNER / 方案 §6：横图警告级校验 + 安全区预览
import { BannerImageGuard } from './BannerImageGuard'

// ── 常量（与 HomeModuleDrawer 同规格）────────────────────────────

const LINK_TYPE_OPTIONS: readonly AdminSelectOption[] = [
  { value: 'external', label: '外部链接 (external)' },
  { value: 'video', label: '视频 (video)' },
]

const BRAND_SCOPE_OPTIONS: readonly AdminSelectOption[] = [
  { value: 'all-brands', label: '全品牌 (all-brands)' },
  { value: 'brand-specific', label: '指定品牌 (brand-specific)' },
]

const ACTIVE_OPTIONS: readonly AdminSelectOption[] = [
  { value: 'true', label: '启用' },
  { value: 'false', label: '停用' },
]

const FORM_STYLE: CSSProperties = { display: 'flex', flexDirection: 'column', gap: '14px' }
const FIELD_STYLE: CSSProperties = { display: 'flex', flexDirection: 'column', gap: '4px' }
const LABEL_STYLE: CSSProperties = { fontSize: 'var(--font-size-xs)', fontWeight: 500, color: 'var(--fg-default)' }
const ROW_STYLE: CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }

// datetime-local 原生 input（AdminInputType 不含该类型；视觉复刻 AdminInput md 规格，
// 先例 HomeModuleDrawer / SwitchDomainModal）
const DATETIME_INPUT_STYLE: CSSProperties = {
  height: '28px',
  padding: '0 10px',
  background: 'var(--bg-surface)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--fg-default)',
  fontSize: 'var(--font-size-xs)',
  fontFamily: 'inherit',
  boxSizing: 'border-box',
  width: '100%',
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

// ── 时间窗 datetime-local 对称往返 ────────────────────────────────
// 与 HomeModuleDrawer 同实现（CHG-HOME-UX-05 本地化对称往返，规避 v1 BannerForm
// `.slice(0,16)` 的时区漂移）；第 3 消费方出现时抽 lib 共享（共享规则 3 处）。

function isoToLocalInput(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function localInputToIso(local: string): string | null {
  if (!local) return null
  const d = new Date(local)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

/** title payload：仅非空键（与后端 BannerTitle 形态对齐） */
function buildTitlePayload(titleZh: string, titleEn: string): Record<string, string> {
  const title: Record<string, string> = {}
  if (titleZh.trim()) title['zh-CN'] = titleZh.trim()
  if (titleEn.trim()) title['en'] = titleEn.trim()
  return title
}

// ── 表单状态 ──────────────────────────────────────────────────────

interface BannerFormState {
  titleZh: string
  titleEn: string
  imageUrl: string
  linkType: BannerLinkType
  linkTarget: string
  activeFrom: string
  activeTo: string
  isActive: boolean
  brandScope: BannerBrandScope
  brandSlug: string
}

const EMPTY_FORM: BannerFormState = {
  titleZh: '',
  titleEn: '',
  imageUrl: '',
  linkType: 'external',
  linkTarget: '',
  activeFrom: '',
  activeTo: '',
  isActive: true,
  brandScope: 'all-brands',
  brandSlug: '',
}

function formFromBanner(banner: Banner): BannerFormState {
  return {
    titleZh: banner.title['zh-CN'] ?? '',
    titleEn: banner.title['en'] ?? '',
    imageUrl: banner.imageUrl,
    linkType: banner.linkType,
    linkTarget: banner.linkTarget,
    activeFrom: banner.activeFrom ? isoToLocalInput(banner.activeFrom) : '',
    activeTo: banner.activeTo ? isoToLocalInput(banner.activeTo) : '',
    isActive: banner.isActive,
    brandScope: banner.brandScope,
    brandSlug: banner.brandSlug ?? '',
  }
}

// ── Props ─────────────────────────────────────────────────────────

/** 创建模式预填集（CHG-HOME-AUTOFILL-UI：banner 候选 → 编辑器。
 *  imageUrl 刻意不在预填集——横版大图须人工提供，预填竖版封面会诱导误用（D-052-9 口径） */
export interface BannerPrefill {
  readonly titleZh?: string
  readonly linkType?: BannerLinkType
  readonly linkTarget?: string
}

export interface BannerDrawerProps {
  readonly open: boolean
  /** null = 创建模式 */
  readonly banner: Banner | null
  /** 创建模式（banner=null）打开时合并入空表单；编辑模式忽略 */
  readonly prefill?: BannerPrefill | null
  readonly onClose: () => void
  /** resolve 后由本组件关闭；reject 时展示错误条 */
  readonly onSave: (body: CreateBannerInput | UpdateBannerInput, id: string | null) => Promise<void>
}

// ── 组件 ─────────────────────────────────────────────────────────

export function BannerDrawer({ open, banner, prefill, onClose, onSave }: BannerDrawerProps) {
  const [form, setForm] = useState<BannerFormState>(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setForm(banner ? formFromBanner(banner) : { ...EMPTY_FORM, ...(prefill ?? {}) })
      setError(null)
    }
  }, [open, banner, prefill])

  function patch<K extends keyof BannerFormState>(key: K, value: BannerFormState[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!form.imageUrl.trim()) {
      setError('横版大图 URL 不能为空（home_banners 必填；推荐 1920×1080）')
      return
    }
    if (!form.linkTarget.trim()) {
      setError('链接目标不能为空')
      return
    }
    if (form.brandScope === 'brand-specific' && !form.brandSlug.trim()) {
      setError('指定品牌时必须填写品牌 slug')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const body: CreateBannerInput = {
        title: buildTitlePayload(form.titleZh, form.titleEn),
        imageUrl: form.imageUrl.trim(),
        linkType: form.linkType,
        linkTarget: form.linkTarget.trim(),
        activeFrom: localInputToIso(form.activeFrom),
        activeTo: localInputToIso(form.activeTo),
        isActive: form.isActive,
        brandScope: form.brandScope,
        brandSlug: form.brandScope === 'brand-specific' ? form.brandSlug.trim() : null,
      }
      await onSave(body, banner?.id ?? null)
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
      title={banner ? '编辑 Banner' : '新建 Banner'}
      width={440}
      data-testid="banner-drawer"
    >
      <form onSubmit={(e) => void handleSubmit(e)} style={FORM_STYLE}>
        {error && <div style={ERROR_STYLE} role="alert" data-testid="banner-drawer-error">{error}</div>}

        <div style={ROW_STYLE}>
          <div style={FIELD_STYLE}>
            <label style={LABEL_STYLE}>标题（中文）</label>
            <AdminInput
              value={form.titleZh}
              onChange={(e: ChangeEvent<HTMLInputElement>) => patch('titleZh', e.target.value)}
              placeholder="如：暑期动画专题"
              data-testid="banner-title-zh"
            />
          </div>
          <div style={FIELD_STYLE}>
            <label style={LABEL_STYLE}>标题（英文）</label>
            <AdminInput
              value={form.titleEn}
              onChange={(e: ChangeEvent<HTMLInputElement>) => patch('titleEn', e.target.value)}
              placeholder="e.g. Summer Special"
              data-testid="banner-title-en"
            />
          </div>
        </div>

        <div style={FIELD_STYLE}>
          <label style={LABEL_STYLE}>横版大图 URL *（推荐 1920×1080，最低 1280×720）</label>
          <AdminInput
            value={form.imageUrl}
            onChange={(e: ChangeEvent<HTMLInputElement>) => patch('imageUrl', e.target.value)}
            placeholder="https://cdn.example.com/banner.jpg"
            data-testid="banner-image-url"
          />
          {/* CHG-HOME-IMAGE-GUARD-BANNER / 方案 §6：尺寸/比例/探测警告级校验 +
              desktop/mobile 安全区预览——纯提示，handleSubmit 零拦截（D-052-9） */}
          <BannerImageGuard imageUrl={form.imageUrl} />
        </div>

        <div style={ROW_STYLE}>
          <div style={FIELD_STYLE}>
            <label style={LABEL_STYLE}>链接类型</label>
            <AdminSelect
              value={form.linkType}
              options={LINK_TYPE_OPTIONS}
              onChange={(v) => patch('linkType', (v ?? 'external') as BannerLinkType)}
              data-testid="banner-link-type"
            />
          </div>
          <div style={FIELD_STYLE}>
            <label style={LABEL_STYLE}>链接目标 *</label>
            <AdminInput
              value={form.linkTarget}
              onChange={(e: ChangeEvent<HTMLInputElement>) => patch('linkTarget', e.target.value)}
              placeholder={form.linkType === 'video' ? '视频 UUID' : 'https://…'}
              data-testid="banner-link-target"
            />
          </div>
        </div>

        <div style={ROW_STYLE}>
          <div style={FIELD_STYLE}>
            <label style={LABEL_STYLE}>生效时间（留空＝即时）</label>
            <input
              type="datetime-local"
              value={form.activeFrom}
              onChange={(e) => patch('activeFrom', e.target.value)}
              style={DATETIME_INPUT_STYLE}
              data-testid="banner-active-from"
            />
          </div>
          <div style={FIELD_STYLE}>
            <label style={LABEL_STYLE}>失效时间（留空＝永久）</label>
            <input
              type="datetime-local"
              value={form.activeTo}
              onChange={(e) => patch('activeTo', e.target.value)}
              style={DATETIME_INPUT_STYLE}
              data-testid="banner-active-to"
            />
          </div>
        </div>

        <div style={ROW_STYLE}>
          <div style={FIELD_STYLE}>
            <label style={LABEL_STYLE}>状态</label>
            <AdminSelect
              value={String(form.isActive)}
              options={ACTIVE_OPTIONS}
              onChange={(v) => patch('isActive', (v ?? 'true') === 'true')}
              data-testid="banner-is-active"
            />
          </div>
          <div style={FIELD_STYLE}>
            <label style={LABEL_STYLE}>品牌作用域</label>
            <AdminSelect
              value={form.brandScope}
              options={BRAND_SCOPE_OPTIONS}
              onChange={(v) => patch('brandScope', (v ?? 'all-brands') as BannerBrandScope)}
              data-testid="banner-brand-scope"
            />
          </div>
        </div>

        {form.brandScope === 'brand-specific' && (
          <div style={FIELD_STYLE}>
            <label style={LABEL_STYLE}>品牌 slug *</label>
            <AdminInput
              value={form.brandSlug}
              onChange={(e: ChangeEvent<HTMLInputElement>) => patch('brandSlug', e.target.value)}
              placeholder="如：alpha"
              data-testid="banner-brand-slug"
            />
          </div>
        )}

        <div style={FOOTER_STYLE}>
          <AdminButton variant="ghost" size="sm" onClick={onClose} data-testid="banner-drawer-cancel">
            取消
          </AdminButton>
          <AdminButton
            variant="primary"
            size="sm"
            type="submit"
            loading={submitting}
            data-testid="banner-drawer-submit"
          >
            {banner ? '保存' : '创建'}
          </AdminButton>
        </div>
      </form>
    </Drawer>
  )
}
