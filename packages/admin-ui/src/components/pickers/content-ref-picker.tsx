'use client'

/**
 * content-ref-picker.tsx — ContentRefPicker 复合业务原语
 *
 * 真源：CHG-SN-8-FUP-HOME / arch-reviewer Opus A− PASS（2026-05-21）
 *
 * 根据 type 渲染对应的专用输入器：
 *   - video        → VideoPicker single（PickerVideoItem.id 作为 string value）
 *   - external_url → AdminInput type='url' + 内联 URL.parse 校验
 *   - custom_html  → AdminInput type='text'
 *   - video_type   → AdminSelect（options 由 props 注入）
 *
 * Opus 评审 3 个关键实施注意事项已落实：
 *   1. video 编辑态回显：内部 resolvedVideo state + fetcher(`q=value, limit=1`) 恢复查询 + AbortController cleanup
 *   2. type 切换 reset：由消费方负责 setField('contentRefId', '')；本组件仅清理 resolvedVideo
 *   3. videoFetcher / videoTypeOptions 缺失 → console.error + 降级 AdminInput（不 throw）
 */

import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { AdminInput } from '../admin-input/admin-input'
import { AdminSelect } from '../admin-select/admin-select'
import { VideoPicker } from './video-picker'
import type { PickerVideoItem } from './video-picker.types'
import type { ContentRefPickerProps, ContentRefType } from './content-ref-picker.types'

const WRAP_STYLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
}

const LABEL_STYLE: CSSProperties = {
  fontSize: '12px',
  fontWeight: 500,
  color: 'var(--fg-muted)',
}

const REQUIRED_STAR: CSSProperties = {
  color: 'var(--state-danger-fg, var(--state-danger))',
  marginLeft: '2px',
}

const INLINE_ERROR_STYLE: CSSProperties = {
  fontSize: '11px',
  color: 'var(--state-danger-fg, var(--state-danger))',
}

const PLACEHOLDER_BY_TYPE: Record<ContentRefType, string> = {
  video: '选择视频...',
  external_url: 'https://example.com',
  custom_html: '输入 HTML 片段 ID',
  video_type: '选择视频类型',
}

function isValidUrl(value: string): boolean {
  try {
    new URL(value)
    return true
  } catch {
    return false
  }
}

