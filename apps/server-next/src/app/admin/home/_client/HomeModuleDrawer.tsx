'use client'

/**
 * HomeModuleDrawer.tsx — 运营位模块创建/编辑 Drawer 表单（CHG-SN-5-07）
 *
 * 职责：展示表单（所有字段）+ 本地状态管理 + 提交调用
 */

import { useState, useEffect, useRef, type CSSProperties, type ChangeEvent, type FormEvent } from 'react'
import {
  Drawer,
  AdminButton,
  AdminInput,
  AdminSelect,
  ContentRefPicker,
  getVideoTypeOptions,
  type AdminSelectOption,
} from '@resovo/admin-ui'
import { videoPickerFetcher, fetchPickerItemByIdSafe } from '@/lib/videos/picker-fetcher'
import type {
  HomeModule,
  HomeModuleSlot,
  HomeModuleContentRefType,
  HomeBrandScope,
  CreateHomeModuleBody,
  UpdateHomeModuleBody,
} from '@/lib/home-modules/types'
import { ModuleImageField } from './ModuleImageField'

// ── 常量 ─────────────────────────────────────────────────────────

// CHG-HOME-BANNER-UNIFY-B 顺带修复 SLOT-EXTEND 遗漏：+3 hot slot（数组非 Record，
// 编译不强制故漏检；ADR-181 D-181-4）。banner 项保留供存量行编辑回显（Create 已被
// service 冻结拒绝，D-181-1.2(a)）。
const SLOT_OPTIONS: readonly AdminSelectOption[] = [
  { value: 'banner', label: '轮播广告 (banner)' },
  { value: 'featured', label: '精选推荐 (featured)' },
  { value: 'top10', label: 'TOP 10' },
  { value: 'type_shortcuts', label: '类型快捷方式 (type_shortcuts)' },
  { value: 'hot_movies', label: '热门电影 (hot_movies)' },
  { value: 'hot_series', label: '热播剧集 (hot_series)' },
  { value: 'hot_anime', label: '热门动漫 (hot_anime)' },
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
  // ADR-181 D-181-4：hot slot 仅 video（与 migration 094 CHECK + Service compat 同源）
  hot_movies: ['video'],
  hot_series: ['video'],
  hot_anime: ['video'],
}

const CONTENT_REF_TYPE_LABELS: Record<HomeModuleContentRefType, string> = {
  video: '视频 (video)',
  external_url: '外部链接 (external_url)',
  custom_html: '自定义 HTML (custom_html)',
  video_type: '视频类型 (video_type)',
}

// CHG-SN-8-FUP-HOME：注入给 ContentRefPicker 当 type='video_type' 时使用
// CHG-341：从 admin-ui getVideoTypeOptions 派生；保留"label (value)" 风格（admin debug 场景看 raw value）
const VIDEO_TYPE_OPTIONS: readonly AdminSelectOption[] = getVideoTypeOptions().map((o) => ({
  value: o.value,
  label: `${String(o.label)} (${o.value})`,
}))

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

// datetime-local 原生 input（AdminInputType 不含该类型；不为单消费点扩共享契约，
// 视觉复刻 AdminInput md 规格；先例 SwitchDomainModal 原生 input）
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

// ── 时间窗 datetime-local 往返（CHG-HOME-UX-05）────────────────────
//
// 偏离登记：不移植 v1 BannerForm `.slice(0,16)` 显示模式——该模式对 UTC ISO 直接
// 切片显示（UTC 时刻）但 datetime-local 值按本地时区解析提交，非 UTC+0 时区下
// 「编辑不动直接保存」会产生时差漂移。改为本地化对称往返：
//   显示：UTC ISO → new Date() → 本地 YYYY-MM-DDTHH:mm
//   提交：本地值 → new Date()（按本地解析）→ toISOString()（UTC）

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

/** title payload：仅非空键（'{}' 形态与后端 default 对齐） */
function buildTitlePayload(titleZh: string, titleEn: string): Record<string, string> {
  const title: Record<string, string> = {}
  if (titleZh.trim()) title['zh-CN'] = titleZh.trim()
  if (titleEn.trim()) title['en'] = titleEn.trim()
  return title
}

// ── 表单默认值 ────────────────────────────────────────────────────

interface FormState {
  slot: HomeModuleSlot
  brandScope: HomeBrandScope
  brandSlug: string
  ordering: string
  contentRefType: HomeModuleContentRefType
  contentRefId: string
  titleZh: string
  titleEn: string
  imageUrl: string
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
      titleZh: '',
      titleEn: '',
      imageUrl: '',
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
    titleZh: module.title['zh-CN'] ?? '',
    titleEn: module.title['en'] ?? '',
    imageUrl: module.imageUrl ?? '',
    startAt: module.startAt ? isoToLocalInput(module.startAt) : '',
    endAt: module.endAt ? isoToLocalInput(module.endAt) : '',
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
  // CHG-HOME-UX-05 auto-fill：记录由 auto-fill 写入的值（type/选片切换时只清未被用户改动的预填）
  const autoFilledRef = useRef<{ titleZh?: string; imageUrl?: string }>({})

  useEffect(() => {
    if (open) {
      setForm(moduleToForm(module, defaultSlot))
      setError(null)
      autoFilledRef.current = {}
    }
  }, [open, module, defaultSlot])

  const contentRefTypeOptions: readonly AdminSelectOption[] = SLOT_CONTENT_REF_TYPES[form.slot].map(t => ({
    value: t,
    label: CONTENT_REF_TYPE_LABELS[t],
  }))

