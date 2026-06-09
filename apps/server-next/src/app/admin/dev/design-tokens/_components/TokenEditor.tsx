'use client'

/**
 * TokenEditor — 中栏 brand override 字段编辑器。
 * 迁移自 apps/server（CHG-CUTOVER-QA-DEV-MIGRATE）：Tailwind 类转内联样式（server-next 无 Tailwind）。
 */

import { useState, useCallback } from 'react'
import { InheritanceBadge } from './InheritanceBadge'
import type { FlatOverrides } from './_paths'

interface TokenEditorProps {
  overrideMap: Record<string, 'base' | 'brand-override'>
  workingFlat: FlatOverrides
  dirtyPaths: ReadonlySet<string>
  onWorkingChange: (flat: FlatOverrides, dirtyPaths: Set<string>) => void
}

const SEARCH_INPUT_STYLE: React.CSSProperties = {
  width: '100%',
  padding: '6px 12px',
  fontSize: 'var(--font-size-sm)',
  borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--border-default)',
  backgroundColor: 'var(--bg-surface)',
  color: 'var(--fg-default)',
  flexShrink: 0,
}

export function TokenEditor({ overrideMap, workingFlat, dirtyPaths, onWorkingChange }: TokenEditorProps) {
  const [filter, setFilter] = useState('')

  const overridePaths = Object.keys(workingFlat).filter((p) => p.includes(filter))
  const hasOverrides = overridePaths.length > 0

  const handleSetValue = useCallback((path: string, value: string) => {
    const newFlat = { ...workingFlat, [path]: value }
    const newDirty = new Set(dirtyPaths)
    newDirty.add(path)
    onWorkingChange(newFlat, newDirty)
  }, [workingFlat, dirtyPaths, onWorkingChange])

  const handleRemove = useCallback((path: string) => {
    const newFlat = { ...workingFlat }
    delete newFlat[path]
    const newDirty = new Set(dirtyPaths)
    newDirty.add(path)
    onWorkingChange(newFlat, newDirty)
  }, [workingFlat, dirtyPaths, onWorkingChange])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, height: '100%', overflow: 'hidden' }}>
      <input
        type="search"
        placeholder="过滤 Token 路径…"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        style={SEARCH_INPUT_STYLE}
      />

      <p style={{ fontSize: 'var(--font-size-xs)', flexShrink: 0, color: 'var(--fg-subtle)' }}>
        {hasOverrides ? `${overridePaths.length} 个 brand override 字段` : '当前无 brand override（使用 base 默认值）'}
      </p>

      <div style={{ flex: '1 1 0%', overflowY: 'auto' }}>
        {overridePaths.map((path) => (
          <TokenRow
            key={path}
            path={path}
            value={workingFlat[path] ?? ''}
            source={dirtyPaths.has(path) ? 'dirty' : (overrideMap[path] ?? 'brand-override')}
            onSetValue={handleSetValue}
            onRemove={handleRemove}
          />
        ))}
      </div>
    </div>
  )
}

interface TokenRowProps {
  path: string
  value: string
  source: 'base' | 'brand-override' | 'dirty'
  onSetValue: (path: string, value: string) => void
  onRemove: (path: string) => void
}

const ROW_STYLE: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  padding: '8px',
  borderBottom: '1px solid var(--border-subtle)',
}

const EDIT_INPUT_STYLE: React.CSSProperties = {
  flex: '1 1 0%',
  padding: '4px 8px',
  fontSize: 'var(--font-size-xs)',
  borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--border-default)',
  fontFamily: 'var(--font-family-mono)',
  backgroundColor: 'var(--bg-surface)',
  color: 'var(--fg-default)',
}

const SMALL_BTN_STYLE: React.CSSProperties = {
  fontSize: 'var(--font-size-xs)',
  padding: '4px 8px',
  borderRadius: 'var(--radius-sm)',
  cursor: 'pointer',
}

const TINY_BTN_STYLE: React.CSSProperties = {
  fontSize: 'var(--font-size-xs)',
  padding: '2px 6px',
  borderRadius: 'var(--radius-sm)',
  cursor: 'pointer',
  background: 'transparent',
}

function TokenRow({ path, value, source, onSetValue, onRemove }: TokenRowProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)

  const handleEdit = () => {
    setDraft(value)
    setEditing(true)
  }

  const handleConfirm = () => {
    onSetValue(path, draft)
    setEditing(false)
  }

  return (
    <div style={ROW_STYLE}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span
          style={{
            fontFamily: 'var(--font-family-mono)',
            fontSize: 'var(--font-size-xs)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            color: 'var(--fg-muted)',
          }}
        >
          {path}
        </span>
        <InheritanceBadge source={source} />
      </div>

      {editing ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            style={EDIT_INPUT_STYLE}
          />
          <button
            type="button"
            onClick={handleConfirm}
            style={{ ...SMALL_BTN_STYLE, backgroundColor: 'var(--accent-default)', color: 'var(--accent-fg)', border: 'none' }}
          >
            确认
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            style={{ ...SMALL_BTN_STYLE, backgroundColor: 'var(--bg-surface-raised)', color: 'var(--fg-muted)', border: 'none' }}
          >
            取消
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <span
            title={value}
            style={{
              fontSize: 'var(--font-size-xs)',
              fontFamily: 'var(--font-family-mono)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              flex: '1 1 0%',
              color: 'var(--fg-default)',
            }}
          >
            {value}
          </span>
          <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
            <button
              type="button"
              onClick={handleEdit}
              style={{ ...TINY_BTN_STYLE, color: 'var(--accent-default)', border: '1px solid var(--accent-default)' }}
            >
              编辑
            </button>
            <button
              type="button"
              onClick={() => onRemove(path)}
              style={{ ...TINY_BTN_STYLE, color: 'var(--fg-muted)', border: '1px solid var(--border-default)' }}
            >
              重置继承
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