export function ContentRefPicker(props: ContentRefPickerProps) {
  const {
    type,
    value,
    onChange,
    videoFetcher,
    videoTypeOptions,
    disabled = false,
    required = false,
    error,
    label,
    placeholder,
    id,
    'aria-label': ariaLabel,
    'aria-describedby': ariaDescribedBy,
    'data-testid': testid,
  } = props

  const effectivePlaceholder = placeholder ?? PLACEHOLDER_BY_TYPE[type]

  // ── video 适配层：内部 PickerVideoItem state ─────────────────────
  const [resolvedVideo, setResolvedVideo] = useState<PickerVideoItem | null>(null)

  // type 切换时清空 resolvedVideo（消费方应同步 reset value）
  const prevTypeRef = useRef<ContentRefType>(type)
  useEffect(() => {
    if (prevTypeRef.current !== type) {
      prevTypeRef.current = type
      setResolvedVideo(null)
    }
  }, [type])

  // video 编辑态恢复：value 已有 UUID 但 resolvedVideo 不匹配时 fetch
  useEffect(() => {
    if (type !== 'video') return
    if (!value || resolvedVideo?.id === value) return
    if (!videoFetcher) return

    const ctrl = new AbortController()
    let cancelled = false
    videoFetcher({ q: value, limit: 1, signal: ctrl.signal })
      .then((res) => {
        if (cancelled) return
        const found = res.items.find((it) => it.id === value)
        if (found) setResolvedVideo(found)
      })
      .catch((err) => {
        if (cancelled) return
        if (err instanceof DOMException && err.name === 'AbortError') return
        // 恢复失败：resolvedVideo 保持 null，VideoPicker 触发器显示 placeholder；value 不丢
        // eslint-disable-next-line no-console
        console.error('ContentRefPicker: video resolver fetch failed', err)
      })
    return () => {
      cancelled = true
      ctrl.abort()
    }
  }, [type, value, resolvedVideo?.id, videoFetcher])

  // ── url 内联校验 ────────────────────────────────────────────────
  const [urlError, setUrlError] = useState<string | null>(null)

  // ── 渲染各类型子输入器 ───────────────────────────────────────────

  const labelNode = label ? (
    <label htmlFor={id} style={LABEL_STYLE}>
      {label}
      {required && <span style={REQUIRED_STAR}>*</span>}
    </label>
  ) : null

  // type='video'
  if (type === 'video') {
    if (!videoFetcher) {
      // eslint-disable-next-line no-console
      console.error('ContentRefPicker: videoFetcher is required when type is "video"; falling back to text input')
      return (
        <span style={WRAP_STYLE}>
          {labelNode}
          <AdminInput
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="（fetcher 缺失，请输入 video UUID）"
            disabled={disabled}
            required={required}
            error={Boolean(error)}
            id={id}
            aria-label={ariaLabel}
            aria-describedby={ariaDescribedBy}
            data-testid={testid ? `${testid}-fallback` : undefined}
          />
          {error && <span style={INLINE_ERROR_STYLE}>{error}</span>}
        </span>
      )
    }
    return (
      <span style={WRAP_STYLE}>
        <VideoPicker
          label={label}
          value={resolvedVideo}
          onChange={(item) => {
            setResolvedVideo(item)
            onChange(item?.id ?? '')
          }}
          fetcher={videoFetcher}
          required={required}
          disabled={disabled}
          error={error}
          placeholder={effectivePlaceholder}
          id={id}
          aria-label={ariaLabel}
          aria-describedby={ariaDescribedBy}
          data-testid={testid}
        />
      </span>
    )
  }

  // type='external_url'
  if (type === 'external_url') {
    return (
      <span style={WRAP_STYLE}>
        {labelNode}
        <AdminInput
          type="url"
          value={value}
          onChange={(e) => {
            const next = e.target.value
            onChange(next)
            if (next === '') {
              setUrlError(null)
            } else if (!isValidUrl(next)) {
              setUrlError('请输入有效的 URL（含 http:// 或 https://）')
            } else {
              setUrlError(null)
            }
          }}
          placeholder={effectivePlaceholder}
          disabled={disabled}
          required={required}
          error={Boolean(error || urlError)}
          id={id}
          aria-label={ariaLabel}
          aria-describedby={ariaDescribedBy}
          data-testid={testid}
        />
        {urlError && <span style={INLINE_ERROR_STYLE} data-testid={testid ? `${testid}-url-error` : undefined}>{urlError}</span>}
        {error && <span style={INLINE_ERROR_STYLE}>{error}</span>}
      </span>
    )
  }

  // type='custom_html'
  if (type === 'custom_html') {
    return (
      <span style={WRAP_STYLE}>
        {labelNode}
        <AdminInput
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={effectivePlaceholder}
          disabled={disabled}
          required={required}
          error={Boolean(error)}
          id={id}
          aria-label={ariaLabel}
          aria-describedby={ariaDescribedBy}
          data-testid={testid}
        />
        {error && <span style={INLINE_ERROR_STYLE}>{error}</span>}
      </span>
    )
  }

  // type='video_type'
  if (!videoTypeOptions) {
    // eslint-disable-next-line no-console
    console.error('ContentRefPicker: videoTypeOptions is required when type is "video_type"; rendering empty select')
  }
  const options = videoTypeOptions ?? []
  return (
    <span style={WRAP_STYLE}>
      {labelNode}
      <AdminSelect
        options={options}
        value={value || null}
        onChange={(next) => onChange(next ?? '')}
        placeholder={effectivePlaceholder}
        disabled={disabled}
        error={Boolean(error)}
        data-testid={testid}
      />
      {error && <span style={INLINE_ERROR_STYLE}>{error}</span>}
    </span>
  )
}
