'use client'

/**
 * CrawlerClient.tsx — `/admin/crawler` 采集控制视图主 orchestrator（REDO-01-C 重写）
 *
 * 真源：M-SN-7-redo-01-contract.md §1 + reference.md §5.6
 *
 * 单页三区块（**不再有 sites/runs Tab**）：
 *   - PageHeader title + subtitle + 3 actions（导出 / + 新增站点 / 全站全量）
 *   - CrawlerKpiRow（5 KpiCard）
 *   - CrawlerTimelineCard（时间轴框架）
 *   - CrawlerSiteList（DataTable 9 列骨架，不含展开行）
 *
 * 不在本卡（REDO-01-C）范围：
 *   - 行级 {more} dropdown / + 增量 / + 全量（REDO-01-D）
 *   - 行展开 sub-table（REDO-01-E + F）
 *   - "高级"dropdown（调度/重建索引/止血/冻结）（REDO-01-G）
 *   - /admin/crawler/runs 独立路由（REDO-01-H）
 *
 * 旧文件已删除（REDO-01-I 2026-05-19 / commit pre-redo-crawler-20260519 tag 回滚锚点）：
 *   - CrawlerSitesTab.tsx / CrawlerControlsCard.tsx / crawler-site-columns.tsx
 */

import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { AdminButton, PageHeader, useToast } from '@resovo/admin-ui'
import {
  listCrawlerSites,
  getCrawlerSystemStatus,
  getCrawlerKpi,
  getCrawlerTimeline,
  runCrawlerAll,
  runCrawlerSite,
  createCrawlerSite,
  updateCrawlerSite,
  deleteCrawlerSite,
  type CrawlerSite,
  type CrawlerSiteStat,
  type CrawlerSystemStatus,
  type CrawlerKpiResponse,
  type CrawlerTimelineResponse,
  type CreateCrawlerSiteInput,
  type CrawlerRunMode,
} from '@/lib/crawler/api'
import { ApiClientError } from '@/lib/api-client'
import { exportCrawlerSitesCsv } from '@/lib/crawler/csv-export'
import { CrawlerKpiRow } from './CrawlerKpiRow'
import { CrawlerTimelineCard } from './CrawlerTimelineCard'
import { CrawlerSiteList } from './CrawlerSiteList'
import { CrawlerSiteExpand } from './CrawlerSiteExpand'
import { CrawlerAdvancedMenu } from './CrawlerAdvancedMenu'
import { SchedulerConfigDrawer } from './SchedulerConfigDrawer'
import {
  CrawlerSiteFormDrawer,
  type CrawlerSiteFormMode,
} from './CrawlerSiteFormDrawer'

const PAGE_STYLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--section-gap)',
  padding: 'var(--page-padding-y) var(--page-padding-x) 0',
}

const ACTIONS_STYLE: CSSProperties = {
  display: 'inline-flex',
  gap: '8px',
}

const EMPTY_FORM: CreateCrawlerSiteInput = {
  key: '',
  name: '',
  apiUrl: '',
  sourceType: 'vod',
  format: 'json',
  weight: 50,
  isAdult: false,
}

function describeApiError(err: unknown): { title: string; description: string } {
  if (err instanceof ApiClientError) {
    if (err.code === 'DUPLICATE_KEY') return { title: 'key 重复', description: err.message }
    if (err.code === 'DUPLICATE_API_URL') return { title: 'API URL 重复', description: err.message }
    if (err.code === 'FORBIDDEN') return { title: '禁止操作', description: err.message }
    if (err.code === 'VALIDATION_ERROR') return { title: '参数校验失败', description: err.message }
    if (err.code === 'CONFLICT') return { title: '操作冲突', description: err.message }
    return { title: '操作失败', description: err.message }
  }
  return { title: '操作失败', description: err instanceof Error ? err.message : '请稍后重试' }
}

