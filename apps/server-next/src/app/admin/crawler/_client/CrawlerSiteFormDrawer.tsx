'use client'

/**
 * CrawlerSiteFormDrawer.tsx — 站点创建/编辑表单 Drawer（CHG-SN-6-29-PATCH-1 拆出）
 *
 * 从 CrawlerSitesTab.tsx 拆出（H1 修复延伸）：8 字段表单 + validate + submit + delete + cancel。
 * 模式由 props.mode 区分：create / edit；edit 模式下 key 不可改 + 显示删除按钮。
 */

import { useState, type CSSProperties } from 'react'
import {
  Drawer,
  AdminButton,
  AdminInput,
  AdminSelect,
  AdminCheckbox,
  useToast,
  type AdminSelectOption,
} from '@resovo/admin-ui'
import {
  validateCrawlerSite,
  type CreateCrawlerSiteInput,
  type CrawlerSite,
} from '@/lib/crawler/api'
import { ApiClientError } from '@/lib/api-client'

const FORM_GRID_STYLE: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '120px 1fr',
  gap: '12px 16px',
  alignItems: 'center',
  padding: '16px',
}

const FORM_LABEL_STYLE: CSSProperties = {
  fontSize: 'var(--font-size-xs)',
  color: 'var(--fg-muted)',
}

const FORM_ACTIONS_STYLE: CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: '8px',
  padding: '12px 16px',
  borderTop: '1px solid var(--border-default)',
}

const SOURCE_TYPE_OPTIONS: readonly AdminSelectOption[] = [
  { value: 'vod', label: '长视频（vod）' },
  { value: 'shortdrama', label: '短剧（shortdrama）' },
]

const FORMAT_OPTIONS: readonly AdminSelectOption[] = [
  { value: 'json', label: 'JSON' },
  { value: 'xml', label: 'XML' },
]

export type CrawlerSiteFormMode = { kind: 'create' } | { kind: 'edit'; key: string }

export interface CrawlerSiteFormDrawerProps {
  readonly open: boolean
  readonly mode: CrawlerSiteFormMode
  readonly form: CreateCrawlerSiteInput
  readonly onFormChange: (next: CreateCrawlerSiteInput) => void
  readonly onClose: () => void
  readonly onSubmit: () => Promise<void> | void
  readonly onDelete?: (site: CrawlerSite) => void
  readonly submitting: boolean
  /** edit 模式删除按钮需要原 site 对象（fromConfig 判定） */
  readonly editSite?: CrawlerSite
}

export function CrawlerSiteFormDrawer({
  open,
  mode,
  form,
  onFormChange,
  onClose,
  onSubmit,
  onDelete,
  submitting,
  editSite,
}: CrawlerSiteFormDrawerProps) {
  const toast = useToast()
  const [validating, setValidating] = useState(false)

  const update = <K extends keyof CreateCrawlerSiteInput>(key: K, value: CreateCrawlerSiteInput[K]) => {
    onFormChange({ ...form, [key]: value })
  }

  const handleValidate = async () => {
    if (!form.apiUrl) return
    setValidating(true)
    try {
      const result = await validateCrawlerSite(form.apiUrl)
      if (result.ok) {
        toast.push({
          title: '验证通过',
          description: `HTTP ${result.statusCode ?? 200} · ${result.message ?? 'API 可达'}`,
          level: 'success',
        })
      } else {
        toast.push({
          title: '验证失败',
          description: result.message ?? `HTTP ${result.statusCode ?? '?'}`,
          level: 'warn',
        })
      }
    } catch (err: unknown) {
      const msg = err instanceof ApiClientError ? err.message
        : err instanceof Error ? err.message : '请稍后重试'
      toast.push({ title: '验证失败', description: msg, level: 'danger' })
    } finally {
      setValidating(false)
    }
  }

  return (
    <Drawer
      open={open}
      placement="right"
      width={480}
      onClose={onClose}
      title={mode.kind === 'create' ? '新增采集站点' : `编辑站点 · ${mode.key}`}
      data-testid="crawler-drawer"
    >
      <div style={FORM_GRID_STYLE}>
        <label style={FORM_LABEL_STYLE}>Key</label>
        <AdminInput
          value={form.key}
          onChange={(e) => update('key', e.target.value)}
          disabled={mode.kind === 'edit'}
          placeholder="例 jszyapi（创建后不可改）"
          data-testid="crawler-form-key"
        />
        <label style={FORM_LABEL_STYLE}>名称</label>
        <AdminInput
          value={form.name}
          onChange={(e) => update('name', e.target.value)}
          placeholder="例 极速资源"
          data-testid="crawler-form-name"
        />
        <label style={FORM_LABEL_STYLE}>API URL</label>
        <AdminInput
          value={form.apiUrl}
          onChange={(e) => update('apiUrl', e.target.value)}
          placeholder="https://api.example.com/api.php/..."
          data-testid="crawler-form-apiUrl"
          suffix={
            <AdminButton
              variant="ghost"
              size="sm"
              disabled={!form.apiUrl}
              loading={validating}
              onClick={() => void handleValidate()}
              data-testid="crawler-form-validate"
            >
              验证
            </AdminButton>
          }
        />
        <label style={FORM_LABEL_STYLE}>类型</label>
        <AdminSelect
          options={SOURCE_TYPE_OPTIONS}
          value={form.sourceType ?? 'vod'}
          onChange={(v) => update('sourceType', (v as 'vod' | 'shortdrama') ?? 'vod')}
          data-testid="crawler-form-sourceType"
        />
        <label style={FORM_LABEL_STYLE}>格式</label>
        <AdminSelect
          options={FORMAT_OPTIONS}
          value={form.format ?? 'json'}
          onChange={(v) => update('format', (v as 'json' | 'xml') ?? 'json')}
          data-testid="crawler-form-format"
        />
        <label style={FORM_LABEL_STYLE}>权重</label>
        <AdminInput
          type="number"
          value={String(form.weight ?? 50)}
          onChange={(e) => update('weight', Number(e.target.value) || 0)}
          placeholder="0-100"
          data-testid="crawler-form-weight"
        />
        <label style={FORM_LABEL_STYLE}>成人内容</label>
        <AdminCheckbox
          label="标记为成人内容站点"
          checked={form.isAdult ?? false}
          onChange={(e) => update('isAdult', e.target.checked)}
          data-testid="crawler-form-isAdult"
        />
      </div>
      <div style={FORM_ACTIONS_STYLE}>
        {mode.kind === 'edit' && editSite && onDelete ? (
          <AdminButton
            variant="danger"
            size="sm"
            onClick={() => {
              onClose()
              onDelete(editSite)
            }}
            data-testid="crawler-form-delete"
          >
            删除站点
          </AdminButton>
        ) : null}
        <AdminButton
          variant="ghost"
          size="sm"
          onClick={onClose}
          data-testid="crawler-form-cancel"
        >
          取消
        </AdminButton>
        <AdminButton
          variant="primary"
          size="sm"
          loading={submitting}
          disabled={!form.key || !form.name || !form.apiUrl}
          onClick={() => void onSubmit()}
          data-testid="crawler-form-submit"
        >
          {mode.kind === 'create' ? '创建' : '保存'}
        </AdminButton>
      </div>
    </Drawer>
  )
}
