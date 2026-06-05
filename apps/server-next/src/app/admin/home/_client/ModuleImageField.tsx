'use client'

/**
 * ModuleImageField.tsx — 运营横图字段（CHG-HOME-UX-05；HomeModuleDrawer 500 行红线预防性拆分）
 *
 * 形态（参照 v1 BannerForm 图片段，进度条按 CHG-HOME-UX-03 偏离登记改 loading 态）：
 *   - 外链 URL input（新建/编辑均可）
 *   - 上传按钮：仅编辑态（moduleId 非空）可见——上传走「写回 owner 列」模式需先有
 *     模块 id（D-104-10 / ADR-052 D-052-11）
 *   - 16:9 预览（value 非空时）
 */

import { useRef, useState, type CSSProperties, type ChangeEvent } from 'react'
import { AdminButton, AdminInput } from '@resovo/admin-ui'
import { uploadHomeModuleImage } from '@/lib/home-modules/api'

const FIELD_STYLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
}

const LABEL_STYLE: CSSProperties = {
  fontSize: 'var(--font-size-xs)',
  fontWeight: 500,
  color: 'var(--fg-default)',
}

const HINT_STYLE: CSSProperties = {
  fontSize: 'var(--font-size-2xs)',
  color: 'var(--fg-muted)',
}

const ERROR_STYLE: CSSProperties = {
  fontSize: 'var(--font-size-2xs)',
  color: 'var(--state-error-fg)',
}

const ROW_STYLE: CSSProperties = {
  display: 'flex',
  gap: '8px',
  alignItems: 'center',
}

// 16:9 预览（Drawer 内宽 ~400 → 192×108 紧凑）
const PREVIEW_STYLE: CSSProperties = {
  width: 192,
  height: 108,
  objectFit: 'cover',
  borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--border-subtle)',
  background: 'var(--bg-surface-sunken)',
  marginTop: '6px',
}

export interface ModuleImageFieldProps {
  /** 当前 imageUrl（外链或已上传 URL）；'' 表示无图 */
  readonly value: string
  readonly onChange: (next: string) => void
  /** 编辑态模块 id；null=新建态（上传按钮隐藏，仅外链） */
  readonly moduleId: string | null
}

export function ModuleImageField({ value, onChange, moduleId }: ModuleImageFieldProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    // 允许重复选同一文件
    e.target.value = ''
    if (!file || !moduleId) return
    setUploading(true)
    setUploadError(null)
    try {
      const { url } = await uploadHomeModuleImage(moduleId, file)
      // 后端已写回 image_url；同步表单值（提交时 PATCH 同值幂等无害）
      onChange(url)
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : '上传失败，请稍后重试')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div style={FIELD_STYLE}>
      <label style={LABEL_STYLE}>运营横图</label>
      <div style={ROW_STYLE}>
        <div style={{ flex: '1 1 auto' }}>
          <AdminInput
            type="text"
            value={value}
            onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
            placeholder="https://…（留空时 video 类型回退视频封面）"
            size="md"
            data-testid="drawer-image-url"
            aria-label="运营横图 URL"
          />
        </div>
        {moduleId && (
          <AdminButton
            variant="default"
            size="md"
            type="button"
            loading={uploading}
            onClick={() => fileInputRef.current?.click()}
            data-testid="drawer-image-upload-btn"
          >
            上传
          </AdminButton>
        )}
      </div>
      {!moduleId && (
        <span style={HINT_STYLE}>新建保存后可上传本地图片（上传需先有模块 ID）</span>
      )}
      {uploadError && <span style={ERROR_STYLE} role="alert">{uploadError}</span>}
      {value && (
        // 预览为装饰性回显
        // eslint-disable-next-line @next/next/no-img-element
        <img src={value} alt="" aria-hidden="true" style={PREVIEW_STYLE} data-testid="drawer-image-preview" />
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
        style={{ display: 'none' }}
        onChange={(e) => void handleFileChange(e)}
        data-testid="drawer-image-file-input"
      />
    </div>
  )
}