export function CrawlerClient() {
  const toast = useToast()

  // ── data ─────────────────────────────────────────────────────────
  const [sites, setSites] = useState<readonly CrawlerSite[]>([])
  const [status, setStatus] = useState<CrawlerSystemStatus | null>(null)
  const [kpi, setKpi] = useState<CrawlerKpiResponse | null>(null)
  const [timeline, setTimeline] = useState<CrawlerTimelineResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [retryKey, setRetryKey] = useState(0)
  const [paused, setPaused] = useState(false)
  const [runAllIncrementalPending, setRunAllIncrementalPending] = useState(false)
  const [runAllFullPending, setRunAllFullPending] = useState(false)
  // ── REDO-01-E 行展开状态 ─────────────────────────────────────────
  const [expandedKeys, setExpandedKeys] = useState<ReadonlySet<string>>(new Set())
  // ── REDO-01-G 高级菜单 / 调度抽屉状态 ────────────────────────────
  const [schedulerOpen, setSchedulerOpen] = useState(false)
  const handleStatusUpdate = useCallback((next: Partial<CrawlerSystemStatus>) => {
    setStatus((prev) => ({ ...(prev ?? {}), ...next }))
  }, [])

  // ── drawer ───────────────────────────────────────────────────────
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [formMode, setFormMode] = useState<CrawlerSiteFormMode>({ kind: 'create' })
  const [form, setForm] = useState<CreateCrawlerSiteInput>(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)

  // ── initial + retry load ─────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    Promise.allSettled([
      listCrawlerSites(),
      getCrawlerSystemStatus(),
      getCrawlerKpi(),
      getCrawlerTimeline({ range: '1h', limit: 8 }),
    ]).then(([sitesRes, statusRes, kpiRes, timelineRes]) => {
      if (cancelled) return
      if (sitesRes.status === 'fulfilled') setSites(sitesRes.value)
      else setError(sitesRes.reason instanceof Error ? sitesRes.reason : new Error('站点加载失败'))
      if (statusRes.status === 'fulfilled') setStatus(statusRes.value)
      if (kpiRes.status === 'fulfilled') setKpi(kpiRes.value)
      if (timelineRes.status === 'fulfilled') setTimeline(timelineRes.value)
    }).finally(() => {
      if (!cancelled) setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [retryKey])

  // ── timeline auto-refresh（15s；frozen / paused 时跳过） ─────────
  useEffect(() => {
    if (paused || status?.freezeEnabled) return
    const tick = window.setInterval(() => {
      getCrawlerTimeline({ range: '1h', limit: 8 })
        .then((next) => setTimeline(next))
        .catch(() => {
          // silent；时间轴是软实时数据，刷新失败不打扰用户
        })
    }, 15_000)
    return () => window.clearInterval(tick)
  }, [paused, status?.freezeEnabled])

  const refresh = useCallback(() => setRetryKey((k) => k + 1), [])

  const handlePauseToggle = useCallback(() => setPaused((p) => !p), [])

  const handleOpenCreate = useCallback(() => {
    setFormMode({ kind: 'create' })
    setForm(EMPTY_FORM)
    setDrawerOpen(true)
  }, [])

  const handleEditSite = useCallback((site: CrawlerSite) => {
    setFormMode({ kind: 'edit', key: site.key })
    setForm({
      key: site.key,
      name: site.name,
      apiUrl: site.apiUrl,
      detail: site.detail ?? '',
      sourceType: site.sourceType,
      format: site.format,
      weight: site.weight,
      isAdult: site.isAdult,
    })
    setDrawerOpen(true)
  }, [])

  const handleSubmit = useCallback(async () => {
    setSubmitting(true)
    try {
      if (formMode.kind === 'create') {
        await createCrawlerSite(form)
        toast.push({ title: '已创建', description: `站点 ${form.key} 创建成功`, level: 'success' })
      } else {
        await updateCrawlerSite(formMode.key, {
          name: form.name,
          apiUrl: form.apiUrl,
          detail: form.detail,
          sourceType: form.sourceType,
          format: form.format,
          weight: form.weight,
          isAdult: form.isAdult,
        })
        toast.push({ title: '已更新', description: `站点 ${formMode.key} 更新成功`, level: 'success' })
      }
      setDrawerOpen(false)
      refresh()
    } catch (err: unknown) {
      const { title, description } = describeApiError(err)
      toast.push({ title, description, level: 'danger' })
    } finally {
      setSubmitting(false)
    }
  }, [form, formMode, refresh, toast])

  const handleDelete = useCallback(async (site: CrawlerSite) => {
    if (site.fromConfig) {
      toast.push({
        title: '禁止删除',
        description: 'config 文件来源站点不可删除；请在配置文件中移除后重新保存',
        level: 'warn',
      })
      return
    }
    if (!confirm(`确定删除站点 ${site.key}（${site.name}）？`)) return
    try {
      await deleteCrawlerSite(site.key)
      toast.push({ title: '已删除', description: site.key, level: 'success' })
      setDrawerOpen(false)
      refresh()
    } catch (err: unknown) {
      const { title, description } = describeApiError(err)
      toast.push({ title, description, level: 'danger' })
    }
  }, [refresh, toast])

  // CHG-SN-8-01：主按钮高频路径——全站增量（单次 confirm）
  const handleRunAllIncremental = useCallback(async () => {
    if (status?.freezeEnabled) {
      toast.push({
        title: '采集已冻结',
        description: '请先在"高级 / 解除冻结"后再运行',
        level: 'warn',
      })
      return
    }
    if (!confirm('确定对全站发起增量采集？')) return
    setRunAllIncrementalPending(true)
    try {
      const result = await runCrawlerAll('incremental')
      toast.push({
        title: '已发起全站增量',
        description: `runId=${result.runId.slice(0, 8)} · 入队 ${result.enqueuedSiteKeys.length} 个站点`,
        level: 'success',
      })
      refresh()
    } catch (err: unknown) {
      const { title, description } = describeApiError(err)
      toast.push({ title, description, level: 'danger' })
    } finally {
      setRunAllIncrementalPending(false)
    }
  }, [refresh, status?.freezeEnabled, toast])

  // CHG-SN-8-01：危险低频路径——全站全量（双重 confirm + 输入"全量"二字防误触；advanced dropdown 入口）
  const handleRunAllFull = useCallback(async () => {
    if (status?.freezeEnabled) {
      toast.push({
        title: '采集已冻结',
        description: '请先在"高级 / 解除冻结"后再运行',
        level: 'warn',
      })
      return
    }
    if (!confirm('确定对全站发起【全量】采集？此操作会创建多个 task，且耗时较长。')) return
    const second = prompt('再次确认：请输入"全量"二字以继续；输入其它内容将中止。')
    if (second?.trim() !== '全量') {
      // 静默中止：用户输错或取消，等同未发起
      return
    }
    setRunAllFullPending(true)
    try {
      const result = await runCrawlerAll('full')
      toast.push({
        title: '已发起全站全量',
        description: `runId=${result.runId.slice(0, 8)} · 入队 ${result.enqueuedSiteKeys.length} 个站点`,
        level: 'success',
      })
      refresh()
    } catch (err: unknown) {
      const { title, description } = describeApiError(err)
      toast.push({ title, description, level: 'danger' })
    } finally {
      setRunAllFullPending(false)
    }
  }, [refresh, status?.freezeEnabled, toast])

  // CHG-SN-7-MISC-CRAWLER-CSV-EXPORT：站点列表 CSV 导出（逻辑抽到 lib/crawler/csv-export.ts）
  const handleExport = useCallback(() => {
    if (sites.length === 0) {
      toast.push({ title: '无可导出数据', description: '当前站点列表为空', level: 'warn' })
      return
    }
    const filename = exportCrawlerSitesCsv(sites)
    toast.push({ title: '已导出', description: `${filename} · ${sites.length} 站点`, level: 'success' })
  }, [sites, toast])

  // ── 行级 {more} + + 增量 / + 全量（REDO-01-D）───────────────────
  const handleRunSite = useCallback(
    async (siteKey: string, mode: CrawlerRunMode) => {
      if (status?.freezeEnabled) {
        toast.push({
          title: '采集已冻结',
          description: '请先在"高级 / 解除冻结"后再运行（REDO-01-G 实装）',
          level: 'warn',
        })
        return
      }
      try {
        const result = await runCrawlerSite(siteKey, mode)
        toast.push({
          title: mode === 'full' ? '已发起全量' : '已发起增量',
          description: `${siteKey} · runId=${result.runId.slice(0, 8)}`,
          level: 'success',
        })
        refresh()
      } catch (err: unknown) {
        const { title, description } = describeApiError(err)
        toast.push({ title, description, level: 'danger' })
      }
    },
    [refresh, status?.freezeEnabled, toast],
  )

  const handleRunIncremental = useCallback(
    (siteKey: string) => void handleRunSite(siteKey, 'incremental'),
    [handleRunSite],
  )

  const handleRunFull = useCallback(
    (siteKey: string) => void handleRunSite(siteKey, 'full'),
    [handleRunSite],
  )

  const handleToggleDisable = useCallback(
    async (site: CrawlerSite) => {
      const nextDisabled = !site.disabled
      try {
        await updateCrawlerSite(site.key, { disabled: nextDisabled })
        toast.push({
          title: nextDisabled ? '已禁用' : '已启用',
          description: site.key,
          level: 'success',
        })
        refresh()
      } catch (err: unknown) {
        const { title, description } = describeApiError(err)
        toast.push({ title, description, level: 'danger' })
      }
    },
    [refresh, toast],
  )

  const handleMarkAdult = useCallback(
    async (site: CrawlerSite) => {
      const nextAdult = !site.isAdult
      try {
        await updateCrawlerSite(site.key, { isAdult: nextAdult })
        toast.push({
          title: nextAdult ? '已标记成人' : '已取消成人',
          description: site.key,
          level: 'success',
        })
        refresh()
      } catch (err: unknown) {
        const { title, description } = describeApiError(err)
        toast.push({ title, description, level: 'danger' })
      }
    },
    [refresh, toast],
  )

  const handleMarkShortdrama = useCallback(
    async (site: CrawlerSite) => {
      const nextType = site.sourceType === 'shortdrama' ? 'vod' : 'shortdrama'
      try {
        await updateCrawlerSite(site.key, { sourceType: nextType })
        toast.push({
          title: nextType === 'shortdrama' ? '已标记短剧' : '已标记 vod',
          description: site.key,
          level: 'success',
        })
        refresh()
      } catch (err: unknown) {
        const { title, description } = describeApiError(err)
        toast.push({ title, description, level: 'danger' })
      }
    },
    [refresh, toast],
  )

  const handleCopyKey = useCallback(
    (key: string) => {
      const clipboard = typeof navigator !== 'undefined' ? navigator.clipboard : undefined
      if (!clipboard) {
        toast.push({
          title: '复制失败',
          description: '当前环境不支持 clipboard API',
          level: 'warn',
        })
        return
      }
      clipboard.writeText(key).then(
        () => toast.push({ title: '已复制', description: key, level: 'success' }),
        () => toast.push({ title: '复制失败', description: key, level: 'danger' }),
      )
    },
    [toast],
  )

  // siteStats Map：用于站点表 health / routeCount 列消费
  const siteStats: ReadonlyMap<string, CrawlerSiteStat> | undefined = kpi
    ? new Map(kpi.siteStats.map((s) => [s.key, s]))
    : undefined

  const editSite =
    formMode.kind === 'edit' ? sites.find((s) => s.key === formMode.key) : undefined

  return (
    <div data-crawler-client style={PAGE_STYLE}>
      <PageHeader
        title="采集控制"
        subtitle={`${sites.length} 个站点 · ${status?.freezeEnabled ? '全局冻结中' : '实时'} · MVP（REDO-01-C 骨架）`}
        actions={
          <span style={ACTIONS_STYLE}>
            <AdminButton
              variant="default"
              size="sm"
              onClick={handleExport}
              data-testid="crawler-export-btn"
            >
              导出
            </AdminButton>
            <AdminButton
              variant="default"
              size="sm"
              onClick={handleOpenCreate}
              data-testid="crawler-create-btn"
            >
              + 新增站点
            </AdminButton>
            <AdminButton
              variant="primary"
              size="sm"
              loading={runAllIncrementalPending}
              onClick={() => void handleRunAllIncremental()}
              data-testid="crawler-run-all-incremental-btn"
            >
              全站增量
            </AdminButton>
            <CrawlerAdvancedMenu
              frozen={status?.freezeEnabled ?? false}
              onSchedulerConfig={() => setSchedulerOpen(true)}
              onStatusUpdate={handleStatusUpdate}
              onRefresh={refresh}
              onRunAllFull={() => void handleRunAllFull()}
              runAllFullPending={runAllFullPending}
            />
          </span>
        }
        data-testid="crawler-page-header"
      />

      <CrawlerKpiRow kpi={kpi} />

      <CrawlerTimelineCard
        timeline={timeline}
        loading={loading && !timeline}
        frozen={status?.freezeEnabled ?? false}
        paused={paused}
        onPauseToggle={handlePauseToggle}
      />

      <CrawlerSiteList
        sites={sites}
        loading={loading}
        error={error}
        siteStats={siteStats}
        onRefresh={refresh}
        onRunIncremental={handleRunIncremental}
        onRunFull={handleRunFull}
        onEdit={handleEditSite}
        onToggleDisable={handleToggleDisable}
        onCopyKey={handleCopyKey}
        onMarkAdult={handleMarkAdult}
        onMarkShortdrama={handleMarkShortdrama}
        onDelete={handleDelete}
        expandedKeys={expandedKeys}
        onToggleExpand={(siteKey) => {
          setExpandedKeys((prev) => {
            const next = new Set(prev)
            if (next.has(siteKey)) next.delete(siteKey)
            else next.add(siteKey)
            return next
          })
        }}
        renderExpandedRow={(site) => (
          <CrawlerSiteExpand siteKey={site.key} siteName={site.name} />
        )}
      />

      <CrawlerSiteFormDrawer
        open={drawerOpen}
        mode={formMode}
        form={form}
        onFormChange={setForm}
        onClose={() => setDrawerOpen(false)}
        onSubmit={handleSubmit}
        onDelete={handleDelete}
        submitting={submitting}
        editSite={editSite}
      />

      {/* REDO-01-G 调度配置 drawer（CrawlerAdvancedMenu 触发） */}
      <SchedulerConfigDrawer
        open={schedulerOpen}
        onClose={() => setSchedulerOpen(false)}
        onSaved={refresh}
      />
    </div>
  )
}
