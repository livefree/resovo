'use client'

import { useState, useEffect, type CSSProperties } from 'react'
import { AdminInput, AdminButton, LoadingState, ErrorState, EmptyState, useToast } from '@resovo/admin-ui'
import type { SourceLineAlias } from '@/lib/sources/types'
import { listLineAliases, upsertLineAlias } from '@/lib/sources/api'

// ── 样式 ─────────────────────────────────────────────────────────

const PANEL_STYLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
}

const TABLE_STYLE: CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: 'var(--font-size-sm)',
}

const TH_STYLE: CSSProperties = {
  padding: '8px 12px',
  textAlign: 'left',
  fontSize: '11px',
  fontWeight: 600,
  color: 'var(--fg-muted)',
  borderBottom: '1px solid var(--border-subtle)',
  background: 'var(--bg-surface-elevated)',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
}

const TD_STYLE: CSSProperties = {
  padding: '8px 12px',
  borderBottom: '1px solid var(--border-subtle)',
  color: 'var(--fg-default)',
  verticalAlign: 'middle',
}

// ── 编辑行 ────────────────────────────────────────────────────────

interface AliasPanelRowProps {
  alias: SourceLineAlias
  onSave: (siteKey: string, sourceName: string, displayName: string) => Promise<void>
}

function AliasPanelRow({ alias, onSave }: AliasPanelRowProps) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(alias.displayName)
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!value.trim()) return
    setSaving(true)
    try {
      await onSave(alias.sourceSiteKey, alias.sourceName, value.trim())
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  function handleCancel() {
    setValue(alias.displayName)
    setEditing(false)
  }

  return (
    <tr>
      <td style={TD_STYLE}>
        <code style={{ fontSize: '12px', color: 'var(--fg-muted)' }}>{alias.sourceSiteKey}</code>
      </td>
      <td style={TD_STYLE}>
        <code style={{ fontSize: '12px', color: 'var(--fg-muted)' }}>{alias.sourceName}</code>
      </td>
      <td style={TD_STYLE}>
        {editing ? (
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <AdminInput
              value={value}
              onChange={(e) => setValue(e.target.value)}
              size="sm"
              disabled={saving}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleSave()
                if (e.key === 'Escape') handleCancel()
              }}
            />
            <AdminButton size="sm" onClick={() => void handleSave()} disabled={saving || !value.trim()}>
              {saving ? '…' : '保存'}
            </AdminButton>
            <AdminButton size="sm" variant="ghost" onClick={handleCancel} disabled={saving}>
              取消
            </AdminButton>
          </div>
        ) : (
          <span>{alias.displayName}</span>
        )}
      </td>
      <td style={TD_STYLE}>
        <span style={{ fontSize: '11px', color: 'var(--fg-muted)' }}>
          {new Date(alias.updatedAt).toLocaleDateString('zh-CN')}
        </span>
      </td>
      <td style={TD_STYLE}>
        {!editing && (
          <AdminButton size="sm" variant="ghost" onClick={() => setEditing(true)}>
            编辑
          </AdminButton>
        )}
      </td>
    </tr>
  )
}

// ── 主面板 ────────────────────────────────────────────────────────

export function SourceLineAliasPanel() {
  const [aliases, setAliases] = useState<SourceLineAlias[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { push } = useToast()

  function loadAliases() {
    setLoading(true)
    setError(null)
    listLineAliases()
      .then(setAliases)
      .catch(() => setError('加载别名失败'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadAliases()
  }, [])

  async function handleSave(siteKey: string, sourceName: string, displayName: string) {
    const updated = await upsertLineAlias(siteKey, sourceName, displayName)
    setAliases((prev) =>
      prev.map((a) =>
        a.sourceSiteKey === siteKey && a.sourceName === sourceName ? updated : a,
      ),
    )
    push({ title: '别名已更新', level: 'success' })
  }

  if (loading) return <LoadingState variant="skeleton" />
  if (error) return <ErrorState error={new Error(error)} onRetry={loadAliases} />
  if (aliases.length === 0) {
    return (
      <div style={PANEL_STYLE}>
        <EmptyState
          title="暂无线路别名"
          description="当视频源存在 source_site_key + source_name 组合时，可在此配置展示别名"
        />
      </div>
    )
  }

  return (
    <div style={PANEL_STYLE}>
      <table style={TABLE_STYLE}>
        <thead>
          <tr>
            <th style={TH_STYLE}>站点 Key</th>
            <th style={TH_STYLE}>线路名</th>
            <th style={TH_STYLE}>显示别名</th>
            <th style={TH_STYLE}>更新时间</th>
            <th style={TH_STYLE} />
          </tr>
        </thead>
        <tbody>
          {aliases.map((alias) => (
            <AliasPanelRow
              key={`${alias.sourceSiteKey}::${alias.sourceName}`}
              alias={alias}
              onSave={handleSave}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}