  /** auto-fill 残留清理：仅清「值仍等于 auto-fill 写入值」的字段（用户手改过的保留） */
  function clearAutoFilled(next: FormState) {
    if (autoFilledRef.current.titleZh !== undefined && next.titleZh === autoFilledRef.current.titleZh) {
      next.titleZh = ''
    }
    if (autoFilledRef.current.imageUrl !== undefined && next.imageUrl === autoFilledRef.current.imageUrl) {
      next.imageUrl = ''
    }
    autoFilledRef.current = {}
  }

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(prev => {
      const next = { ...prev, [key]: value }
      if (key === 'slot') {
        const allowedTypes = SLOT_CONTENT_REF_TYPES[value as HomeModuleSlot]
        if (!allowedTypes.includes(next.contentRefType)) {
          next.contentRefType = allowedTypes[0]
          // CHG-SN-8-FUP-HOME：type 切换时同步 reset contentRefId（Opus 评审建议 2）
          next.contentRefId = ''
          clearAutoFilled(next)
        }
      }
      if (key === 'contentRefType') {
        // CHG-SN-8-FUP-HOME：type 切换时同步 reset contentRefId（Opus 评审建议 2）
        next.contentRefId = ''
        // CHG-HOME-UX-05：auto-fill 残留随 type 切走清理（不动用户手填值）
        clearAutoFilled(next)
      }
      return next
    })
  }

  // ── CHG-HOME-UX-05 auto-fill：video 选中后预填空字段（D-104-10）────
  //
  // 走 drawer 端 fetchPickerItemByIdSafe（不扩 ContentRefPicker onChange 共享契约）；
  // 仅在对应字段为空时预填，不覆盖用户已填值；竞态守卫 = 应用前比对当前选中 id。
  function handleContentRefChange(next: string) {
    setField('contentRefId', next)
    if (form.contentRefType !== 'video' || !next.trim()) return
    void fetchPickerItemByIdSafe(next.trim()).then((item) => {
      if (!item) return
      setForm(prev => {
        // 竞态守卫：用户已换选/清空则放弃本次预填
        if (prev.contentRefId !== next || prev.contentRefType !== 'video') return prev
        const updated = { ...prev }
        if (!prev.titleZh.trim()) {
          updated.titleZh = item.title
          autoFilledRef.current.titleZh = item.title
        }
        if (!prev.imageUrl.trim() && item.coverUrl) {
          updated.imageUrl = item.coverUrl
          autoFilledRef.current.imageUrl = item.coverUrl
        }
        return updated
      })
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
        title: buildTitlePayload(form.titleZh, form.titleEn),
        imageUrl: form.imageUrl.trim() || null,
        startAt: localInputToIso(form.startAt),
        endAt: localInputToIso(form.endAt),
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
          {/* CHG-SN-8-FUP-HOME：用 ContentRefPicker 替代原单 input + 4 类型 hint 反人类填法
              CHG-HOME-UX-05：onChange 接 auto-fill（video 选中预填空标题/横图） */}
          <ContentRefPicker
            label="内容引用 *"
            type={form.contentRefType}
            value={form.contentRefId}
            onChange={handleContentRefChange}
            videoFetcher={videoPickerFetcher}
            videoTypeOptions={VIDEO_TYPE_OPTIONS}
            required
            data-testid="drawer-content-ref-id"
          />
        </div>

        {/* CHG-HOME-UX-05：多语言标题（D-104-9；空键不传，前台/卡片走降级链） */}
        <div style={ROW_STYLE}>
          <div style={FIELD_STYLE}>
            <label style={LABEL_STYLE}>标题（中文）</label>
            <AdminInput
              type="text"
              value={form.titleZh}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setField('titleZh', e.target.value)}
              placeholder="留空＝video 用视频标题"
              size="md"
              data-testid="drawer-title-zh"
              aria-label="标题（中文）"
            />
          </div>
          <div style={FIELD_STYLE}>
            <label style={LABEL_STYLE}>标题（English）</label>
            <AdminInput
              type="text"
              value={form.titleEn}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setField('titleEn', e.target.value)}
              placeholder="可选"
              size="md"
              data-testid="drawer-title-en"
              aria-label="标题（English）"
            />
          </div>
        </div>

        {/* CHG-HOME-UX-05：运营横图（外链 + 编辑态上传 + 16:9 预览） */}
        <ModuleImageField
          value={form.imageUrl}
          onChange={(next) => setField('imageUrl', next)}
          moduleId={module?.id ?? null}
        />

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

        {/* CHG-HOME-UX-05：裸 ISO 文本 → datetime-local（本地化对称往返，见 isoToLocalInput）
            原生 input：AdminInputType 不含 datetime-local，不为单消费点扩共享契约 */}
        <div style={ROW_STYLE}>
          <div style={FIELD_STYLE}>
            <label style={LABEL_STYLE}>生效开始时间（留空＝立即）</label>
            <input
              type="datetime-local"
              value={form.startAt}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setField('startAt', e.target.value)}
              style={DATETIME_INPUT_STYLE}
              data-testid="drawer-start-at"
              aria-label="生效开始时间"
            />
          </div>
          <div style={FIELD_STYLE}>
            <label style={LABEL_STYLE}>生效结束时间（留空＝永久）</label>
            <input
              type="datetime-local"
              value={form.endAt}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setField('endAt', e.target.value)}
              style={DATETIME_INPUT_STYLE}
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
