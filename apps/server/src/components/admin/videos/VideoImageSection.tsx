'use client'

import { useState, useEffect } from 'react'
import { apiClient } from '@/lib/api-client'

// ── 类型 ──────────────────────────────────────────────────────────

type ImageKind = 'poster' | 'backdrop' | 'logo' | 'banner_backdrop'

interface ImageEntry {
  url: string | null
  status: string | null
}

interface ImagesData {
  poster: ImageEntry
  backdrop: ImageEntry
  logo: ImageEntry
  banner_backdrop: ImageEntry
}

// ── 常量 ──────────────────────────────────────────────────────────

const KIND_LABELS: Record<ImageKind, string> = {
  poster:          '封面图 (poster)',
  backdrop:        '背景图 (backdrop)',
  logo:            '标志图 (logo)',
  banner_backdrop: '横幅背景 (banner)',
}

const STATUS_TONE: Record<string, string> = {
  ok:             'var(--status-success)',
  pending_review: 'var(--status-warning)',
  broken:         'var(--status-danger)',
  missing:        'var(--muted)',
}

const STATUS_LABELS: Record<string, string> = {
  ok:             '正常',
  pending_review: '待检测',
  broken:         '破损',
  missing:        '缺图',
}

// ── 子组件 ────────────────────────────────────────────────────────

interface ImageRowProps {
  kind: ImageKind
  entry: ImageEntry
  videoId: string
  onSaved: (kind: ImageKind, url: string) => void
}

function ImageRow({ kind, entry, videoId, onSaved }: ImageRowProps) {
  const [editing, setEditing] = useState(false)
  const [inputUrl, setInputUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  async function handleSave() {
    if (!inputUrl.trim()) return
    setSaving(true)
    setSaveError(null)
    try {
      await apiClient.put(`/admin/videos/${videoId}/images`, { kind, url: inputUrl.trim() })
      onSaved(kind, inputUrl.trim())
      setEditing(false)
      setInputUrl('')
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const statusColor = STATUS_TONE[entry.status ?? 'missing'] ?? 'var(--muted)'
  const statusLabel = STATUS_LABELS[entry.status ?? 'missing'] ?? (entry.status ?? '—')

  return (
    <div
      className="rounded border p-3 space-y-2"
      style={{ borderColor: 'var(--border)', background: 'var(--bg3)' }}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>
          {KIND_LABELS[kind]}
        </span>
        <span
          className="rounded px-1.5 py-0.5 text-xs font-medium"
          style={{ color: statusColor, background: `color-mix(in srgb, ${statusColor} 15%, transparent)` }}
        >
          {statusLabel}
        </span>
      </div>

      {entry.url ? (
        <p
          className="break-all text-xs"
          style={{ color: 'var(--muted)' }}
          title={entry.url}
        >
          {entry.url.length > 80 ? `${entry.url.slice(0, 80)}…` : entry.url}
        </p>
      ) : (
        <p className="text-xs" style={{ color: 'var(--muted)' }}>（暂无图片）</p>
      )}

      {!editing ? (
        <button
          type="button"
          onClick={() => { setEditing(true); setInputUrl(entry.url ?? '') }}
          className="rounded border px-2 py-1 text-xs transition-colors"
          style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}
        >
          更换 URL
        </button>
      ) : (
        <div className="space-y-2">
          <input
            type="url"
            value={inputUrl}
            onChange={(e) => setInputUrl(e.target.value)}
            placeholder="https://..."
            className="w-full rounded border px-2 py-1.5 text-sm focus:outline-none focus:ring-1"
            style={{
              borderColor: 'var(--border)',
              background: 'var(--bg2)',
              color: 'var(--text)',
            }}
          />
          {saveError && (
            <p className="text-xs" style={{ color: 'var(--status-danger)' }}>{saveError}</p>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              disabled={saving || !inputUrl.trim()}
              onClick={() => { void handleSave() }}
              className="rounded border px-2 py-1 text-xs disabled:opacity-50"
              style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}
            >
              {saving ? '保存中…' : '保存'}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => { setEditing(false); setSaveError(null) }}
              className="rounded border px-2 py-1 text-xs"
              style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}
            >
              取消
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── 主组件 ────────────────────────────────────────────────────────

const IMAGE_KINDS: ImageKind[] = ['poster', 'backdrop', 'logo', 'banner_backdrop']

export function VideoImageSection({ videoId }: { videoId: string }) {
  const [data, setData] = useState<ImagesData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiClient
      .get<{ data: ImagesData }>(`/admin/videos/${videoId}/images`)
      .then((res) => setData(res.data))
      .catch(() => {
        // 加载失败时以空占位渲染，不阻断表单
      })
      .finally(() => setLoading(false))
  }, [videoId])

  function handleSaved(kind: ImageKind, url: string) {
    setData((prev) =>
      prev
        ? { ...prev, [kind]: { url, status: 'pending_review' } }
        : prev
    )
  }

  return (
    <section
      className="space-y-3 rounded-md border p-4"
      style={{ borderColor: 'var(--border)', background: 'var(--bg2)' }}
      data-testid="admin-video-image-section"
    >
      <h2 className="text-sm font-medium" style={{ color: 'var(--text)' }}>图片管理</h2>

      {loading && (
        <p className="text-sm" style={{ color: 'var(--muted)' }}>加载中…</p>
      )}

      {!loading && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {IMAGE_KINDS.map((kind) => (
            <ImageRow
              key={kind}
              kind={kind}
              entry={data?.[kind] ?? { url: null, status: null }}
              videoId={videoId}
              onSaved={handleSaved}
            />
          ))}
        </div>
      )}
    </section>
  )
}
