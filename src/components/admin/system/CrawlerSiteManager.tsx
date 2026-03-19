/**
 * CrawlerSiteManager.tsx — 视频源配置管理面板（Client Component）
 * CHG-35: 表格列表 + CRUD + 批量操作 + 验证 + 导入导出
 */

'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { apiClient } from '@/lib/api-client'
import type { CrawlerSite, CreateCrawlerSiteInput, UpdateCrawlerSiteInput, CrawlerSiteBatchAction } from '@/types'

// ── 类型 ──────────────────────────────────────────────────────

type ValidateStatus = 'idle' | 'checking' | 'ok' | 'error' | 'timeout'

interface ValidateResult {
  status: 'ok' | 'error' | 'timeout'
  httpStatus: number | null
  latencyMs: number | null
}

type SortField = 'name' | 'key' | 'apiUrl' | 'sourceType' | 'format' | 'weight' | 'isAdult' | 'disabled' | 'fromConfig'
type SortDir = 'asc' | 'desc'

// ── 子组件 ────────────────────────────────────────────────────

function Badge({ children, color }: { children: React.ReactNode; color: 'green' | 'red' | 'yellow' | 'gray' | 'blue' }) {
  const cls = {
    green:  'bg-green-500/10 text-green-400 border-green-500/20',
    red:    'bg-red-500/10 text-red-400 border-red-500/20',
    yellow: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    gray:   'bg-[var(--bg3)] text-[var(--muted)] border-[var(--border)]',
    blue:   'bg-blue-500/10 text-blue-400 border-blue-500/20',
  }[color]
  return (
    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium border ${cls}`}>
      {children}
    </span>
  )
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--bg2)] p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-semibold text-[var(--text)]">{title}</h3>
          <button onClick={onClose} className="text-[var(--muted)] hover:text-[var(--text)] text-xl leading-none">×</button>
        </div>
        {children}
      </div>
    </div>
  )
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-[var(--text)] mb-1">{label}</label>
      {children}
    </div>
  )
}

function Input({ value, onChange, placeholder, disabled, type = 'text' }: {
  value: string; onChange: (v: string) => void; placeholder?: string; disabled?: boolean; type?: string
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className="w-full rounded-md border border-[var(--border)] bg-[var(--bg3)] px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] disabled:opacity-50"
    />
  )
}

// ── 新增/编辑表单 ──────────────────────────────────────────────

interface SiteFormData {
  key: string
  name: string
  apiUrl: string
  detail: string
  sourceType: 'vod' | 'shortdrama'
  format: 'json' | 'xml'
  weight: number
  isAdult: boolean
}

const EMPTY_FORM: SiteFormData = {
  key: '', name: '', apiUrl: '', detail: '',
  sourceType: 'vod', format: 'json', weight: 50, isAdult: false,
}

function SiteForm({
  initial,
  onSave,
  onClose,
  isEdit,
}: {
  initial: SiteFormData
  onSave: (data: SiteFormData) => Promise<void>
  onClose: () => void
  isEdit: boolean
}) {
  const [form, setForm] = useState(initial)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function set<K extends keyof SiteFormData>(k: K, v: SiteFormData[K]) {
    setForm((prev) => ({ ...prev, [k]: v }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim() || !form.apiUrl.trim() || (!isEdit && !form.key.trim())) {
      setError('key、名称、API 地址均为必填')
      return
    }
    setSaving(true)
    try {
      await onSave(form)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      {!isEdit && (
        <FormField label="Key（唯一标识，字母数字下划线）">
          <Input value={form.key} onChange={(v) => set('key', v)} placeholder="jsm3u8" />
        </FormField>
      )}
      <FormField label="名称">
        <Input value={form.name} onChange={(v) => set('name', v)} placeholder="晶石影视" />
      </FormField>
      <FormField label="API 地址">
        <Input value={form.apiUrl} onChange={(v) => set('apiUrl', v)} placeholder="https://api.example.com/api.php/provide/vod" />
      </FormField>
      <FormField label="备注（可选）">
        <Input value={form.detail} onChange={(v) => set('detail', v)} placeholder="可选备注" />
      </FormField>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div>
          <label className="block text-sm font-medium text-[var(--text)] mb-1">类型</label>
          <select
            value={form.sourceType}
            onChange={(e) => set('sourceType', e.target.value as 'vod' | 'shortdrama')}
            className="w-full rounded-md border border-[var(--border)] bg-[var(--bg3)] px-3 py-2 text-sm text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          >
            <option value="vod">长片（vod）</option>
            <option value="shortdrama">短剧</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-[var(--text)] mb-1">格式</label>
          <select
            value={form.format}
            onChange={(e) => set('format', e.target.value as 'json' | 'xml')}
            className="w-full rounded-md border border-[var(--border)] bg-[var(--bg3)] px-3 py-2 text-sm text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          >
            <option value="json">JSON</option>
            <option value="xml">XML</option>
          </select>
        </div>
      </div>
      <FormField label={`权重（0–100）：${form.weight}`}>
        <input
          type="range"
          min={0} max={100}
          value={form.weight}
          onChange={(e) => set('weight', Number(e.target.value))}
          className="w-full accent-[var(--accent)]"
        />
      </FormField>
      <label className="flex items-center gap-2 mb-5 cursor-pointer">
        <input
          type="checkbox"
          checked={form.isAdult}
          onChange={(e) => set('isAdult', e.target.checked)}
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
  )
}

// ── 主组件 ────────────────────────────────────────────────────

export function CrawlerSiteManager() {
  const [sites, setSites] = useState<CrawlerSite[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [editTarget, setEditTarget] = useState<CrawlerSite | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [validateStates, setValidateStates] = useState<Record<string, ValidateStatus>>({})
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)
  const [sortBy, setSortBy] = useState<SortField>('weight')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [filters, setFilters] = useState({
    keyOrName: '',
    apiUrl: '',
    sourceType: 'all' as 'all' | 'vod' | 'shortdrama',
    format: 'all' as 'all' | 'json' | 'xml',
    isAdult: 'all' as 'all' | 'yes' | 'no',
    disabled: 'all' as 'all' | 'enabled' | 'disabled',
    fromConfig: 'all' as 'all' | 'config' | 'manual',
    weightMin: '',
    weightMax: '',
  })

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3500)
  }

  const fetchSites = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiClient.get<{ data: CrawlerSite[] }>('/admin/crawler/sites')
      setSites(res.data)
    } catch {
      // 静默
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchSites() }, [fetchSites])

  const displaySites = useMemo(() => {
    const keyOrName = filters.keyOrName.trim().toLowerCase()
    const apiUrl = filters.apiUrl.trim().toLowerCase()
    const min = filters.weightMin.trim() === '' ? null : Number(filters.weightMin)
    const max = filters.weightMax.trim() === '' ? null : Number(filters.weightMax)

    const filtered = sites.filter((site) => {
      if (keyOrName && !`${site.name} ${site.key}`.toLowerCase().includes(keyOrName)) return false
      if (apiUrl && !site.apiUrl.toLowerCase().includes(apiUrl)) return false
      if (filters.sourceType !== 'all' && site.sourceType !== filters.sourceType) return false
      if (filters.format !== 'all' && site.format !== filters.format) return false
      if (filters.isAdult === 'yes' && !site.isAdult) return false
      if (filters.isAdult === 'no' && site.isAdult) return false
      if (filters.disabled === 'enabled' && site.disabled) return false
      if (filters.disabled === 'disabled' && !site.disabled) return false
      if (filters.fromConfig === 'config' && !site.fromConfig) return false
      if (filters.fromConfig === 'manual' && site.fromConfig) return false
      if (min !== null && !Number.isNaN(min) && site.weight < min) return false
      if (max !== null && !Number.isNaN(max) && site.weight > max) return false
      return true
    })

    const dir = sortDir === 'asc' ? 1 : -1
    return filtered.sort((a, b) => {
      const compareString = (x: string, y: string) => x.localeCompare(y, 'zh-CN', { sensitivity: 'base' })
      switch (sortBy) {
        case 'name': return dir * compareString(a.name, b.name)
        case 'key': return dir * compareString(a.key, b.key)
        case 'apiUrl': return dir * compareString(a.apiUrl, b.apiUrl)
        case 'sourceType': return dir * compareString(a.sourceType, b.sourceType)
        case 'format': return dir * compareString(a.format, b.format)
        case 'weight': return dir * (a.weight - b.weight)
        case 'isAdult': return dir * (Number(a.isAdult) - Number(b.isAdult))
        case 'disabled': return dir * (Number(a.disabled) - Number(b.disabled))
        case 'fromConfig': return dir * (Number(a.fromConfig) - Number(b.fromConfig))
        default: return 0
      }
    })
  }, [sites, filters, sortBy, sortDir])

  function handleSort(field: SortField) {
    if (sortBy === field) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'))
      return
    }
    setSortBy(field)
    setSortDir('asc')
  }

  // ── 选择 ───────────────────────────────────────────────────

  function toggleSelect(key: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  function toggleAll() {
    const visibleKeys = displaySites.map((s) => s.key)
    const allVisibleSelected = visibleKeys.every((k) => selected.has(k))
    if (allVisibleSelected) {
      setSelected((prev) => {
        const next = new Set(prev)
        for (const k of visibleKeys) next.delete(k)
        return next
      })
      return
    }
    setSelected((prev) => {
      const next = new Set(prev)
      for (const k of visibleKeys) next.add(k)
      return next
    })
  }

  // ── 验证 ───────────────────────────────────────────────────

  async function handleValidate(site: CrawlerSite) {
    setValidateStates((prev) => ({ ...prev, [site.key]: 'checking' }))
    try {
      const res = await apiClient.post<{ data: ValidateResult }>('/admin/crawler/sites/validate', { apiUrl: site.apiUrl })
      setValidateStates((prev) => ({ ...prev, [site.key]: res.data.status }))
    } catch {
      setValidateStates((prev) => ({ ...prev, [site.key]: 'error' }))
    }
  }

  // ── 快速切换启用状态 ─────────────────────────────────────────

  async function handleToggleDisabled(site: CrawlerSite) {
    try {
      await apiClient.patch(`/admin/crawler/sites/${site.key}`, { disabled: !site.disabled })
      await fetchSites()
    } catch {
      showToast('操作失败', false)
    }
  }

  // ── 删除 ───────────────────────────────────────────────────

  async function handleDelete(site: CrawlerSite) {
    if (!confirm(`确定删除源站 "${site.name}"？`)) return
    try {
      await apiClient.delete(`/admin/crawler/sites/${site.key}`)
      await fetchSites()
      showToast('已删除', true)
    } catch {
      showToast('删除失败（配置文件来源的源站不可删除）', false)
    }
  }

  // ── 批量操作 ───────────────────────────────────────────────

  async function handleBatch(action: CrawlerSiteBatchAction) {
    if (selected.size === 0) { showToast('请先选择源站', false); return }
    const label = { enable: '启用', disable: '停用', delete: '删除', mark_adult: '标记成人', unmark_adult: '取消成人', mark_shortdrama: '标记短剧', mark_vod: '标记长片' }[action]
    if (action === 'delete' && !confirm(`确定批量删除 ${selected.size} 个源站？`)) return
    try {
      const res = await apiClient.post<{ data: { affected: number } }>('/admin/crawler/sites/batch', {
        keys: Array.from(selected),
        action,
      })
      await fetchSites()
      setSelected(new Set())
      showToast(`批量${label}成功，影响 ${res.data.affected} 条`, true)
    } catch {
      showToast('批量操作失败', false)
    }
  }

  // ── 新增 ───────────────────────────────────────────────────

  async function handleAdd(form: SiteFormData) {
    const input: CreateCrawlerSiteInput = {
      key:        form.key,
      name:       form.name,
      apiUrl:     form.apiUrl,
      detail:     form.detail || undefined,
      sourceType: form.sourceType,
      format:     form.format,
      weight:     form.weight,
      isAdult:    form.isAdult,
    }
    await apiClient.post('/admin/crawler/sites', input)
    await fetchSites()
    showToast('添加成功', true)
  }

  // ── 编辑 ───────────────────────────────────────────────────

  async function handleEdit(form: SiteFormData) {
    if (!editTarget) return
    const input: UpdateCrawlerSiteInput = {
      name:       form.name,
      apiUrl:     form.apiUrl,
      detail:     form.detail || undefined,
      sourceType: form.sourceType,
      format:     form.format,
      weight:     form.weight,
      isAdult:    form.isAdult,
    }
    await apiClient.patch(`/admin/crawler/sites/${editTarget.key}`, input)
    await fetchSites()
    showToast('更新成功', true)
  }

  // ── 导出 ───────────────────────────────────────────────────

  function handleExport() {
    const data: Record<string, unknown> = {}
    for (const s of sites) {
      data[s.key] = { name: s.name, api: s.apiUrl, detail: s.detail, type: s.sourceType, format: s.format, weight: s.weight, is_adult: s.isAdult }
    }
    const json = JSON.stringify({ crawler_sites: data }, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'crawler_sites.json'; a.click()
    URL.revokeObjectURL(url)
  }

  // ── 导入 ───────────────────────────────────────────────────

  function handleImport() {
    const input = document.createElement('input')
    input.type = 'file'; input.accept = '.json'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      const text = await file.text()
      try {
        const json = JSON.parse(text)
        const sites_map = json.crawler_sites ?? json.api_site ?? json
        let ok = 0, fail = 0
        for (const [key, val] of Object.entries(sites_map as Record<string, { name?: string; api?: string }>)) {
          if (!val.name || !val.api) { fail++; continue }
          try {
            await apiClient.post('/admin/crawler/sites', { key, name: val.name, apiUrl: val.api }).catch(async () => {
              await apiClient.patch(`/admin/crawler/sites/${key}`, { name: val.name, apiUrl: val.api })
            })
            ok++
          } catch { fail++ }
        }
        await fetchSites()
        showToast(`导入完成：成功 ${ok}，失败 ${fail}`, ok > 0)
      } catch {
        showToast('JSON 解析失败', false)
      }
    }
    input.click()
  }

  // ── 渲染 ──────────────────────────────────────────────────

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-sm text-[var(--muted)]">加载中…</div>
  }

  return (
    <div>
      {/* 操作栏 */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <button onClick={() => setShowAdd(true)} className="rounded-md px-4 py-2 text-sm font-medium bg-[var(--accent)] text-black hover:opacity-90">
          + 添加源站
        </button>
        <button onClick={handleExport} className="rounded-md px-3 py-2 text-sm border border-[var(--border)] text-[var(--text)] hover:bg-[var(--bg3)]">
          导出 JSON
        </button>
        <button onClick={handleImport} className="rounded-md px-3 py-2 text-sm border border-[var(--border)] text-[var(--text)] hover:bg-[var(--bg3)]">
          导入 JSON
        </button>
        {selected.size > 0 && (
          <>
            <span className="text-xs text-[var(--muted)] ml-1">已选 {selected.size} 项</span>
            <button onClick={() => handleBatch('enable')} className="rounded-md px-3 py-2 text-xs border border-[var(--border)] text-[var(--text)] hover:bg-[var(--bg3)]">批量启用</button>
            <button onClick={() => handleBatch('disable')} className="rounded-md px-3 py-2 text-xs border border-[var(--border)] text-[var(--text)] hover:bg-[var(--bg3)]">批量停用</button>
            <button onClick={() => handleBatch('mark_adult')} className="rounded-md px-3 py-2 text-xs border border-[var(--border)] text-[var(--text)] hover:bg-[var(--bg3)]">标记成人</button>
            <button onClick={() => handleBatch('delete')} className="rounded-md px-3 py-2 text-xs border border-red-500/30 text-red-400 hover:bg-red-500/10">批量删除</button>
          </>
        )}
        {toast && (
          <span className={`ml-auto text-sm ${toast.ok ? 'text-green-500' : 'text-red-500'}`}>{toast.msg}</span>
        )}
      </div>

      {/* 表格 */}
      <div className="rounded-lg border border-[var(--border)] overflow-hidden">
        <div className="grid grid-cols-1 gap-2 border-b border-[var(--border)] bg-[var(--bg2)] p-3 md:grid-cols-2 lg:grid-cols-5">
          <Input
            value={filters.keyOrName}
            onChange={(v) => setFilters((prev) => ({ ...prev, keyOrName: v }))}
            placeholder="筛选 名称 / key"
          />
          <Input
            value={filters.apiUrl}
            onChange={(v) => setFilters((prev) => ({ ...prev, apiUrl: v }))}
            placeholder="筛选 API 地址"
          />
          <select
            value={filters.sourceType}
            onChange={(e) => setFilters((prev) => ({ ...prev, sourceType: e.target.value as typeof prev.sourceType }))}
            className="w-full rounded-md border border-[var(--border)] bg-[var(--bg3)] px-3 py-2 text-sm text-[var(--text)]"
          >
            <option value="all">类型：全部</option>
            <option value="vod">类型：长片</option>
            <option value="shortdrama">类型：短剧</option>
          </select>
          <select
            value={filters.format}
            onChange={(e) => setFilters((prev) => ({ ...prev, format: e.target.value as typeof prev.format }))}
            className="w-full rounded-md border border-[var(--border)] bg-[var(--bg3)] px-3 py-2 text-sm text-[var(--text)]"
          >
            <option value="all">格式：全部</option>
            <option value="json">格式：JSON</option>
            <option value="xml">格式：XML</option>
          </select>
          <select
            value={filters.disabled}
            onChange={(e) => setFilters((prev) => ({ ...prev, disabled: e.target.value as typeof prev.disabled }))}
            className="w-full rounded-md border border-[var(--border)] bg-[var(--bg3)] px-3 py-2 text-sm text-[var(--text)]"
          >
            <option value="all">状态：全部</option>
            <option value="enabled">状态：运行中</option>
            <option value="disabled">状态：已停用</option>
          </select>
          <select
            value={filters.isAdult}
            onChange={(e) => setFilters((prev) => ({ ...prev, isAdult: e.target.value as typeof prev.isAdult }))}
            className="w-full rounded-md border border-[var(--border)] bg-[var(--bg3)] px-3 py-2 text-sm text-[var(--text)]"
          >
            <option value="all">成人：全部</option>
            <option value="yes">成人：是</option>
            <option value="no">成人：否</option>
          </select>
          <select
            value={filters.fromConfig}
            onChange={(e) => setFilters((prev) => ({ ...prev, fromConfig: e.target.value as typeof prev.fromConfig }))}
            className="w-full rounded-md border border-[var(--border)] bg-[var(--bg3)] px-3 py-2 text-sm text-[var(--text)]"
          >
            <option value="all">来源：全部</option>
            <option value="config">来源：配置文件</option>
            <option value="manual">来源：手工添加</option>
          </select>
          <Input
            value={filters.weightMin}
            onChange={(v) => setFilters((prev) => ({ ...prev, weightMin: v }))}
            placeholder="权重最小值"
            type="number"
          />
          <Input
            value={filters.weightMax}
            onChange={(v) => setFilters((prev) => ({ ...prev, weightMax: v }))}
            placeholder="权重最大值"
            type="number"
          />
          <button
            type="button"
            onClick={() => {
              setFilters({
                keyOrName: '',
                apiUrl: '',
                sourceType: 'all',
                format: 'all',
                isAdult: 'all',
                disabled: 'all',
                fromConfig: 'all',
                weightMin: '',
                weightMax: '',
              })
              setSortBy('weight')
              setSortDir('desc')
            }}
            className="rounded-md border border-[var(--border)] px-3 py-2 text-sm text-[var(--text)] hover:bg-[var(--bg3)]"
          >
            清空筛选
          </button>
        </div>

        <div data-testid="crawler-sites-scroll-container" className="max-h-[60vh] overflow-y-auto overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="sticky top-0 z-10 border-b border-[var(--border)] bg-[var(--bg2)]">
              <th className="w-8 px-3 py-3 text-left">
                <input
                  type="checkbox"
                  checked={displaySites.length > 0 && displaySites.every((s) => selected.has(s.key))}
                  onChange={toggleAll}
                  className="accent-[var(--accent)]"
                />
              </th>
              <th className="px-3 py-3 text-left font-medium text-[var(--muted)] cursor-pointer" onClick={() => handleSort('name')}>名称 {sortBy === 'name' ? (sortDir === 'asc' ? '↑' : '↓') : ''}</th>
              <th className="px-3 py-3 text-left font-medium text-[var(--muted)] cursor-pointer" onClick={() => handleSort('key')}>Key {sortBy === 'key' ? (sortDir === 'asc' ? '↑' : '↓') : ''}</th>
              <th className="px-3 py-3 text-left font-medium text-[var(--muted)] cursor-pointer" onClick={() => handleSort('apiUrl')}>API 地址 {sortBy === 'apiUrl' ? (sortDir === 'asc' ? '↑' : '↓') : ''}</th>
              <th className="px-3 py-3 text-left font-medium text-[var(--muted)] cursor-pointer" onClick={() => handleSort('sourceType')}>类型 {sortBy === 'sourceType' ? (sortDir === 'asc' ? '↑' : '↓') : ''}</th>
              <th className="px-3 py-3 text-left font-medium text-[var(--muted)] cursor-pointer" onClick={() => handleSort('format')}>格式 {sortBy === 'format' ? (sortDir === 'asc' ? '↑' : '↓') : ''}</th>
              <th className="px-3 py-3 text-left font-medium text-[var(--muted)] cursor-pointer" onClick={() => handleSort('weight')}>权重 {sortBy === 'weight' ? (sortDir === 'asc' ? '↑' : '↓') : ''}</th>
              <th className="px-3 py-3 text-left font-medium text-[var(--muted)] cursor-pointer" onClick={() => handleSort('isAdult')}>成人 {sortBy === 'isAdult' ? (sortDir === 'asc' ? '↑' : '↓') : ''}</th>
              <th className="px-3 py-3 text-left font-medium text-[var(--muted)] cursor-pointer" onClick={() => handleSort('fromConfig')}>来源 {sortBy === 'fromConfig' ? (sortDir === 'asc' ? '↑' : '↓') : ''}</th>
              <th className="px-3 py-3 text-left font-medium text-[var(--muted)] cursor-pointer" onClick={() => handleSort('disabled')}>状态 {sortBy === 'disabled' ? (sortDir === 'asc' ? '↑' : '↓') : ''}</th>
              <th className="px-3 py-3 text-left font-medium text-[var(--muted)]">操作</th>
            </tr>
          </thead>
          <tbody>
            {displaySites.length === 0 && (
              <tr>
                <td colSpan={11} className="px-3 py-10 text-center text-[var(--muted)] text-sm">
                  没有符合当前筛选条件的源站
                </td>
              </tr>
            )}
            {displaySites.map((site) => {
              const vs = validateStates[site.key] ?? 'idle'
              return (
                <tr key={site.key} className="border-b border-[var(--border)] hover:bg-[var(--bg2)] transition-colors">
                  <td className="px-3 py-3">
                    <input type="checkbox" checked={selected.has(site.key)} onChange={() => toggleSelect(site.key)} className="accent-[var(--accent)]" />
                  </td>
                  <td className="px-3 py-3">
                    <div className="font-medium text-[var(--text)]">{site.name}</div>
                  </td>
                  <td className="px-3 py-3 text-xs text-[var(--muted)]">{site.key}</td>
                  <td className="px-3 py-3 max-w-xs">
                    <span className="block truncate text-xs text-[var(--muted)]">{site.apiUrl}</span>
                  </td>
                  <td className="px-3 py-3">
                    <Badge color={site.sourceType === 'shortdrama' ? 'blue' : 'gray'}>
                      {site.sourceType === 'shortdrama' ? '短剧' : '长片'}
                    </Badge>
                  </td>
                  <td className="px-3 py-3"><Badge color="gray">{site.format.toUpperCase()}</Badge></td>
                  <td className="px-3 py-3"><Badge color="gray">w:{site.weight}</Badge></td>
                  <td className="px-3 py-3">{site.isAdult ? <Badge color="red">成人</Badge> : <span className="text-xs text-[var(--muted)]">否</span>}</td>
                  <td className="px-3 py-3">{site.fromConfig ? <Badge color="blue">配置文件</Badge> : <span className="text-xs text-[var(--muted)]">手工</span>}</td>
                  <td className="px-3 py-3">
                    <button
                      onClick={() => handleToggleDisabled(site)}
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium border transition-colors ${
                        site.disabled
                          ? 'bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20'
                          : 'bg-green-500/10 text-green-400 border-green-500/20 hover:bg-green-500/20'
                      }`}
                    >
                      {site.disabled ? '已停用' : '运行中'}
                    </button>
                    {vs !== 'idle' && (
                      <div className="mt-1">
                        {vs === 'checking' && <span className="text-xs text-[var(--muted)]">检测中…</span>}
                        {vs === 'ok' && <Badge color="green">可达</Badge>}
                        {vs === 'error' && <Badge color="red">不可达</Badge>}
                        {vs === 'timeout' && <Badge color="yellow">超时</Badge>}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => handleValidate(site)}
                        disabled={vs === 'checking'}
                        className="rounded px-2 py-1 text-xs border border-[var(--border)] text-[var(--text)] hover:bg-[var(--bg3)] disabled:opacity-50"
                      >
                        检测
                      </button>
                      <button
                        onClick={() => setEditTarget(site)}
                        className="rounded px-2 py-1 text-xs border border-[var(--border)] text-[var(--text)] hover:bg-[var(--bg3)]"
                      >
                        编辑
                      </button>
                      {!site.fromConfig && (
                        <button
                          onClick={() => handleDelete(site)}
                          className="rounded px-2 py-1 text-xs border border-red-500/30 text-red-400 hover:bg-red-500/10"
                        >
                          删除
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        </div>
      </div>

      {/* 添加 Modal */}
      {showAdd && (
        <Modal title="添加源站" onClose={() => setShowAdd(false)}>
          <SiteForm initial={EMPTY_FORM} onSave={handleAdd} onClose={() => setShowAdd(false)} isEdit={false} />
        </Modal>
      )}

      {/* 编辑 Modal */}
      {editTarget && (
        <Modal title={`编辑：${editTarget.name}`} onClose={() => setEditTarget(null)}>
          <SiteForm
            initial={{
              key:        editTarget.key,
              name:       editTarget.name,
              apiUrl:     editTarget.apiUrl,
              detail:     editTarget.detail ?? '',
              sourceType: editTarget.sourceType,
              format:     editTarget.format,
              weight:     editTarget.weight,
              isAdult:    editTarget.isAdult,
            }}
            onSave={handleEdit}
            onClose={() => setEditTarget(null)}
            isEdit={true}
          />
        </Modal>
      )}
    </div>
  )
}
