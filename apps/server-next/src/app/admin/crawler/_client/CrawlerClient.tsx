'use client'

/**
 * CrawlerClient.tsx — `/admin/crawler` 采集控制视图主 orchestrator
 *
 * 范围（CHG-SN-6-29-PATCH-1 拆分后）：
 *   - 顶层 Tab 切换（sites / runs）
 *   - 全局 data fetching（sites + system-status）
 *   - PageHeader（标题 + 新增/刷新动作）
 *   - 子组件 composition：CrawlerSitesTab / CrawlerRunsView
 *
 * 历史能力已拆出：
 *   - CrawlerSitesTab.tsx：站点表 + drawer + batch + 状态卡 + ControlsCard 嵌入
 *   - CrawlerControlsCard.tsx：freeze + stop-all + reindex + scheduler 4 按钮组
 *   - CrawlerRunsView.tsx / CrawlerRunDetailView.tsx / TaskLogsDrawer.tsx：runs 下钻链
 */

import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { AdminButton, PageHeader } from '@resovo/admin-ui'
import {
  listCrawlerSites,
  getCrawlerSystemStatus,
  type CrawlerSite,
  type CrawlerSystemStatus,
} from '@/lib/crawler/api'
import { CrawlerRunsView } from './CrawlerRunsView'
import { CrawlerSitesTab } from './CrawlerSitesTab'

const PAGE_STYLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--section-gap)',
  padding: 'var(--page-padding-y) var(--page-padding-x) 0',
}

type CrawlerTab = 'sites' | 'runs'

export function CrawlerClient() {
  const [tab, setTab] = useState<CrawlerTab>('sites')

  const [sites, setSites] = useState<readonly CrawlerSite[]>([])
  const [status, setStatus] = useState<CrawlerSystemStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [retryKey, setRetryKey] = useState(0)

  // CHG-SN-6-29-PATCH-1：使用 counter 触发子组件打开 Drawer（避免 ref / forwardRef 复杂化）
  const [createTrigger, setCreateTrigger] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    Promise.allSettled([listCrawlerSites(), getCrawlerSystemStatus()]).then(([sitesRes, statusRes]) => {
      if (cancelled) return
      if (sitesRes.status === 'fulfilled') setSites(sitesRes.value)
      else setError(sitesRes.reason instanceof Error ? sitesRes.reason : new Error('站点加载失败'))
      if (statusRes.status === 'fulfilled') setStatus(statusRes.value)
    }).finally(() => {
      if (!cancelled) setLoading(false)
    })
    return () => { cancelled = true }
  }, [retryKey])

  const refresh = useCallback(() => setRetryKey((k) => k + 1), [])

  const handleStatusUpdate = useCallback((next: Partial<CrawlerSystemStatus>) => {
    setStatus((prev) => ({ ...(prev ?? {}), ...next }))
  }, [])

  const handleCreate = useCallback(() => {
    setCreateTrigger((c) => c + 1)
  }, [])

  return (
    <div data-crawler-client style={PAGE_STYLE}>
      <PageHeader
        title="采集控制"
        subtitle={`${sites.length} 个站点 · ${tab === 'sites' ? 'sites' : 'runs'} tab · MVP（不含 tasks / DAG）`}
        actions={
          <span style={{ display: 'inline-flex', gap: '8px' }}>
            {tab === 'sites' ? (
              <AdminButton
                variant="primary"
                size="sm"
                onClick={handleCreate}
                data-testid="crawler-create-btn"
              >
                + 新增站点
              </AdminButton>
            ) : null}
            <AdminButton
              variant="default"
              size="sm"
              onClick={refresh}
              data-testid="crawler-refresh"
            >
              刷新
            </AdminButton>
          </span>
        }
        data-testid="crawler-page-header"
      />

      {/* CHG-SN-6-15：顶层 Tab 切换 */}
      <div
        style={{ display: 'inline-flex', gap: '4px', borderBottom: '1px solid var(--border-subtle)' }}
        data-testid="crawler-tabs"
        role="tablist"
      >
        {(['sites', 'runs'] as const).map((t) => {
          const active = tab === t
          return (
            <button
              key={t}
              type="button"
              role="tab"
              onClick={() => setTab(t)}
              data-tab={t}
              data-active={active ? '' : undefined}
              style={{
                padding: '8px 16px',
                fontSize: 'var(--font-size-sm)',
                fontFamily: 'inherit',
                fontWeight: active ? 600 : 400,
                color: active ? 'var(--fg-default)' : 'var(--fg-muted)',
                background: 'transparent',
                borderTop: 'none',
                borderLeft: 'none',
                borderRight: 'none',
                borderBottom: active ? '2px solid var(--accent-default)' : '2px solid transparent',
                cursor: 'pointer',
                marginBottom: '-1px',
              }}
            >
              {t === 'sites' ? '站点配置' : '采集批次（runs）'}
            </button>
          )
        })}
      </div>

      {tab === 'runs' ? <CrawlerRunsView /> : null}

      {tab === 'sites' ? (
        <CrawlerSitesTab
          sites={sites}
          status={status}
          loading={loading}
          error={error}
          createTrigger={createTrigger}
          onRefresh={refresh}
          onStatusUpdate={handleStatusUpdate}
        />
      ) : null}
    </div>
  )
}
