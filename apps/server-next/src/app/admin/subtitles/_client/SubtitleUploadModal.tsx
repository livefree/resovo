'use client'

/**
 * SubtitleUploadModal — 管理员手动上传字幕 Modal（CHG-SN-7-MISC-SUBTITLES-2 / ADR-134）
 *
 * 字段：videoId / language / label / format / fileUrl / episodeNumber?
 * 管理员直接指定 R2 URL，无 multipart。创建后 is_verified=true，不进待审队列。
 */
import React, { useState, useEffect } from 'react'
import { Modal } from '@resovo/admin-ui'

const FIELD_STYLE: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  marginBottom: 14,
}

const LABEL_STYLE: React.CSSProperties = {
  fontSize: 'var(--font-size-xs)',
  fontWeight: 600,
  color: 'var(--fg-default)',
}

const INPUT_STYLE: React.CSSProperties = {
  padding: '6px 10px',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-sm)',
  background: 'var(--bg-surface)',
  color: 'var(--fg-default)',
  fontSize: 'var(--font-size-sm-tight)',
}

const ERROR_STYLE: React.CSSProperties = {
  fontSize: 'var(--font-size-xxs)',
  color: 'var(--state-error-fg)',
}

const FOOTER_STYLE: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: 8,
  marginTop: 16,
}

const BTN_GHOST_STYLE: React.CSSProperties = {
  padding: '6px 14px',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-sm)',
  background: 'var(--bg-surface-elevated)',
  color: 'var(--fg-muted)',
  cursor: 'pointer',
  fontSize: 'var(--font-size-sm-tight)',
}

const BTN_PRIMARY_STYLE: React.CSSProperties = {
  ...BTN_GHOST_STYLE,
  background: 'var(--accent-default)',
  color: 'var(--fg-on-accent)',
  borderColor: 'var(--accent-default)',
}

const LANGUAGE_OPTIONS = [
  { value: 'zh-CN', label: '中文简体' },
  { value: 'zh-TW', label: '中文繁体' },
  { value: 'en',    label: '英文' },
  { value: 'ja',    label: '日文' },
  { value: 'ko',    label: '韩文' },
  { value: 'fr',    label: '法文' },
  { value: 'de',    label: '德文' },
  { value: 'es',    label: '西班牙文' },
]

const FORMAT_OPTIONS = [
  { value: 'srt', label: 'SRT' },
  { value: 'vtt', label: 'VTT' },
  { value: 'ass', label: 'ASS' },
]

export interface SubtitleUploadModalProps {
  readonly open: boolean
  readonly onClose: () => void
  readonly onSubmit: (input: {
    videoId: string
    language: string
    label: string
    format: 'vtt' | 'srt' | 'ass'
    fileUrl: string
    episodeNumber: number | null
  }) => void
  readonly submitting?: boolean
  readonly submitError?: string | null
}

