'use client'

/**
 * SectionInspector.tsx — 区块设置 Inspector（CHG-HOME-CANVAS-B / 方案 §3）
 *
 * 选中区块的 settings 编辑（autofillMode / refreshIntervalMinutes / displayCount /
 * allowDuplicates / pinnedLimit）。**CHG-HOME-DRAFT-PUBLISH-B / D-185-2.1：保存经
 * onSaveSettings 回调落草稿**（不再调门面 #3——端点保留为非画布旁路）。
 * 候选池 / 过滤原因展示由 CandidatePoolPanel 承载（#4/#7 只读/触发维持直连；
 * 应用经 onApplyCandidates 落草稿 pinned）。
 */

import { useEffect, useState, type ChangeEvent, type CSSProperties } from 'react'
import { AdminButton, AdminSelect, AdminInput, Pill, useToast, type AdminSelectOption } from '@resovo/admin-ui'
import type {
  AutofillCandidate,
  HomeConfigSectionSettingsEntry,
  HomePreviewSection,
  HomeSectionKey,
  HomeSectionSettings,
} from '@/lib/home-curation/types'
import { CandidatePoolPanel } from './CandidatePoolPanel'
import { SECTION_TITLE } from './section-meta'

const MODE_OPTIONS: readonly AdminSelectOption[] = [
  { value: 'manual_only', label: '纯人工 (manual_only)' },
  { value: 'manual_plus_autofill', label: '人工+自动补位 (manual_plus_autofill)' },
  { value: 'suggest_only', label: '仅候选 (suggest_only)' },
  { value: 'full_auto', label: '全自动 (full_auto)' },
]

const PANEL_STYLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  padding: '12px 14px',
  borderRadius: 'var(--radius-md)',
  border: '1px solid var(--border-subtle)',
  background: 'var(--bg-surface)',
  position: 'sticky',
  top: 12,
}

const TITLE_STYLE: CSSProperties = {
  fontSize: 'var(--font-size-sm)',
  fontWeight: 700,
  color: 'var(--fg-default)',
  display: 'flex',
  alignItems: 'center',
  gap: 8,
}

const FIELD_STYLE: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4 }
const LABEL_STYLE: CSSProperties = { fontSize: 'var(--font-size-2xs)', fontWeight: 500, color: 'var(--fg-muted)' }

const HINT_STYLE: CSSProperties = {
  fontSize: 'var(--font-size-2xs)',
  color: 'var(--fg-muted)',
  lineHeight: 1.5,
}

const EMPTY_HINT_STYLE: CSSProperties = {
  ...PANEL_STYLE,
  color: 'var(--fg-muted)',
  fontSize: 'var(--font-size-xs)',
  textAlign: 'center',
}

interface FormState {
  autofillMode: HomeSectionSettings['autofillMode']
  refreshIntervalMinutes: string  // 空串 = null（不自动重算）
  displayCount: string
  allowDuplicates: boolean
  pinnedLimit: string             // 空串 = null（不限）
}

function formFrom(settings: HomeSectionSettings): FormState {
  return {
    autofillMode: settings.autofillMode,
    refreshIntervalMinutes: settings.refreshIntervalMinutes != null ? String(settings.refreshIntervalMinutes) : '',
    displayCount: String(settings.displayCount),
    allowDuplicates: settings.allowDuplicates,
    pinnedLimit: settings.pinnedLimit != null ? String(settings.pinnedLimit) : '',
  }
}

export interface SectionInspectorProps {
  /** 选中区块（null = 未选中提示态） */
  readonly section: HomePreviewSection | null
  /** settings 保存写路径（D-185-2.1 落草稿；HomeCanvas 注入） */
  readonly onSaveSettings: (
    section: HomeSectionKey,
    patch: Partial<Omit<HomeConfigSectionSettingsEntry, 'section' | 'id'>>,
  ) => Promise<void>
  /** settings 保存成功 → 父级重拉 preview */
  readonly onSaved: (section: HomeSectionKey) => void
  /** 候选应用写路径（D-185-2.1 落草稿 pinned；返回应用/跳过计数供 toast） */
  readonly onApplyCandidates: (
    section: HomeSectionKey,
    candidates: readonly AutofillCandidate[],
  ) => Promise<{ applied: number; skipped: number }>
  /** 候选应用成功 → 父级重拉 preview（pinned 变化；CHG-HOME-AUTOFILL-UI） */
  readonly onCandidateApplied: (section: HomeSectionKey) => void
  /** banner 候选预填横幅编辑器（BannerDrawer 创建模式，HomeOpsClient 编排） */
  readonly onBannerPrefill?: (candidate: AutofillCandidate) => void
}

