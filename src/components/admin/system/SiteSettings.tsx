/**
 * SiteSettings.tsx — 站点配置面板（Client Component）
 * CHG-35: 分组表单，保存调 POST /admin/system/settings
 */

'use client'

import { useState, useEffect, useCallback } from 'react'
import { apiClient } from '@/lib/api-client'
import type { SiteSettings } from '@/types'

// ── 默认值 ────────────────────────────────────────────────────

const DEFAULT_SETTINGS: SiteSettings = {
  siteName:             '',
  siteAnnouncement:     '',
  doubanProxy:          '',
  doubanCookie:         '',
  showAdultContent:     false,
  contentFilterEnabled: true,
  videoProxyEnabled:    false,
  videoProxyUrl:        '',
  autoCrawlEnabled:     false,
  autoCrawlMaxPerRun:   100,
  autoCrawlRecentOnly:  false,
  autoCrawlRecentDays:  30,
}

// ── 子组件 ────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-[var(--border)] bg-[var(--bg2)] p-5 mb-5">
      <h2 className="text-sm font-semibold text-[var(--muted)] uppercase tracking-wider mb-4">{title}</h2>
      <div className="space-y-4">{children}</div>
    </section>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-[var(--text)] mb-1">{label}</label>
      {children}
      {hint && <p className="mt-1 text-xs text-[var(--muted)]">{hint}</p>}
    </div>
  )
}

function TextInput({ value, onChange, placeholder, maxLength }: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  maxLength?: number
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      maxLength={maxLength}
      className="w-full rounded-md border border-[var(--border)] bg-[var(--bg3)] px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
    />
  )
}

function TextArea({ value, onChange, placeholder, rows }: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  rows?: number
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows ?? 3}
      className="w-full rounded-md border border-[var(--border)] bg-[var(--bg3)] px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] resize-y"
    />
  )
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer select-none">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors ${checked ? 'bg-[var(--accent)]' : 'bg-[var(--border)]'}`}
      >
        <span
          className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform mt-0.5 ${checked ? 'translate-x-4' : 'translate-x-0.5'}`}
        />
      </button>
      <span className="text-sm text-[var(--text)]">{label}</span>
    </label>
  )
}

function NumberInput({ value, onChange, min, max }: {
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
}) {
  return (
    <input
      type="number"
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      min={min}
      max={max}
      className="w-32 rounded-md border border-[var(--border)] bg-[var(--bg3)] px-3 py-2 text-sm text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
    />
  )
}

// ── 主组件 ────────────────────────────────────────────────────

export function SiteSettings() {
  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SETTINGS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3000)
  }

  const fetchSettings = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiClient.get<{ data: SiteSettings }>('/admin/system/settings')
      setSettings({ ...DEFAULT_SETTINGS, ...res.data })
    } catch {
      // 静默：表格不存在时使用默认值
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchSettings() }, [fetchSettings])

  const handleSave = async () => {
    setSaving(true)
    try {
      await apiClient.post('/admin/system/settings', settings)
      showToast('保存成功', true)
    } catch {
      showToast('保存失败，请重试', false)
    } finally {
      setSaving(false)
    }
  }

  function set<K extends keyof SiteSettings>(key: K, value: SiteSettings[K]) {
    setSettings((prev) => ({ ...prev, [key]: value }))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-sm text-[var(--muted)]">
        加载中…
      </div>
    )
  }

  return (
    <div>
      {/* ── 基础信息 ─────────────────────────────────────── */}
      <Section title="基础信息">
        <Field label="站点名称">
          <TextInput value={settings.siteName} onChange={(v) => set('siteName', v)} placeholder="Resovo" maxLength={100} />
        </Field>
        <Field label="站点公告" hint="显示在首页或全局提示条，留空则不显示">
          <TextArea value={settings.siteAnnouncement} onChange={(v) => set('siteAnnouncement', v)} placeholder="在此输入公告内容…" rows={3} />
        </Field>
      </Section>

      {/* ── Douban 集成 ──────────────────────────────────── */}
      <Section title="Douban 集成">
        <Field label="Douban API 代理" hint="留空则直连 Douban API，建议填写代理以提升稳定性">
          <TextInput value={settings.doubanProxy} onChange={(v) => set('doubanProxy', v)} placeholder="https://your-douban-proxy.example.com" />
        </Field>
        <Field label="Douban Cookie" hint="用于获取评分和详细数据，可从浏览器 DevTools 复制">
          <TextArea value={settings.doubanCookie} onChange={(v) => set('doubanCookie', v)} placeholder="bid=xxx; dbcl2=&quot;xxx&quot;; ck=xxx;" rows={2} />
        </Field>
      </Section>

      {/* ── 内容过滤 ──────────────────────────────────────── */}
      <Section title="内容过滤">
        <Toggle
          checked={settings.contentFilterEnabled}
          onChange={(v) => set('contentFilterEnabled', v)}
          label="启用关键词过滤（屏蔽敏感分类标题）"
        />
        <Toggle
          checked={settings.showAdultContent}
          onChange={(v) => set('showAdultContent', v)}
          label="显示成人内容（仅对标记了 is_adult 的爬虫源站生效）"
        />
      </Section>

      {/* ── 视频代理 ──────────────────────────────────────── */}
      <Section title="视频代理">
        <Toggle
          checked={settings.videoProxyEnabled}
          onChange={(v) => set('videoProxyEnabled', v)}
          label="启用视频代理（通过 Worker 转发播放 URL，解决跨域问题）"
        />
        {settings.videoProxyEnabled && (
          <Field label="代理地址" hint="Cloudflare Worker 或其他 CORS 代理地址">
            <TextInput value={settings.videoProxyUrl} onChange={(v) => set('videoProxyUrl', v)} placeholder="https://proxy.example.workers.dev" />
          </Field>
        )}
      </Section>

      {/* ── 自动采集 ──────────────────────────────────────── */}
      <Section title="自动采集（定时爬虫）">
        <Toggle
          checked={settings.autoCrawlEnabled}
          onChange={(v) => set('autoCrawlEnabled', v)}
          label="启用定时自动采集（每日凌晨 3:00 增量采集）"
        />
        {settings.autoCrawlEnabled && (
          <>
            <Field label="单次最大采集条数（1–1000）">
              <NumberInput value={settings.autoCrawlMaxPerRun} onChange={(v) => set('autoCrawlMaxPerRun', v)} min={1} max={1000} />
            </Field>
            <Toggle
              checked={settings.autoCrawlRecentOnly}
              onChange={(v) => set('autoCrawlRecentOnly', v)}
              label="仅采集最近更新的记录"
            />
            {settings.autoCrawlRecentOnly && (
              <Field label="最近天数范围（1–365）">
                <NumberInput value={settings.autoCrawlRecentDays} onChange={(v) => set('autoCrawlRecentDays', v)} min={1} max={365} />
              </Field>
            )}
          </>
        )}
      </Section>

      {/* ── 保存按钮 ──────────────────────────────────────── */}
      <div className="flex items-center gap-4">
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-md px-5 py-2 text-sm font-semibold bg-[var(--accent)] text-black hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {saving ? '保存中…' : '保存配置'}
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
