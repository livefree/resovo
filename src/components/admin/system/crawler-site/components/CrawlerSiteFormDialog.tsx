import { useState } from 'react'
import { AdminDialogShell } from '@/components/admin/shared/dialog/AdminDialogShell'
import { AdminFormField } from '@/components/admin/shared/form/AdminFormField'
import { AdminInput } from '@/components/admin/shared/form/AdminInput'
import { AdminSelect } from '@/components/admin/shared/form/AdminSelect'

export interface SiteFormData {
  key: string
  name: string
  apiUrl: string
  detail: string
  sourceType: 'vod' | 'shortdrama'
  format: 'json' | 'xml'
  weight: number
  isAdult: boolean
}

export const EMPTY_SITE_FORM: SiteFormData = {
  key: '',
  name: '',
  apiUrl: '',
  detail: '',
  sourceType: 'vod',
  format: 'json',
  weight: 50,
  isAdult: false,
}

interface CrawlerSiteFormDialogProps {
  title: string
  initial: SiteFormData
  isEdit: boolean
  onClose: () => void
  onSave: (data: SiteFormData) => Promise<void>
}

export function CrawlerSiteFormDialog({ title, initial, isEdit, onClose, onSave }: CrawlerSiteFormDialogProps) {
  const [form, setForm] = useState(initial)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function set<K extends keyof SiteFormData>(key: K, value: SiteFormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!form.name.trim() || !form.apiUrl.trim() || (!isEdit && !form.key.trim())) {
      setError('key、名称、API 地址均为必填')
      return
    }
    setSaving(true)
    try {
      await onSave(form)
      onClose()
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <AdminDialogShell title={title} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        {!isEdit && (
          <AdminFormField label="Key（唯一标识，字母数字下划线）">
            <AdminInput value={form.key} onChange={(value) => set('key', value)} placeholder="jsm3u8" />
          </AdminFormField>
        )}
        <AdminFormField label="名称">
          <AdminInput value={form.name} onChange={(value) => set('name', value)} placeholder="晶石影视" />
        </AdminFormField>
        <AdminFormField label="API 地址">
          <AdminInput value={form.apiUrl} onChange={(value) => set('apiUrl', value)} placeholder="https://api.example.com/api.php/provide/vod" />
        </AdminFormField>
        <AdminFormField label="备注（可选）">
          <AdminInput value={form.detail} onChange={(value) => set('detail', value)} placeholder="可选备注" />
        </AdminFormField>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="block text-sm font-medium text-[var(--text)] mb-1">类型</label>
            <AdminSelect
              value={form.sourceType}
              onChange={(value) => set('sourceType', value)}
              options={[
                { value: 'vod', label: '长片（vod）' },
                { value: 'shortdrama', label: '短剧' },
              ]}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--text)] mb-1">格式</label>
            <AdminSelect
              value={form.format}
              onChange={(value) => set('format', value)}
              options={[
                { value: 'json', label: 'JSON' },
                { value: 'xml', label: 'XML' },
              ]}
            />
          </div>
        </div>
        <AdminFormField label={`权重（0–100）：${form.weight}`}>
          <input
            type="range"
            min={0}
            max={100}
            value={form.weight}
            onChange={(event) => set('weight', Number(event.target.value))}
            className="w-full accent-[var(--accent)]"
          />
        </AdminFormField>
        <label className="flex items-center gap-2 mb-5 cursor-pointer">
          <input
            type="checkbox"
            checked={form.isAdult}
            onChange={(event) => set('isAdult', event.target.checked)}
            className="accent-[var(--accent)]"
          />
          <span className="text-sm text-[var(--text)]">成人内容源</span>
        </label>
        {error && <p className="text-sm text-red-500 mb-3">{error}</p>}
        <div className="flex gap-3 justify-end">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-md border border-[var(--border)] text-[var(--text)] hover:bg-[var(--bg3)]">
            取消
          </button>
          <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-semibold rounded-md bg-[var(--accent)] text-black hover:opacity-90 disabled:opacity-50">
            {saving ? '保存中…' : '保存'}
          </button>
        </div>
      </form>
    </AdminDialogShell>
  )
}
