'use client'

/**
 * RightPane — 审核台右栏三 Tab segment 编排（CHG-SN-4-FIX-C · plan v1.6 §1 G4）
 *
 * 三态 Tab：详情（detail，默认）/ 历史（history，audit_log 时间线）/ 类似（similar，M-SN-5 占位）。
 *
 * 持久化协议（plan §5.0.1 D-13）：
 * - storageKey: `admin.moderation.rightTab.v1`（sessionStorage）
 * - 不进 URL params（避免 URL 噪声；rightTab 是 viewport hint 类状态）
 *
 * 视觉规约：segment 风格与左栏 ModerationConsole 主 Tab 风格一致（segBtnStyle 复用）。
 */
import React, { useState, useEffect, useCallback } from 'react'
import type { VideoQueueRow } from '@resovo/types'
import { TabDetail } from './TabDetail'
import { TabHistory } from './TabHistory'
import { TabSimilar } from './TabSimilar'
import { M } from '@/i18n/messages/zh-CN/moderation'

type RightTabId = 'detail' | 'history' | 'similar'

const VALID_TABS: readonly RightTabId[] = ['detail', 'history', 'similar']
const STORAGE_KEY = 'admin.moderation.rightTab.v1'

const TAB_BAR_STYLE: React.CSSProperties = {
  display: 'flex',
  gap: 1,
  marginBottom: 10,
  flexShrink: 0,
}

function tabBtnStyle(active: boolean): React.CSSProperties {
  return {
    flex: 1,
    padding: '5px 10px',
    border: '1px solid var(--border-default)',
    borderRadius: 'var(--radius-sm)',
    background: active ? 'var(--admin-accent-soft)' : 'var(--bg-surface-elevated)',
    color: active ? 'var(--accent-default)' : 'var(--fg-muted)',
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: active ? 600 : 400,
  }
}

function readStoredTab(): RightTabId {
  if (typeof window === 'undefined') return 'detail'
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY)
    if (stored && (VALID_TABS as readonly string[]).includes(stored)) {
      return stored as RightTabId
    }
  } catch {
    // sessionStorage 不可用 → 默认
  }
  return 'detail'
}

export interface RightPaneProps {
  readonly v: VideoQueueRow
}

export function RightPane({ v }: RightPaneProps): React.ReactElement {
  const [tab, setTabState] = useState<RightTabId>('detail')

  // hydrate from sessionStorage on mount（避免 SSR 不一致）
  useEffect(() => {
    setTabState(readStoredTab())
  }, [])

  const setTab = useCallback((next: RightTabId) => {
    setTabState(next)
    try {
      sessionStorage.setItem(STORAGE_KEY, next)
    } catch {
      // ignore quota / privacy mode
    }
  }, [])

  const tabDefs: readonly { id: RightTabId; label: string }[] = [
    { id: 'detail', label: M.rightTab.detail },
    { id: 'history', label: M.rightTab.history },
    { id: 'similar', label: M.rightTab.similar },
  ]

  return (
    <div data-right-pane style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={TAB_BAR_STYLE} role="tablist" aria-label="详情/历史/类似">
        {tabDefs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            style={tabBtnStyle(tab === t.id)}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        {tab === 'detail' && <TabDetail v={v} />}
        {tab === 'history' && <TabHistory videoId={v.id} />}
        {tab === 'similar' && <TabSimilar />}
      </div>
    </div>
  )
}
