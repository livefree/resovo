'use client'

/**
 * CategoryMappingCollapsible.tsx — 站点行展开内"分类映射" collapsible 段
 *
 * 真源：ADR-123 / CHG-SN-7-REDO-01-F
 *
 * 形态：
 *   - 折叠态：单行 summary（"分类映射 N 条 · 展开"）
 *   - 展开态：lazy fetch GET /admin/crawler/sites/:key/category-mapping
 *     + 渲染 mappings 列表（sourceLabel → AdminSelect targetGenre）
 *     + "+ 新增" 按钮（push 空行）
 *     + "保存" 按钮 → PUT 全量替换
 *
 * Y1 守卫：currentRole !== 'admin' → 保存按钮 disabled / select disabled
 */

import { useCallback, useState, type CSSProperties } from 'react'
import { AdminButton, AdminInput, AdminSelect, useToast, type AdminSelectOption } from '@resovo/admin-ui'
import {
  getCrawlerSiteCategoryMapping,
  putCrawlerSiteCategoryMapping,
  type CategoryMappingRow,
  type CategoryMappingInput,
} from '@/lib/crawler/api'
import { ApiClientError } from '@/lib/api-client'

export interface CategoryMappingCollapsibleProps {
  readonly siteKey: string
  readonly currentRole?: 'admin' | 'moderator'
}

const WRAPPER_STYLE: CSSProperties = {
  marginTop: '12px',
  background: 'var(--bg-surface)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 'var(--radius-sm)',
}

const SUMMARY_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '8px 12px',
  fontSize: 'var(--font-size-xs)',
  color: 'var(--fg-default)',
  cursor: 'pointer',
  background: 'transparent',
  border: 'none',
  width: '100%',
  textAlign: 'left',
}

const BODY_STYLE: CSSProperties = {
  padding: '12px',
  borderTop: '1px solid var(--border-subtle)',
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
}

const ROW_STYLE: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 16px 200px 60px',
  gap: '8px',
  alignItems: 'center',
}

const ARROW_STYLE: CSSProperties = {
  textAlign: 'center',
  fontSize: '12px',
  color: 'var(--fg-muted)',
}

const FOOTER_STYLE: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '8px',
  marginTop: '4px',
}

// VideoGenre 20 + 特殊 2 = 22 值（与 ADR-123 §SQL CHECK + service zod 同源）
const GENRE_OPTIONS: readonly AdminSelectOption[] = [
  { value: 'action', label: '动作' }, { value: 'comedy', label: '喜剧' },
  { value: 'romance', label: '爱情' }, { value: 'thriller', label: '惊悚' },
  { value: 'horror', label: '恐怖' }, { value: 'sci_fi', label: '科幻' },
  { value: 'fantasy', label: '奇幻' }, { value: 'history', label: '历史' },
  { value: 'crime', label: '犯罪' }, { value: 'mystery', label: '悬疑' },
  { value: 'war', label: '战争' }, { value: 'family', label: '家庭' },
  { value: 'biography', label: '传记' }, { value: 'martial_arts', label: '武侠' },
  { value: 'adventure', label: '冒险' }, { value: 'disaster', label: '灾难' },
  { value: 'musical', label: '音乐' }, { value: 'western', label: '西部' },
  { value: 'sport', label: '体育' }, { value: 'other', label: '其他' },
  { value: '_unmapped', label: '（未映射）' },
  { value: '_discard', label: '（丢弃）' },
]

type DraftRow = CategoryMappingInput & { readonly _localId: string }

let DRAFT_ID = 0
const nextDraftId = () => `draft-${++DRAFT_ID}`

function toDraft(rows: readonly CategoryMappingRow[]): DraftRow[] {
  return rows.map((r) => ({
    sourceLabel: r.sourceLabel,
    targetGenre: r.targetGenre,
    _localId: `db-${r.sourceLabel}`,
  }))
}

