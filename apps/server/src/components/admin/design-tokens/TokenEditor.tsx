'use client'

import { useState, useCallback } from 'react'
import { InheritanceBadge } from './InheritanceBadge'
import type { FlatOverrides } from './_paths'

interface TokenEditorProps {
  overrideMap: Record<string, 'base' | 'brand-override'>
  workingFlat: FlatOverrides
  dirtyPaths: ReadonlySet<string>
  onWorkingChange: (flat: FlatOverrides, dirtyPaths: Set<string>) => void
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
    <div className="flex flex-col gap-2 h-full overflow-hidden">
      <input
        type="search"
        placeholder="过滤 Token 路径…"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="w-full px-3 py-1.5 text-sm rounded border shrink-0"
        style={{ borderColor: 'var(--border-default)', backgroundColor: 'var(--bg-surface)', color: 'var(--fg-default)' }}
      />

      <p className="text-xs shrink-0" style={{ color: 'var(--fg-subtle)' }}>
        {hasOverrides ? `${overridePaths.length} 个 brand override 字段` : '当前无 brand override（使用 base 默认值）'}
      </p>

      <div className="flex-1 overflow-y-auto">
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
    <div className="flex flex-col gap-1 px-2 py-2 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-xs truncate" style={{ color: 'var(--fg-muted)' }}>
          {path}
        </span>
        <InheritanceBadge source={source} />
      </div>

      {editing ? (
        <div className="flex items-center gap-1.5">
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="flex-1 px-2 py-1 text-xs rounded border font-mono"
            style={{ borderColor: 'var(--border-default)', backgroundColor: 'var(--bg-surface)', color: 'var(--fg-default)' }}
          />
          <button
            onClick={handleConfirm}
            className="text-xs px-2 py-1 rounded"
            style={{ backgroundColor: 'var(--accent-default)', color: 'var(--accent-fg)' }}
          >
            确认
          </button>
          <button
            onClick={() => setEditing(false)}
            className="text-xs px-2 py-1 rounded"
            style={{ backgroundColor: 'var(--bg-surface-raised)', color: 'var(--fg-muted)' }}
          >
            取消
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-mono truncate flex-1" style={{ color: 'var(--fg-default)' }} title={value}>
            {value}
          </span>
          <div className="flex gap-1 shrink-0">
            <button
              onClick={handleEdit}
              className="text-xs px-1.5 py-0.5 rounded"
              style={{ color: 'var(--accent-default)', border: '1px solid var(--accent-default)' }}
            >
              编辑
            </button>
            <button
              onClick={() => onRemove(path)}
              className="text-xs px-1.5 py-0.5 rounded"
              style={{ color: 'var(--fg-muted)', border: '1px solid var(--border-default)' }}
            >
              重置继承
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
