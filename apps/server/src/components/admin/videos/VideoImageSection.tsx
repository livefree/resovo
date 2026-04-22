'use client'

import { useState, useEffect, useRef } from 'react'
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
  lastStatusUpdatedAt: string | null
}

// ── 常量 ──────────────────────────────────────────────────────────

const KIND_LABELS: Record<ImageKind, string> = {
  poster:          '封面图 (poster)',
  backdrop:        '背景图 (backdrop)',
  logo:            '标志图 (logo)',
  banner_backdrop: '横幅背景 (banner)',
}

const STATUS_COLOR: Record<string, string> = {
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

const IMAGE_KINDS: ImageKind[] = ['poster', 'backdrop', 'logo', 'banner_backdrop']

// 轮询参数
const POLL_INTERVAL_MS = 2000
const POLL_MAX_ATTEMPTS = 6   // 最多 12 秒

// ── 子组件：单行图片 ──────────────────────────────────────────────

interface ImageRowProps {
  kind: ImageKind
  entry: ImageEntry
  polling: boolean
  videoId: string
  onSaved: (kind: ImageKind, url: string) => void
}

function ImageRow({ kind, entry, polling, videoId, onSaved }: ImageRowProps) {
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

  const statusColor = STATUS_COLOR[entry.status ?? 'missing'] ?? 'var(--muted)'
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
          style={{
            color: statusColor,
            background: `color-mix(in srgb, ${statusColor} 15%, transparent)`,
          }}
        >
          {polling && entry.status === 'pending_review' ? '检测中…' : statusLabel}
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
          disabled={polling && entry.status === 'pending_review'}
          onClick={() => { setEditing(true); setInputUrl(entry.url ?? '') }}
          className="rounded border px-2 py-1 text-xs transition-colors disabled:opacity-40"
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

export function VideoImageSection({ videoId }: { videoId: string }) {
  const [data, setData] = useState<ImagesData | null>(null)
  const [loading, setLoading] = useState(true)
  const [polling, setPolling] = useState(false)
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pollAttempts = useRef(0)

  async function fetchImages(): Promise<ImagesData | null> {
    try {
      const res = await apiClient.get<{ data: ImagesData }>(`/admin/videos/${videoId}/images`)
      return res.data
    } catch {
      return null
    }
  }

  useEffect(() => {
    fetchImages()
      .then((d) => { if (d) setData(d) })
      .finally(() => setLoading(false))
    return () => {
      if (pollTimer.current) clearTimeout(pollTimer.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId])

  function startPolling(savedKind: ImageKind) {
    pollAttempts.current = 0
    setPolling(true)

    function tick() {
      pollAttempts.current += 1
      fetchImages().then((fresh) => {
        if (!fresh) {
          if (pollAttempts.current < POLL_MAX_ATTEMPTS) {
            pollTimer.current = setTimeout(tick, POLL_INTERVAL_MS)
          } else {
            setPolling(false)
          }
          return
        }
        setData(fresh)
        const stillPending = fresh[savedKind]?.status === 'pending_review'
        if (stillPending && pollAttempts.current < POLL_MAX_ATTEMPTS) {
          pollTimer.current = setTimeout(tick, POLL_INTERVAL_MS)
        } else {
          setPolling(false)
        }
      })
    }

    pollTimer.current = setTimeout(tick, POLL_INTERVAL_MS)
  }

  function handleSaved(kind: ImageKind, url: string) {
    setData((prev) =>
      prev ? { ...prev, [kind]: { url, status: 'pending_review' } } : prev
    )
    if (pollTimer.current) clearTimeout(pollTimer.current)
    startPolling(kind)
  }

  function formatDate(iso: string | null | undefined): string {
    if (!iso) return '—'
    try {
      return new Date(iso).toLocaleString('zh-CN', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit',
      })
    } catch {
      return iso
    }
  }

  return (
    <section
      className="space-y-3 rounded-md border p-4"
      style={{ borderColor: 'var(--border)', background: 'var(--bg2)' }}
      data-testid="admin-video-image-section"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium" style={{ color: 'var(--text)' }}>图片管理</h2>
        {data?.lastStatusUpdatedAt && (
          <span className="text-xs" style={{ color: 'var(--muted)' }}>
            最近状态更新：{formatDate(data.lastStatusUpdatedAt)}
          </span>
        )}
      </div>

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
              polling={polling}
              videoId={videoId}
              onSaved={handleSaved}
            />
          ))}
        </div>
      )}
    </section>
  )
}
