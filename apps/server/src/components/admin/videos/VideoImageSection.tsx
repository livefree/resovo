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

interface UploadResponse {
  data: {
    url: string
    key: string
    kind: string
    contentType: string
    size: number
    hash: string
    blurhashJobId: string | null
    provider: 'r2' | 'local-fs'
  }
}

// ── 常量 ──────────────────────────────────────────────────────────

const KIND_LABELS: Record<ImageKind, string> = {
  poster:          '封面图 (poster)',
  backdrop:        '背景图 (backdrop)',
  logo:            '标志图 (logo)',
  banner_backdrop: '横幅背景 (banner)',
}

// IMG-07: 预览缩略图按 kind 的 aspect / 尺寸
const PREVIEW_ASPECT_RATIO: Record<ImageKind, string> = {
  poster:          '2 / 3',
  backdrop:        '16 / 9',
  logo:            '1 / 1',
  banner_backdrop: '16 / 9',
}
const PREVIEW_HEIGHT_PX: Record<ImageKind, number> = {
  poster:          120,
  backdrop:        80,
  logo:            64,
  banner_backdrop: 80,
}
const PREVIEW_OBJECT_FIT: Record<ImageKind, 'contain' | 'cover'> = {
  poster:          'cover',
  backdrop:        'cover',
  logo:            'contain',
  banner_backdrop: 'cover',
}

// IMG-07: mimetype / size 与后端 ImageStorageService 对齐
const ACCEPTED_MIMETYPES = 'image/jpeg,image/png,image/webp,image/avif,image/gif'
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024

function formatUploadError(err: unknown): string {
  if (err instanceof Error) {
    const msg = err.message
    if (msg.includes('PAYLOAD_TOO_LARGE') || msg.includes('413')) return '图片超过 5MB'
    if (msg.includes('UNSUPPORTED_MEDIA_TYPE') || msg.includes('415')) return '仅支持 JPEG / PNG / WebP / AVIF / GIF'
    if (msg.includes('STORAGE_NOT_CONFIGURED') || msg.includes('503')) return '服务端存储未配置'
    if (msg.includes('OWNER_NOT_FOUND') || msg.includes('404')) return '视频不存在'
    return msg
  }
  return '上传失败'
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
  // IMG-07
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [imgBroken, setImgBroken] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // url 变化时重置破图状态
  useEffect(() => { setImgBroken(false) }, [entry.url])

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

  // IMG-07: 处理文件选择 + multipart 上传
  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    // 清空 input 以便下次选同一文件也能触发 change
    e.target.value = ''
    if (!file) return

    // 前置客户端校验（与后端对齐，给更快反馈）
    if (file.size > MAX_UPLOAD_BYTES) {
      setUploadError('图片超过 5MB')
      return
    }
    if (file.type && !ACCEPTED_MIMETYPES.split(',').includes(file.type)) {
      setUploadError('仅支持 JPEG / PNG / WebP / AVIF / GIF')
      return
    }

    setUploading(true)
    setUploadError(null)
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('ownerType', 'video')
      form.append('ownerId', videoId)
      form.append('kind', kind)
      const res = await apiClient.upload<UploadResponse>('/admin/media/images', form)
      onSaved(kind, res.data.url)
    } catch (err) {
      setUploadError(formatUploadError(err))
    } finally {
      setUploading(false)
    }
  }

  function triggerFilePicker() {
    fileInputRef.current?.click()
  }

  const statusColor = STATUS_COLOR[entry.status ?? 'missing'] ?? 'var(--muted)'
  const statusLabel = STATUS_LABELS[entry.status ?? 'missing'] ?? (entry.status ?? '—')
  const isBusy = uploading || saving || (polling && entry.status === 'pending_review')
  const aspectRatio = PREVIEW_ASPECT_RATIO[kind]
  const previewHeight = PREVIEW_HEIGHT_PX[kind]
  const objectFit = PREVIEW_OBJECT_FIT[kind]

  return (
    <div
      className="rounded border p-3 space-y-2"
      style={{ borderColor: 'var(--border)', background: 'var(--bg3)' }}
      data-testid={`image-row-${kind}`}
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
          data-testid={`image-status-${kind}`}
        >
          {polling && entry.status === 'pending_review' ? '检测中…' : statusLabel}
        </span>
      </div>

      {/* IMG-07: 缩略图预览（有 url 且未破图时）+ URL 文本（次要） */}
      {entry.url && !imgBroken ? (
        <div className="space-y-1">
          <div
            className="flex items-center gap-3 rounded border p-2"
            style={{ borderColor: 'var(--border)', background: 'var(--bg2)' }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={entry.url}
              alt={KIND_LABELS[kind]}
              style={{
                height: previewHeight,
                aspectRatio,
                objectFit,
                background: 'var(--bg3)',
                borderRadius: 4,
                flex: '0 0 auto',
              }}
              onError={() => setImgBroken(true)}
              data-testid={`image-preview-${kind}`}
            />
            <p
              className="break-all text-xs flex-1 min-w-0"
              style={{ color: 'var(--muted)' }}
              title={entry.url}
            >
              {entry.url.length > 60 ? `${entry.url.slice(0, 60)}…` : entry.url}
            </p>
          </div>
        </div>
      ) : entry.url && imgBroken ? (
        <div className="space-y-1">
          <p className="text-xs" style={{ color: 'var(--status-danger)' }}>
            ⚠ 预览加载失败
          </p>
          <p
            className="break-all text-xs"
            style={{ color: 'var(--muted)' }}
            title={entry.url}
          >
            {entry.url.length > 80 ? `${entry.url.slice(0, 80)}…` : entry.url}
          </p>
        </div>
      ) : (
        <p className="text-xs" style={{ color: 'var(--muted)' }}>（暂无图片）</p>
      )}

      {/* 隐藏 file input，由上传按钮触发 */}
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_MIMETYPES}
        onChange={(e) => { void handleFileChange(e) }}
        style={{ display: 'none' }}
        data-testid={`image-file-input-${kind}`}
      />

      {uploadError && (
        <p className="text-xs" style={{ color: 'var(--status-danger)' }} data-testid={`image-upload-error-${kind}`}>
          {uploadError}
        </p>
      )}

      {!editing ? (
        <div className="flex gap-2">
          <button
            type="button"
            disabled={isBusy}
            onClick={triggerFilePicker}
            className="rounded border px-2 py-1 text-xs transition-colors disabled:opacity-40"
            style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}
            data-testid={`image-upload-btn-${kind}`}
          >
            {uploading ? '上传中…' : '上传新图'}
          </button>
          <button
            type="button"
            disabled={isBusy}
            onClick={() => { setEditing(true); setInputUrl(entry.url ?? ''); setUploadError(null) }}
            className="rounded border px-2 py-1 text-xs transition-colors disabled:opacity-40"
            style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}
            data-testid={`image-url-btn-${kind}`}
          >
            改 URL
          </button>
        </div>
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
