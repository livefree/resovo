'use client'

import React from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { SettingsTab } from '../_tabs/SettingsTab'
import { CacheTab } from '../_tabs/CacheTab'
import { MonitorTab } from '../_tabs/MonitorTab'
import { ConfigTab } from '../_tabs/ConfigTab'
import { MigrationTab } from '../_tabs/MigrationTab'

type TabId = 'settings' | 'cache' | 'monitor' | 'config' | 'migration'

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'settings', label: '站点设置' },
  { id: 'cache', label: '缓存管理' },
  { id: 'monitor', label: '系统监控' },
  { id: 'config', label: '高级配置' },
  { id: 'migration', label: '数据迁移' },
]

const PAGE_STYLE: React.CSSProperties = { padding: '24px', maxWidth: 960 }
const TAB_BAR_STYLE: React.CSSProperties = { display: 'flex', gap: '2px', borderBottom: '1px solid var(--border-subtle)', marginBottom: '24px' }

function tabBtnStyle(active: boolean): React.CSSProperties {
  return {
    padding: '8px 16px',
    border: 0,
    borderBottom: active ? '2px solid var(--accent-default)' : '2px solid transparent',
    background: 'transparent',
    color: active ? 'var(--accent-default)' : 'var(--fg-muted)',
    fontWeight: active ? 600 : 400,
    fontSize: '14px',
    cursor: 'pointer',
    marginBottom: '-1px',
  }
}

export function SettingsContainer() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const raw = searchParams.get('tab') as TabId | null
  const activeTab: TabId = TABS.some((t) => t.id === raw) ? (raw as TabId) : 'settings'

  const switchTab = (tab: TabId) => {
    const params = new URLSearchParams(searchParams.toString())
    if (tab === 'settings') { params.delete('tab') } else { params.set('tab', tab) }
    router.push(`/admin/system/settings${params.size > 0 ? `?${params}` : ''}`)
  }

  return (
    <div style={PAGE_STYLE} data-settings-container>
      <div style={TAB_BAR_STYLE}>
        {TABS.map((t) => (
          <button
            key={t.id}
            style={tabBtnStyle(activeTab === t.id)}
            onClick={() => switchTab(t.id)}
            data-tab={t.id}
          >
            {t.label}
          </button>
        ))}
      </div>
      {activeTab === 'settings' && <SettingsTab />}
      {activeTab === 'cache' && <CacheTab />}
      {activeTab === 'monitor' && <MonitorTab />}
      {activeTab === 'config' && <ConfigTab />}
      {activeTab === 'migration' && <MigrationTab />}
    </div>
  )
}