export function CategoryMappingCollapsible({ siteKey, currentRole = 'admin' }: CategoryMappingCollapsibleProps) {
  const toast = useToast()
  const [expanded, setExpanded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [draft, setDraft] = useState<DraftRow[] | null>(null)
  const [savedCount, setSavedCount] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const isAdmin = currentRole === 'admin'

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const rows = await getCrawlerSiteCategoryMapping(siteKey)
      setDraft(toDraft(rows))
      setSavedCount(rows.length)
    } catch (err: unknown) {
      const message = err instanceof ApiClientError ? err.message : '加载分类映射失败'
      toast.push({ title: '加载失败', description: message, level: 'danger' })
    } finally {
      setLoading(false)
    }
  }, [siteKey, toast])

  const handleToggle = useCallback(() => {
    if (!expanded && draft === null) {
      void load()
    }
    setExpanded((v) => !v)
  }, [expanded, draft, load])

  const handleAddRow = useCallback(() => {
    setDraft((prev) => [...(prev ?? []), { sourceLabel: '', targetGenre: '_unmapped', _localId: nextDraftId() }])
  }, [])

  const handleRemoveRow = useCallback((localId: string) => {
    setDraft((prev) => (prev ?? []).filter((r) => r._localId !== localId))
  }, [])

  const handleChangeLabel = useCallback((localId: string, value: string) => {
    setDraft((prev) => (prev ?? []).map((r) => (r._localId === localId ? { ...r, sourceLabel: value } : r)))
  }, [])

  const handleChangeGenre = useCallback((localId: string, value: string) => {
    setDraft((prev) => (prev ?? []).map((r) => (r._localId === localId ? { ...r, targetGenre: value as CategoryMappingInput['targetGenre'] } : r)))
  }, [])

  const handleSave = useCallback(async () => {
    if (!draft) return
    // 本地预校验：空 sourceLabel + 重复 sourceLabel
    const labels = draft.map((r) => r.sourceLabel.trim())
    if (labels.some((l) => l === '')) {
      toast.push({ title: '保存失败', description: '存在空的 sourceLabel 行', level: 'danger' })
      return
    }
    if (new Set(labels).size !== labels.length) {
      toast.push({ title: '保存失败', description: 'sourceLabel 不得重复', level: 'danger' })
      return
    }
    setSaving(true)
    try {
      const mappings: CategoryMappingInput[] = draft.map((r) => ({
        sourceLabel: r.sourceLabel.trim(),
        targetGenre: r.targetGenre,
      }))
      const result = await putCrawlerSiteCategoryMapping(siteKey, mappings)
      setSavedCount(result.written)
      toast.push({ title: '已保存', description: `写入 ${result.written} 条`, level: 'success' })
    } catch (err: unknown) {
      const message = err instanceof ApiClientError ? err.message : '保存失败'
      toast.push({ title: '保存失败', description: message, level: 'danger' })
    } finally {
      setSaving(false)
    }
  }, [draft, siteKey, toast])

  const summaryText = savedCount != null ? `分类映射 ${savedCount} 条` : '分类映射'
  const adminGuardTitle = isAdmin ? undefined : '该操作需要管理员权限'

  return (
    <div style={WRAPPER_STYLE} data-testid={`crawler-category-mapping-${siteKey}`}>
      <button
        type="button"
        style={SUMMARY_STYLE}
        onClick={handleToggle}
        data-testid={`crawler-category-mapping-toggle-${siteKey}`}
        data-expanded={expanded ? '' : undefined}
        aria-expanded={expanded}
      >
        <span>{summaryText}</span>
        <span style={{ color: 'var(--fg-muted)' }}>{expanded ? '收起 ▾' : '展开 ▸'}</span>
      </button>
      {expanded && (
        <div style={BODY_STYLE}>
          {loading && draft === null ? (
            <span style={{ color: 'var(--fg-muted)', fontSize: 'var(--font-size-xs)' }}>加载中…</span>
          ) : draft && draft.length === 0 ? (
            <span style={{ color: 'var(--fg-muted)', fontSize: 'var(--font-size-xs)' }}>
              暂无映射 — 点击下方「+ 新增」添加
            </span>
          ) : (
            (draft ?? []).map((row) => (
              <div key={row._localId} style={ROW_STYLE} data-mapping-row data-source-label={row.sourceLabel}>
                <AdminInput
                  size="sm"
                  value={row.sourceLabel}
                  onChange={(e) => handleChangeLabel(row._localId, e.target.value)}
                  placeholder="源分类标签"
                  disabled={!isAdmin || saving}
                  title={adminGuardTitle}
                  data-testid={`crawler-category-mapping-label-${row._localId}`}
                />
                <span style={ARROW_STYLE} aria-hidden>→</span>
                <AdminSelect
                  size="sm"
                  options={GENRE_OPTIONS}
                  value={row.targetGenre}
                  onChange={(v) => handleChangeGenre(row._localId, v as string)}
                  disabled={!isAdmin || saving}
                  data-testid={`crawler-category-mapping-genre-${row._localId}`}
                />
                <AdminButton
                  size="sm"
                  variant="ghost"
                  onClick={() => handleRemoveRow(row._localId)}
                  disabled={!isAdmin || saving}
                  aria-label={`移除映射 ${row.sourceLabel}`}
                  title={adminGuardTitle}
                  data-testid={`crawler-category-mapping-remove-${row._localId}`}
                >
                  移除
                </AdminButton>
              </div>
            ))
          )}
          <div style={FOOTER_STYLE}>
            <AdminButton
              size="sm"
              variant="default"
              onClick={handleAddRow}
              disabled={!isAdmin || saving}
              title={adminGuardTitle}
              data-testid={`crawler-category-mapping-add-${siteKey}`}
            >
              + 新增
            </AdminButton>
            <AdminButton
              size="sm"
              variant="primary"
              onClick={() => void handleSave()}
              loading={saving}
              disabled={!isAdmin || draft === null}
              title={adminGuardTitle}
              data-testid={`crawler-category-mapping-save-${siteKey}`}
            >
              保存
            </AdminButton>
          </div>
        </div>
      )}
    </div>
  )
}
