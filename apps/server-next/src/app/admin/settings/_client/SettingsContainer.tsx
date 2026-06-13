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
import { AdminButton, PageHeader } from '@resovo/admin-ui'
import { SettingsTab } from '../_tabs/SettingsTab'
import { CacheTab } from '../_tabs/CacheTab'
import { MonitorTab } from '../_tabs/MonitorTab'
import { ConfigTab } from '../_tabs/ConfigTab'
import { MigrationTab } from '../_tabs/MigrationTab'
import { NotificationsTab } from '../_tabs/NotificationsTab'
import { ApiWebhookTab } from '../_tabs/ApiWebhookTab'
import { LoginSessionsTab } from '../_tabs/LoginSessionsTab'

type TabId =
  | 'settings'
  | 'cache'
  | 'monitor'
  | 'config'
  | 'migration'
  | 'notifications'
  | 'api-webhook'
  | 'login-sessions'

const TABS: ReadonlyArray<{ id: TabId; label: string; description?: string }> = [
  { id: 'settings', label: '站点设置', description: '基础信息 / 豆瓣 / 过滤 / 图片' },
  { id: 'cache', label: '缓存管理', description: '缓存清理 / TTL 配置' },
  { id: 'monitor', label: '系统监控', description: '运行状态 / 资源' },
  { id: 'config', label: '高级配置', description: '环境变量 / 特性开关' },
  { id: 'migration', label: '数据迁移', description: '迁移脚本 / 任务执行' },
  { id: 'notifications', label: '通知设置', description: '渠道 / 触发事件 / 阈值' },
  { id: 'api-webhook', label: 'API·Webhook', description: 'API Key / Webhook 端点' },
  { id: 'login-sessions', label: '登录会话', description: '会话超时 / 活跃会话' },
]

const PAGE_STYLE: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '16px',
  padding: '20px 24px',
}

// page head：共享 PageHeader 承载（MODUX-P1-1-B，规约 T-1/T-3）

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
    fontSize: 'var(--font-size-sm-tight)',
    cursor: 'pointer',
    textAlign: 'left',
    fontFamily: 'inherit',
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    lineHeight: 1.3,
  }
}

const TAB_DESC_STYLE: React.CSSProperties = {
  fontSize: 'var(--font-size-xxs)',
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
    router.push(`/admin/settings${params.size > 0 ? `?${params}` : ''}`)
  }

  return (
    <div style={PAGE_STYLE} data-settings-container>
      <PageHeader
        title="站点设置"
        titleVisuallyHidden
        actions={
          /* CHG-SN-6-RETRO-3-B / ultrareview P2-8：
              原生 button + inline style → AdminButton（共享原语率与自报口径 85% 对齐）；
              "保存所有更改"已删（CHG-SN-6-AUDIT-DEBOUNCE-FIX，5 Tab 各自保存模型下无语义） */
          <AdminButton
            variant="default"
            size="sm"
            onClick={() => router.push('/admin/audit')}
            data-settings-action="audit"
            data-testid="settings-action-audit"
          >
            审计日志
          </AdminButton>
        }
      />
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
          {activeTab === 'notifications' && <NotificationsTab />}
          {activeTab === 'api-webhook' && <ApiWebhookTab />}
          {activeTab === 'login-sessions' && <LoginSessionsTab />}
        </section>
      </div>
    </div>
  )
}