export function SectionInspector({ section, onSaveSettings, onSaved, onApplyCandidates, onCandidateApplied, onBannerPrefill }: SectionInspectorProps) {
  const toast = useToast()
  const [form, setForm] = useState<FormState | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setForm(section ? formFrom(section.settings) : null)
  }, [section])

  if (!section || !form) {
    return (
      <div style={EMPTY_HINT_STYLE} data-testid="inspector-empty">
        点击左侧区块查看与编辑设置
      </div>
    )
  }

  const { key, settings } = section

  async function handleSave() {
    if (!form) return
    const displayCount = parseInt(form.displayCount, 10)
    if (!Number.isInteger(displayCount) || displayCount < 1) {
      toast.push({ title: '槽位数必须为正整数', level: 'danger' })
      return
    }
    const refresh = form.refreshIntervalMinutes.trim()
    const pinned = form.pinnedLimit.trim()
    setSaving(true)
    try {
      // D-185-2.1：落草稿（HomeCanvas → mutateConfig），不再调门面 #3
      await onSaveSettings(key, {
        autofillMode: form.autofillMode,
        refreshIntervalMinutes: refresh ? parseInt(refresh, 10) : null,
        displayCount,
        allowDuplicates: form.allowDuplicates,
        pinnedLimit: pinned ? parseInt(pinned, 10) : null,
      })
      toast.push({ title: '区块设置已存入草稿', level: 'success' })
      onSaved(key)
    } catch (err: unknown) {
      toast.push({
        title: '保存失败',
        description: err instanceof Error ? err.message : '请稍后重试',
        level: 'danger',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={PANEL_STYLE} data-testid={`section-inspector-${key}`}>
      <div style={TITLE_STYLE}>
        {SECTION_TITLE[key] ?? key}
        <Pill variant="neutral" testId="inspector-section-key">{key}</Pill>
      </div>

      <div style={FIELD_STYLE}>
        <label style={LABEL_STYLE}>自动填充模式</label>
        <AdminSelect
          value={form.autofillMode}
          options={MODE_OPTIONS}
          onChange={(v) => setForm({ ...form, autofillMode: (v ?? form.autofillMode) as FormState['autofillMode'] })}
          size="sm"
          data-testid="inspector-autofill-mode"
        />
      </div>

      <div style={FIELD_STYLE}>
        <label style={LABEL_STYLE}>自动重算频率（分钟；空＝不自动重算）</label>
        <AdminInput
          value={form.refreshIntervalMinutes}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setForm({ ...form, refreshIntervalMinutes: e.target.value })}
          placeholder="如：60"
          size="sm"
          data-testid="inspector-refresh-interval"
        />
      </div>

      <div style={FIELD_STYLE}>
        <label style={LABEL_STYLE}>槽位数（displayCount）</label>
        <AdminInput
          value={form.displayCount}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setForm({ ...form, displayCount: e.target.value })}
          size="sm"
          data-testid="inspector-display-count"
        />
      </div>

      <div style={FIELD_STYLE}>
        <label style={LABEL_STYLE}>跨区块去重豁免</label>
        <AdminSelect
          value={String(form.allowDuplicates)}
          options={[{ value: 'false', label: '参与去重（默认）' }, { value: 'true', label: '豁免（允许重复）' }]}
          onChange={(v) => setForm({ ...form, allowDuplicates: (v ?? 'false') === 'true' })}
          size="sm"
          data-testid="inspector-allow-duplicates"
        />
      </div>

      <div style={FIELD_STYLE}>
        <label style={LABEL_STYLE}>pinned 上限（空＝不限）</label>
        <AdminInput
          value={form.pinnedLimit}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setForm({ ...form, pinnedLimit: e.target.value })}
          placeholder="如：3"
          size="sm"
          data-testid="inspector-pinned-limit"
        />
      </div>

      <div style={HINT_STYLE}>
        更新于 {new Date(settings.updatedAt).toLocaleString()}
      </div>

      <AdminButton
        variant="primary"
        size="sm"
        loading={saving}
        onClick={() => void handleSave()}
        data-testid="inspector-save-btn"
      >
        保存设置
      </AdminButton>

      {/* 候选池（CHG-HOME-AUTOFILL-UI / 端点 #4 #7 只读/触发直连；应用经
          onApply 落草稿 D-185-2.1）——注意用 settings.autofillMode（已保存值）
          而非 form 编辑中间态，避免未保存切换误启停刷新入口 */}
      <CandidatePoolPanel
        section={key}
        autofillMode={settings.autofillMode}
        onApply={onApplyCandidates}
        onApplied={() => onCandidateApplied(key)}
        onBannerPrefill={onBannerPrefill}
      />
    </div>
  )
}
