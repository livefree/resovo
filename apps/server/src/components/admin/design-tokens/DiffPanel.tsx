'use client'

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

  return (
    <div className="flex flex-col gap-3 h-full overflow-hidden p-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium" style={{ color: 'var(--fg-default)' }}>
          变更预览
        </h3>
        <span className="text-xs" style={{ color: 'var(--fg-subtle)' }}>
          {diff.totalChanges > 0 ? `${diff.totalChanges} 项变更` : '无变更'}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto rounded border text-xs font-mono"
        style={{ borderColor: 'var(--border-default)', backgroundColor: 'var(--bg-surface-sunken)' }}>
        {!hasChanges && (
          <p className="p-3" style={{ color: 'var(--fg-subtle)' }}>暂无变更</p>
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

      <div className="flex flex-col gap-1.5">
        <label className="text-xs" style={{ color: 'var(--fg-muted)' }}>Commit message</label>
        <textarea
          value={commitMessage}
          onChange={(e) => setCommitMessage(e.target.value)}
          rows={2}
          className="w-full px-2 py-1.5 text-xs rounded border font-mono resize-none"
          style={{ borderColor: 'var(--border-default)', backgroundColor: 'var(--bg-surface)', color: 'var(--fg-default)' }}
          disabled={isProduction}
        />
      </div>

      {error && (
        <p className="text-xs" style={{ color: 'var(--state-error-fg)' }}>{error}</p>
      )}

      {isProduction ? (
        <div
          className="text-xs px-3 py-2 rounded text-center"
          style={{ backgroundColor: 'var(--state-warning-bg)', color: 'var(--state-warning-fg)', border: '1px solid var(--state-warning-border)' }}
        >
          只读模式 — 生产环境禁止写回
        </div>
      ) : (
        <button
          onClick={() => void handleSave()}
          disabled={!hasChanges || saving}
          className="w-full text-sm py-2 rounded font-medium transition-opacity disabled:opacity-40"
          style={{ backgroundColor: 'var(--accent-default)', color: 'var(--accent-fg)' }}
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

function DiffRow({ path, oldValue, newValue, type }: DiffRowProps) {
  const typeColor: Record<DiffRowProps['type'], string> = {
    added: 'var(--state-success-fg)',
    changed: 'var(--accent-default)',
    removed: 'var(--state-error-fg)',
  }
  const prefix: Record<DiffRowProps['type'], string> = {
    added: '+ ', changed: '~ ', removed: '- ',
  }

  return (
    <div className="px-2 py-1 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
      <span style={{ color: typeColor[type] }}>{prefix[type]}</span>
      <span style={{ color: 'var(--fg-default)' }}>{path}</span>
      {oldValue && (
        <span className="block pl-4" style={{ color: 'var(--fg-subtle)', textDecoration: 'line-through' }}>
          {oldValue}
        </span>
      )}
      {newValue && (
        <span className="block pl-4" style={{ color: typeColor[type] }}>
          {newValue}
        </span>
      )}
    </div>
  )
}
