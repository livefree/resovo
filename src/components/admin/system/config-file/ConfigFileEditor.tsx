/**
 * ConfigFileEditor.tsx — 配置文件编辑器（Client Component）
 * CHG-35: JSON 编辑 + 订阅 URL 拉取 + 保存（同步到 crawler_sites）
 */

'use client'

import { useState, useEffect, useCallback } from 'react'
import { apiClient, ApiClientError } from '@/lib/api-client'
import { CONFIG_FILE_PLACEHOLDER } from '@/components/admin/system/config-file/constants'
import {
  normalizeSubscriptionUrl,
  parseJsonToPrettyText,
  validateJsonText,
} from '@/components/admin/system/config-file/utils'

interface ConfigFileData {
  configFile: string
  subscriptionUrl: string
}

type SourceTab = 'remote' | 'local'

export function ConfigFileEditor() {
  const [data, setData] = useState<ConfigFileData>({ configFile: '', subscriptionUrl: '' })
  const [sourceTab, setSourceTab] = useState<SourceTab>('remote')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [fetching, setFetching] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [jsonError, setJsonError] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)
  const [selectedFileName, setSelectedFileName] = useState('')

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 4000)
  }

  const fetchCurrent = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiClient.get<{ data: ConfigFileData }>('/admin/system/config')
      setData({
        configFile: res.data?.configFile ?? '',
        subscriptionUrl: res.data?.subscriptionUrl ?? '',
      })
    } catch {
      // 静默
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchCurrent() }, [fetchCurrent])

  function validateJson(raw: string): boolean {
    const result = validateJsonText(raw)
    setJsonError(result.error)
    return result.ok
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
      const prettyText = parseJsonToPrettyText(text)
      setData((prev) => ({ ...prev, configFile: prettyText }))
      setJsonError(null)
      showToast('拉取成功', true)
    } catch (e) {
      showToast(e instanceof Error ? `拉取失败：${e.message}` : '拉取失败', false)
    } finally {
      setFetching(false)
    }
  }

  async function handleLocalFileChange(file: File | null) {
    if (!file) return
    setSelectedFileName(file.name)
    setUploading(true)
    try {
      const text = await file.text()
      const prettyText = parseJsonToPrettyText(text)
      setData((prev) => ({ ...prev, configFile: prettyText }))
      setJsonError(null)
      showToast('本地文件加载成功', true)
    } catch (e) {
      showToast(e instanceof Error ? `本地文件解析失败：${e.message}` : '本地文件解析失败', false)
    } finally {
      setUploading(false)
    }
  }

  async function handleSave() {
    if (!validateJson(data.configFile)) return

    const payload: { configFile: string; subscriptionUrl?: string } = { configFile: data.configFile }
    const normalizedSubscription = normalizeSubscriptionUrl(data.subscriptionUrl)
    if (!normalizedSubscription.ok) {
      showToast(normalizedSubscription.error ?? '订阅 URL 格式错误', false)
      return
    }
    if (normalizedSubscription.value) {
      payload.subscriptionUrl = normalizedSubscription.value
    } else if (normalizedSubscription.shouldClear) {
      payload.subscriptionUrl = ''
    }

    setSaving(true)
    try {
      const res = await apiClient.post<{ data: { ok: boolean; synced: number; skipped: number } }>(
        '/admin/system/config',
        payload,
      )
      const { synced, skipped } = res.data
      showToast(
        skipped > 0
          ? `保存成功：已同步 ${synced} 个源站，跳过 ${skipped} 个无效项`
          : `保存成功，已同步 ${synced} 个源站到视频源配置`,
        true,
      )
    } catch (e) {
      if (e instanceof ApiClientError) {
        showToast(`保存失败：${e.message}`, false)
      } else {
        showToast('保存失败，请重试', false)
      }
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
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-[var(--muted)] uppercase tracking-wider">配置源</h2>
          <div className="inline-flex rounded-md border border-[var(--border)] bg-[var(--bg3)] p-1">
            <button
              type="button"
              data-testid="config-tab-remote"
              onClick={() => setSourceTab('remote')}
              className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                sourceTab === 'remote'
                  ? 'bg-[var(--accent)] text-black'
                  : 'text-[var(--muted)] hover:text-[var(--text)]'
              }`}
            >
              订阅 URL
            </button>
            <button
              type="button"
              data-testid="config-tab-local"
              onClick={() => setSourceTab('local')}
              className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                sourceTab === 'local'
                  ? 'bg-[var(--accent)] text-black'
                  : 'text-[var(--muted)] hover:text-[var(--text)]'
              }`}
            >
              本地上传
            </button>
          </div>
        </div>

        {sourceTab === 'remote' ? (
          <>
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
                type="button"
                onClick={handleFetch}
                disabled={fetching}
                className="shrink-0 rounded-md px-4 py-2 text-sm font-medium border border-[var(--border)] bg-[var(--bg3)] text-[var(--text)] hover:bg-[var(--bg4)] disabled:opacity-50 transition-colors"
              >
                {fetching ? '拉取中…' : '远程拉取'}
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-xs text-[var(--muted)] mb-3">
              选择本地 JSON 文件后自动解析并填充到下方编辑器
            </p>
            <div className="flex items-center gap-3">
              <input
                data-testid="config-local-file-input"
                type="file"
                accept=".json,application/json"
                onChange={(e) => { void handleLocalFileChange(e.target.files?.[0] ?? null) }}
                className="block w-full rounded-md border border-[var(--border)] bg-[var(--bg3)] px-3 py-2 text-sm text-[var(--text)] file:mr-3 file:rounded file:border-0 file:bg-[var(--accent)] file:px-3 file:py-1 file:text-xs file:font-semibold file:text-black"
              />
              {uploading && <span className="text-xs text-[var(--muted)]">解析中…</span>}
            </div>
            {selectedFileName && (
              <p className="mt-2 text-xs text-[var(--muted)]">
                已选择：{selectedFileName}
              </p>
            )}
          </>
        )}
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
          placeholder={CONFIG_FILE_PLACEHOLDER}
          rows={22}
          spellCheck={false}
          className={`w-full rounded-md border bg-[var(--bg3)] px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] resize-y font-mono ${
            jsonError ? 'border-red-500' : 'border-[var(--border)]'
          }`}
        />
      </div>

      {/* ── 粘性保存区 ─────────────────────────────────────── */}
      <div className="sticky bottom-3 z-20">
        <div className="flex items-center gap-4 rounded-lg border border-[var(--border)] bg-[var(--bg2)]/95 px-4 py-3 backdrop-blur">
          <button
            onClick={handleSave}
            disabled={saving || !!jsonError}
            className="rounded-md bg-[var(--accent)] px-5 py-2 text-sm font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-50"
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
    </div>
  )
}
