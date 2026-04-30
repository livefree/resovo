'use client'

/**
 * SettingsContainer — 站点设置 Tab 容器（CHG-DESIGN-06）
 *
 * 真源：docs/designs/backend_design_v2.1/reference.md §5.11
 *
 * 布局：
 *   - 顶部 page__head（标题 + 副标题 + actions）
 *   - 主体 grid 180px/1fr：
 *     · 左侧 card：垂直 tab list（aria-orientation="vertical"）
 *     · 右侧 card：当前 Tab 内容（role="tabpanel"）
 *
 * Tab item 样式（active：accent-soft + accent / inactive：transparent + fg-muted + hover bg-raised）
 *
 * URL `?tab=` 同步策略沿用 CHG-SN-3-09：
 *   - tab=settings 时不写 query（URL 干净）
 *   - 其他 tab 写 ?tab=cache 等
 */
import React from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { SettingsTab } from '../_tabs/SettingsTab'
import { CacheTab } from '../_tabs/CacheTab'
import { MonitorTab } from '../_tabs/MonitorTab'
import { ConfigTab } from '../_tabs/ConfigTab'
import { MigrationTab } from '../_tabs/MigrationTab'

type TabId = 'settings' | 'cache' | 'monitor' | 'config' | 'migration'

const TABS: ReadonlyArray<{ id: TabId; label: string; description?: string }> = [
  { id: 'settings', label: '站点设置', description: '基础信息 / 豆瓣 / 过滤 / 图片' },
  { id: 'cache', label: '缓存管理', description: '缓存清理 / TTL 配置' },
  { id: 'monitor', label: '系统监控', description: '运行状态 / 资源' },
  { id: 'config', label: '高级配置', description: '环境变量 / 特性开关' },
  { id: 'migration', label: '数据迁移', description: '迁移脚本 / 任务执行' },
]

const PAGE_STYLE: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '16px',
  padding: '20px 24px',
}

const HEAD_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: '16px',
}

const HEAD_TITLE_STYLE: React.CSSProperties = {
  margin: 0,
  fontSize: '18px',
  fontWeight: 600,
  color: 'var(--fg-default)',
  lineHeight: 1.3,
}

const HEAD_SUB_STYLE: React.CSSProperties = {
  margin: '4px 0 0',
  fontSize: '12px',
  color: 'var(--fg-muted)',
}

const HEAD_ACTIONS_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  flexShrink: 0,
}

const HEAD_BUTTON_STYLE: React.CSSProperties = {
  height: '28px',
  padding: '0 12px',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-sm)',
  background: 'var(--bg-surface)',
  color: 'var(--fg-default)',
  font: 'inherit',
  fontSize: '12px',
  cursor: 'pointer',
}

const HEAD_BUTTON_PRIMARY_STYLE: React.CSSProperties = {
  ...HEAD_BUTTON_STYLE,
  background: 'var(--accent-default)',
  color: 'var(--fg-on-accent)',
  border: '1px solid var(--accent-default)',
  fontWeight: 500,
}

const GRID_STYLE: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '180px 1fr',
  gap: '16px',
  alignItems: 'start',
}

const CARD_STYLE: React.CSSProperties = {
  background: 'var(--bg-surface-raised)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-md)',
  padding: '12px',
}

const TABLIST_STYLE: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '2px',
}

const TABPANEL_STYLE: React.CSSProperties = {
  ...CARD_STYLE,
  padding: '20px',
  minHeight: '320px',
}

function tabBtnStyle(active: boolean): React.CSSProperties {
  return {
    width: '100%',
    padding: '8px 10px',
    border: 0,
    borderRadius: 'var(--radius-sm)',
    background: active ? 'var(--admin-accent-soft)' : 'transparent',
    color: active ? 'var(--admin-accent-on-soft)' : 'var(--fg-muted)',
    fontWeight: active ? 600 : 400,
    fontSize: '13px',
    cursor: 'pointer',
    textAlign: 'left',
    font: 'inherit',
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    lineHeight: 1.3,
  }
}

const TAB_DESC_STYLE: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 400,
  color: 'var(--fg-muted)',
}

export function SettingsContainer() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const raw = searchParams.get('tab') as TabId | null
  const activeTab: TabId = TABS.some((t) => t.id === raw) ? (raw as TabId) : 'settings'

  const switchTab = (tab: TabId) => {
    const params = new URLSearchParams(searchParams.toString())
    if (tab === 'settings') params.delete('tab')
    else params.set('tab', tab)
    router.push(`/admin/system/settings${params.size > 0 ? `?${params}` : ''}`)
  }

  return (
    <div style={PAGE_STYLE} data-settings-container>
      <header style={HEAD_STYLE} data-settings-head>
        <div>
          <h1 style={HEAD_TITLE_STYLE}>站点设置</h1>
          <p style={HEAD_SUB_STYLE}>统一配置中心 · 5 类设置面板（M-SN-6 起逐步实装）</p>
        </div>
        <div style={HEAD_ACTIONS_STYLE} data-settings-head-actions>
          <button type="button" style={HEAD_BUTTON_STYLE} data-settings-action="audit">审计日志</button>
          <button type="button" style={HEAD_BUTTON_PRIMARY_STYLE} data-settings-action="save-all">保存所有更改</button>
        </div>
      </header>
      <div style={GRID_STYLE}>
        <aside
          style={CARD_STYLE}
          data-settings-tablist
          role="tablist"
          aria-orientation="vertical"
          aria-label="设置面板"
        >
          <div style={TABLIST_STYLE}>
            {TABS.map((t) => {
              const active = activeTab === t.id
              return (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  aria-controls={`settings-tabpanel-${t.id}`}
                  id={`settings-tab-${t.id}`}
                  style={tabBtnStyle(active)}
                  onClick={() => switchTab(t.id)}
                  data-tab={t.id}
                  data-tab-active={active ? 'true' : undefined}
                >
                  <span>{t.label}</span>
                  {t.description && <span style={TAB_DESC_STYLE}>{t.description}</span>}
                </button>
              )
            })}
          </div>
        </aside>
        <section
          style={TABPANEL_STYLE}
          data-settings-tabpanel
          role="tabpanel"
          id={`settings-tabpanel-${activeTab}`}
          aria-labelledby={`settings-tab-${activeTab}`}
        >
          {activeTab === 'settings' && <SettingsTab />}
          {activeTab === 'cache' && <CacheTab />}
          {activeTab === 'monitor' && <MonitorTab />}
          {activeTab === 'config' && <ConfigTab />}
          {activeTab === 'migration' && <MigrationTab />}
        </section>
      </div>
    </div>
  )
}
