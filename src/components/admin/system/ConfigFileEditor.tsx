/**
 * ConfigFileEditor.tsx — 配置文件编辑器（Client Component）
 * CHG-35: JSON 编辑 + 订阅 URL 拉取 + 保存（同步到 crawler_sites）
 */

'use client'

import { useState, useEffect, useCallback } from 'react'
import { apiClient } from '@/lib/api-client'

const PLACEHOLDER = JSON.stringify(
  {
    crawler_sites: {
      example: {
        name: '示例资源站',
        api: 'https://api.example.com/api.php/provide/vod',
        detail: '可选备注',
        type: 'vod',
        format: 'json',
        weight: 50,
        is_adult: false,
      },
    },
  },
  null,
  2,
)

interface ConfigFileData {
  configFile: string
  subscriptionUrl: string
}

export function ConfigFileEditor() {
  const [data, setData] = useState<ConfigFileData>({ configFile: '', subscriptionUrl: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [fetching, setFetching] = useState(false)
  const [jsonError, setJsonError] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 4000)
  }

  const fetchCurrent = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiClient.get<{ data: ConfigFileData }>('/admin/system/config')
      setData(res.data)
    } catch {
      // 静默
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchCurrent() }, [fetchCurrent])

  function validateJson(raw: string): boolean {
    if (!raw.trim()) { setJsonError(null); return true }
    try {
      JSON.parse(raw)
      setJsonError(null)
      return true
    } catch (e) {
      setJsonError(e instanceof Error ? e.message : 'JSON 格式错误')
      return false
    }
  }

  function handleContentChange(v: string) {
    setData((prev) => ({ ...prev, configFile: v }))
    validateJson(v)
  }

  async function handleFetch() {
    if (!data.subscriptionUrl) {
      showToast('请先填写订阅 URL', false)
      return
    }
    setFetching(true)
    try {
      const res = await fetch(data.subscriptionUrl)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const text = await res.text()
      JSON.parse(text) // validate
      setData((prev) => ({ ...prev, configFile: text }))
      setJsonError(null)
      showToast('拉取成功', true)
    } catch (e) {
      showToast(e instanceof Error ? `拉取失败：${e.message}` : '拉取失败', false)
    } finally {
      setFetching(false)
    }
  }

  async function handleSave() {
    if (!validateJson(data.configFile)) return
    setSaving(true)
    try {
      const res = await apiClient.post<{ data: { ok: boolean; synced: number } }>(
        '/admin/system/config',
        data,
      )
      showToast(`保存成功，已同步 ${res.data.synced} 个源站到视频源配置`, true)
    } catch {
      showToast('保存失败，请重试', false)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-sm text-[var(--muted)]">
        加载中…
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* ── 订阅 URL ───────────────────────────────────────── */}
      <div className="rounded-lg border border-[var(--border)] bg-[var(--bg2)] p-5">
        <h2 className="text-sm font-semibold text-[var(--muted)] uppercase tracking-wider mb-4">订阅 URL</h2>
        <p className="text-xs text-[var(--muted)] mb-3">
          填写远程 JSON 配置文件地址，点击拉取后内容将填入下方编辑器
        </p>
        <div className="flex gap-2">
          <input
            type="url"
            value={data.subscriptionUrl}
            onChange={(e) => setData((prev) => ({ ...prev, subscriptionUrl: e.target.value }))}
            placeholder="https://example.com/config.json"
            className="flex-1 rounded-md border border-[var(--border)] bg-[var(--bg3)] px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          />
          <button
            onClick={handleFetch}
            disabled={fetching}
            className="shrink-0 rounded-md px-4 py-2 text-sm font-medium border border-[var(--border)] bg-[var(--bg3)] text-[var(--text)] hover:bg-[var(--bg4)] disabled:opacity-50 transition-colors"
          >
            {fetching ? '拉取中…' : '远程拉取'}
          </button>
        </div>
      </div>

      {/* ── JSON 编辑器 ────────────────────────────────────── */}
      <div className="rounded-lg border border-[var(--border)] bg-[var(--bg2)] p-5">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-[var(--muted)] uppercase tracking-wider">配置内容（JSON）</h2>
          {jsonError && (
            <span className="text-xs text-red-500">{jsonError}</span>
          )}
        </div>
        <p className="text-xs text-[var(--muted)] mb-3">
          支持字段：<code className="text-[var(--accent)]">crawler_sites</code>（键为 site key，值含 name/api/type/format/weight/is_adult）
        </p>
        <textarea
          value={data.configFile}
          onChange={(e) => handleContentChange(e.target.value)}
          placeholder={PLACEHOLDER}
          rows={22}
          spellCheck={false}
          className={`w-full rounded-md border bg-[var(--bg3)] px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] resize-y font-mono ${
            jsonError ? 'border-red-500' : 'border-[var(--border)]'
          }`}
        />
      </div>

      {/* ── 操作栏 ─────────────────────────────────────────── */}
      <div className="flex items-center gap-4">
        <button
          onClick={handleSave}
          disabled={saving || !!jsonError}
          className="rounded-md px-5 py-2 text-sm font-semibold bg-[var(--accent)] text-black hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {saving ? '保存中…' : '保存并同步'}
        </button>
        {toast && (
          <span className={`text-sm ${toast.ok ? 'text-green-500' : 'text-red-500'}`}>
            {toast.msg}
          </span>
        )}
      </div>
    </div>
  )
}