export function SubtitleUploadModal({
  open,
  onClose,
  onSubmit,
  submitting = false,
  submitError,
}: SubtitleUploadModalProps): React.ReactElement {
  const [videoId, setVideoId] = useState('')
  const [language, setLanguage] = useState('zh-CN')
  const [label, setLabel] = useState('')
  const [format, setFormat] = useState<'vtt' | 'srt' | 'ass'>('srt')
  const [fileUrl, setFileUrl] = useState('')
  const [episodeNumber, setEpisodeNumber] = useState('')
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({})

  useEffect(() => {
    if (open) {
      setVideoId('')
      setLanguage('zh-CN')
      setLabel('')
      setFormat('srt')
      setFileUrl('')
      setEpisodeNumber('')
      setErrors({})
    }
  }, [open])

  // 语言选中后自动填充 label
  const handleLanguageChange = (val: string) => {
    setLanguage(val)
    const opt = LANGUAGE_OPTIONS.find((o) => o.value === val)
    if (opt && !label) setLabel(opt.label)
  }

  const validate = (): boolean => {
    const errs: Record<string, string> = {}
    if (!videoId.trim()) errs.videoId = '必填'
    else if (!/^[0-9a-f-]{36}$/i.test(videoId.trim())) errs.videoId = '必须是有效 UUID'
    if (!label.trim()) errs.label = '必填'
    if (!fileUrl.trim()) errs.fileUrl = '必填'
    else {
      try { new URL(fileUrl.trim()) }
      catch { errs.fileUrl = '必须是有效 URL' }
    }
    if (episodeNumber && !/^\d+$/.test(episodeNumber)) errs.episodeNumber = '必须是正整数'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    onSubmit({
      videoId: videoId.trim(),
      language,
      label: label.trim(),
      format,
      fileUrl: fileUrl.trim(),
      episodeNumber: episodeNumber ? parseInt(episodeNumber, 10) : null,
    })
  }

  return (
    <Modal open={open} onClose={onClose} title="上传字幕" size="sm" data-testid="subtitle-upload-modal">
      <form onSubmit={handleSubmit} noValidate data-subtitle-upload-form>
        <div style={FIELD_STYLE}>
          <label style={LABEL_STYLE} htmlFor="sub-video-id">视频 ID（UUID）</label>
          <input
            id="sub-video-id"
            type="text"
            value={videoId}
            onChange={(e) => { setVideoId(e.target.value); setErrors((prev) => ({ ...prev, videoId: undefined })) }}
            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            style={{ ...INPUT_STYLE, borderColor: errors.videoId ? 'var(--state-error-border)' : 'var(--border-default)' }}
            autoFocus
          />
          {errors.videoId && <span style={ERROR_STYLE}>{errors.videoId}</span>}
        </div>

        <div style={FIELD_STYLE}>
          <label style={LABEL_STYLE} htmlFor="sub-language">语言</label>
          <select
            id="sub-language"
            value={language}
            onChange={(e) => handleLanguageChange(e.target.value)}
            style={INPUT_STYLE}
          >
            {LANGUAGE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}（{o.value}）</option>
            ))}
          </select>
        </div>

        <div style={FIELD_STYLE}>
          <label style={LABEL_STYLE} htmlFor="sub-label">标签</label>
          <input
            id="sub-label"
            type="text"
            value={label}
            onChange={(e) => { setLabel(e.target.value); setErrors((prev) => ({ ...prev, label: undefined })) }}
            placeholder="如：中文简体"
            style={{ ...INPUT_STYLE, borderColor: errors.label ? 'var(--state-error-border)' : 'var(--border-default)' }}
          />
          {errors.label && <span style={ERROR_STYLE}>{errors.label}</span>}
        </div>

        <div style={FIELD_STYLE}>
          <label style={LABEL_STYLE} htmlFor="sub-format">格式</label>
          <select id="sub-format" value={format} onChange={(e) => setFormat(e.target.value as 'vtt' | 'srt' | 'ass')} style={INPUT_STYLE}>
            {FORMAT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <div style={FIELD_STYLE}>
          <label style={LABEL_STYLE} htmlFor="sub-file-url">字幕文件 URL（R2）</label>
          <input
            id="sub-file-url"
            type="url"
            value={fileUrl}
            onChange={(e) => { setFileUrl(e.target.value); setErrors((prev) => ({ ...prev, fileUrl: undefined })) }}
            placeholder="https://r2.example.com/subtitles/..."
            style={{ ...INPUT_STYLE, borderColor: errors.fileUrl ? 'var(--state-error-border)' : 'var(--border-default)' }}
          />
          {errors.fileUrl && <span style={ERROR_STYLE}>{errors.fileUrl}</span>}
        </div>

        <div style={FIELD_STYLE}>
          <label style={LABEL_STYLE} htmlFor="sub-episode">集数（可选，电影留空）</label>
          <input
            id="sub-episode"
            type="number"
            min={1}
            value={episodeNumber}
            onChange={(e) => { setEpisodeNumber(e.target.value); setErrors((prev) => ({ ...prev, episodeNumber: undefined })) }}
            placeholder="如：1"
            style={{ ...INPUT_STYLE, borderColor: errors.episodeNumber ? 'var(--state-error-border)' : 'var(--border-default)' }}
          />
          {errors.episodeNumber && <span style={ERROR_STYLE}>{errors.episodeNumber}</span>}
        </div>

        {submitError && (
          <div style={{ ...ERROR_STYLE, marginBottom: 8, padding: '4px 8px', background: 'var(--state-error-bg)', borderRadius: 4 }}>
            {submitError}
          </div>
        )}

        <div style={FOOTER_STYLE}>
          <button type="button" style={BTN_GHOST_STYLE} onClick={onClose} disabled={submitting}>取消</button>
          <button type="submit" style={BTN_PRIMARY_STYLE} disabled={submitting}>
            {submitting ? '提交中…' : '上传字幕'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
