'use client'

/**
 * DiffPanel — 右上变更预览 + commit message + 保存。
 * 迁移自 apps/server（CHG-CUTOVER-QA-DEV-MIGRATE）：Tailwind 类转内联样式（server-next 无 Tailwind）。
 */

import { useState, useMemo } from 'react'
import { diffOverrides, buildCommitMessage } from './_diff'
import { unflattenOverrides } from './_paths'
import type { FlatOverrides } from './_paths'

interface DiffPanelProps {
  slug: string
  baselineOverrides: unknown
  workingFlat: FlatOverrides
  isProduction: boolean
  onSave: (commitMessage: string) => Promise<void>
}

const PANEL_STYLE: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  height: '100%',
  overflow: 'hidden',
  padding: 12,
}

const DIFF_LIST_STYLE: React.CSSProperties = {
  flex: '1 1 0%',
  overflowY: 'auto',
  borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--border-default)',
  fontSize: 'var(--font-size-xs)',
  fontFamily: 'var(--font-family-mono)',
  backgroundColor: 'var(--bg-surface-sunken)',
}

const COMMIT_TEXTAREA_STYLE: React.CSSProperties = {
  width: '100%',
  padding: '6px 8px',
  fontSize: 'var(--font-size-xs)',
  borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--border-default)',
  fontFamily: 'var(--font-family-mono)',
  resize: 'none',
  backgroundColor: 'var(--bg-surface)',
  color: 'var(--fg-default)',
}

export function DiffPanel({ slug, baselineOverrides, workingFlat, isProduction, onSave }: DiffPanelProps) {
  const workingOverrides = unflattenOverrides(workingFlat)
  const diff = useMemo(
    () => diffOverrides(baselineOverrides, workingOverrides),
    [baselineOverrides, workingOverrides],
  )

  const defaultMessage = buildCommitMessage(diff, slug)
  const [commitMessage, setCommitMessage] = useState(defaultMessage)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      await onSave(commitMessage)
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const hasChanges = diff.totalChanges > 0
  const saveDisabled = !hasChanges || saving

  return (
    <div style={PANEL_STYLE}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h3 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500, color: 'var(--fg-default)' }}>
          变更预览
        </h3>
        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--fg-subtle)' }}>
          {diff.totalChanges > 0 ? `${diff.totalChanges} 项变更` : '无变更'}
        </span>
      </div>

      <div style={DIFF_LIST_STYLE}>
        {!hasChanges && (
          <p style={{ padding: 12, color: 'var(--fg-subtle)' }}>暂无变更</p>
        )}
        {diff.added.map((d) => (
          <DiffRow key={d.path} path={d.path} newValue={d.newValue} type="added" />
        ))}
        {diff.changed.map((d) => (
          <DiffRow key={d.path} path={d.path} oldValue={d.oldValue} newValue={d.newValue} type="changed" />
        ))}
        {diff.removed.map((d) => (
          <DiffRow key={d.path} path={d.path} oldValue={d.oldValue} type="removed" />
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label style={{ fontSize: 'var(--font-size-xs)', color: 'var(--fg-muted)' }}>Commit message</label>
        <textarea
          value={commitMessage}
          onChange={(e) => setCommitMessage(e.target.value)}
          rows={2}
          style={COMMIT_TEXTAREA_STYLE}
          disabled={isProduction}
        />
      </div>

      {error && (
        <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--state-error-fg)' }}>{error}</p>
      )}

      {isProduction ? (
        <div
          style={{
            fontSize: 'var(--font-size-xs)',
            padding: '8px 12px',
            borderRadius: 'var(--radius-sm)',
            textAlign: 'center',
            backgroundColor: 'var(--state-warning-bg)',
            color: 'var(--state-warning-fg)',
            border: '1px solid var(--state-warning-border)',
          }}
        >
          只读模式 — 生产环境禁止写回
        </div>
      ) : (
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saveDisabled}
          style={{
            width: '100%',
            fontSize: 'var(--font-size-sm)',
            padding: '8px 0',
            borderRadius: 'var(--radius-sm)',
            fontWeight: 500,
            border: 'none',
            backgroundColor: 'var(--accent-default)',
            color: 'var(--accent-fg)',
            cursor: saveDisabled ? 'not-allowed' : 'pointer',
            opacity: saveDisabled ? 0.4 : 1,
            transition: 'opacity 0.15s',
          }}
        >
          {saving ? '保存中…' : '保存到源文件'}
        </button>
      )}
    </div>
  )
}

interface DiffRowProps {
  path: string
  oldValue?: string
  newValue?: string
  type: 'added' | 'changed' | 'removed'
}

const TYPE_COLOR: Record<DiffRowProps['type'], string> = {
  added: 'var(--state-success-fg)',
  changed: 'var(--accent-default)',
  removed: 'var(--state-error-fg)',
}

const TYPE_PREFIX: Record<DiffRowProps['type'], string> = {
  added: '+ ', changed: '~ ', removed: '- ',
}

function DiffRow({ path, oldValue, newValue, type }: DiffRowProps) {
  return (
    <div style={{ padding: '4px 8px', borderBottom: '1px solid var(--border-subtle)' }}>
      <span style={{ color: TYPE_COLOR[type] }}>{TYPE_PREFIX[type]}</span>
      <span style={{ color: 'var(--fg-default)' }}>{path}</span>
      {oldValue && (
        <span style={{ display: 'block', paddingLeft: 16, color: 'var(--fg-subtle)', textDecoration: 'line-through' }}>
          {oldValue}
        </span>
      )}
      {newValue && (
        <span style={{ display: 'block', paddingLeft: 16, color: TYPE_COLOR[type] }}>
          {newValue}
        </span>
      )}
    </div>
  )
}
