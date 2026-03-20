/**
 * CrawlerSiteManager.tsx — 视频源配置管理面板（Client Component）
 * CHG-35: 表格列表 + CRUD + 批量操作 + 验证 + 导入导出
 */

'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { apiClient } from '@/lib/api-client'
import type { CrawlerSite, CreateCrawlerSiteInput, UpdateCrawlerSiteInput, CrawlerSiteBatchAction } from '@/types'
import { useAdminToast } from '@/components/admin/shared/feedback/useAdminToast'
import { useCrawlerSiteColumns } from '@/components/admin/system/crawler-site/hooks/useCrawlerSiteColumns'
import { useCrawlerSiteSelection } from '@/components/admin/system/crawler-site/hooks/useCrawlerSiteSelection'
import { useCrawlerSites } from '@/components/admin/system/crawler-site/hooks/useCrawlerSites'
import { useCrawlerSiteCrawlTasks } from '@/components/admin/system/crawler-site/hooks/useCrawlerSiteCrawlTasks'
import { CrawlerSiteTable } from '@/components/admin/system/crawler-site/components/CrawlerSiteTable'
import { CrawlerSiteTopToolbar } from '@/components/admin/system/crawler-site/components/CrawlerSiteTopToolbar'
import { ActiveFilterChipsBar } from '@/components/admin/system/crawler-site/components/ActiveFilterChipsBar'
import { CrawlerSiteOverviewStats } from '@/components/admin/system/crawler-site/components/CrawlerSiteOverviewStats'
import {
  CrawlerSiteFormDialog,
  EMPTY_SITE_FORM,
  type SiteFormData,
} from '@/components/admin/system/crawler-site/components/CrawlerSiteFormDialog'
import { parseSitesFromJson } from '@/components/admin/system/crawler-site/importParser'

// ── 类型 ──────────────────────────────────────────────────────

type ValidateStatus = 'idle' | 'checking' | 'ok' | 'error' | 'timeout'

interface ValidateResult {
  status: 'ok' | 'error' | 'timeout'
  httpStatus: number | null
  latencyMs: number | null
}

interface CrawlerOverview {
  siteTotal: number
  connected: number
  running: number
  failed: number
  todayVideos: number
  todayDurationMs: number
}

// ── 主组件 ────────────────────────────────────────────────────

export function CrawlerSiteManager() {
  const [editTarget, setEditTarget] = useState<CrawlerSite | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [validateStates, setValidateStates] = useState<Record<string, ValidateStatus>>({})
  const [rowSaving, setRowSaving] = useState<Record<string, boolean>>({})
  const [overview, setOverview] = useState<CrawlerOverview | null>(null)
  const [allCrawlTriggering, setAllCrawlTriggering] = useState<Record<'incremental-crawl' | 'full-crawl', boolean>>({
    'incremental-crawl': false,
    'full-crawl': false,
  })
  const { toast, showToast } = useAdminToast({ durationMs: 3500 })
  const {
    sortBy,
    sortDir,
    filters,
    columns,
    columnWidths,
    showColumnsPanel,
    setFilters,
    setShowColumnsPanel,
    handleSort,
    setSort,
    toggleColumn,
    startResize,
    visibleColumnCount,
    colClass,
    visibleTableMinWidth,
    columnMeta,
    requiredColumns,
  } = useCrawlerSiteColumns()
  const { sites, loading, fetchSites } = useCrawlerSites()
  const {
    runningBySite,
    runningModeBySite,
    latestTaskBySite,
    triggerSiteCrawl,
  } = useCrawlerSiteCrawlTasks({
    fetchSites,
    showToast,
  })

  const displaySites = useMemo(() => {
    const keyOrName = filters.keyOrName.trim().toLowerCase()
    const apiUrl = filters.apiUrl.trim().toLowerCase()
    const min = filters.weightMin.trim() === '' ? null : Number(filters.weightMin)
    const max = filters.weightMax.trim() === '' ? null : Number(filters.weightMax)

    const filtered = sites.filter((site) => {
      if (keyOrName && !`${site.name} ${site.key}`.toLowerCase().includes(keyOrName)) return false
      if (apiUrl && !site.apiUrl.toLowerCase().includes(apiUrl)) return false
      if (filters.sourceType !== 'all' && site.sourceType !== filters.sourceType) return false
      if (filters.format !== 'all' && site.format !== filters.format) return false
      if (filters.isAdult === 'yes' && !site.isAdult) return false
      if (filters.isAdult === 'no' && site.isAdult) return false
      if (filters.disabled === 'enabled' && site.disabled) return false
      if (filters.disabled === 'disabled' && !site.disabled) return false
      if (filters.fromConfig === 'config' && !site.fromConfig) return false
      if (filters.fromConfig === 'manual' && site.fromConfig) return false
      if (min !== null && !Number.isNaN(min) && site.weight < min) return false
      if (max !== null && !Number.isNaN(max) && site.weight > max) return false
      return true
    })

    const dir = sortDir === 'asc' ? 1 : -1
    return filtered.sort((a, b) => {
      const compareString = (x: string, y: string) => x.localeCompare(y, 'zh-CN', { sensitivity: 'base' })
      switch (sortBy) {
        case 'name': return dir * compareString(a.name, b.name)
        case 'key': return dir * compareString(a.key, b.key)
        case 'apiUrl': return dir * compareString(a.apiUrl, b.apiUrl)
        case 'sourceType': return dir * compareString(a.sourceType, b.sourceType)
        case 'format': return dir * compareString(a.format, b.format)
        case 'weight': return dir * (a.weight - b.weight)
        case 'isAdult': return dir * (Number(a.isAdult) - Number(b.isAdult))
        case 'disabled': return dir * (Number(a.disabled) - Number(b.disabled))
        case 'fromConfig': return dir * (Number(a.fromConfig) - Number(b.fromConfig))
        default: return 0
      }
    })
  }, [sites, filters, sortBy, sortDir])

  const visibleKeys = useMemo(
    () => displaySites.map((site) => site.key),
    [displaySites],
  )
  const {
    selected,
    allVisibleSelected,
    toggleSelect,
    toggleAll,
    clearSelection,
  } = useCrawlerSiteSelection(visibleKeys)

  const fetchOverview = useCallback(async () => {
    try {
      const res = await apiClient.get<{ data: CrawlerOverview }>('/admin/crawler/overview')
      setOverview(res.data)
    } catch {
      // 非阻塞：概览失败不影响列表主流程
    }
  }, [])

  useEffect(() => {
    void fetchOverview()
    const timer = window.setInterval(() => {
      void fetchOverview()
    }, 5000)
    return () => window.clearInterval(timer)
  }, [fetchOverview])

  // ── 验证 ───────────────────────────────────────────────────

  async function handleValidate(site: CrawlerSite) {
    setValidateStates((prev) => ({ ...prev, [site.key]: 'checking' }))
    try {
      const res = await apiClient.post<{ data: ValidateResult }>('/admin/crawler/sites/validate', { apiUrl: site.apiUrl })
      setValidateStates((prev) => ({ ...prev, [site.key]: res.data.status }))
    } catch {
      setValidateStates((prev) => ({ ...prev, [site.key]: 'error' }))
    }
  }

  // ── 快速切换启用状态 ─────────────────────────────────────────

  async function handleToggleDisabled(site: CrawlerSite) {
    await handleInlineUpdate(site, { disabled: !site.disabled }, false)
  }

  async function handleInlineUpdate(site: CrawlerSite, patch: UpdateCrawlerSiteInput, showSuccess = true) {
    setRowSaving((prev) => ({ ...prev, [site.key]: true }))
    try {
      await apiClient.patch(`/admin/crawler/sites/${site.key}`, patch)
      await fetchSites()
      if (showSuccess) showToast(`已更新 ${site.name}`, true)
    } catch {
      showToast(`更新 ${site.name} 失败`, false)
    } finally {
      setRowSaving((prev) => ({ ...prev, [site.key]: false }))
    }
  }

  async function handleTriggerCrawl(type: 'full-crawl' | 'incremental-crawl', site?: CrawlerSite) {
    if (site) {
      await triggerSiteCrawl(site.key, type === 'full-crawl' ? 'full' : 'incremental', site.name)
      return
    }

    setAllCrawlTriggering((prev) => ({ ...prev, [type]: true }))
    try {
      await apiClient.post('/admin/crawler/tasks', {
        type,
      })
      showToast(type === 'full-crawl' ? '已触发全站全量采集' : '已触发全站增量采集', true)
      await fetchSites()
      await fetchOverview()
    } catch {
      showToast(type === 'full-crawl' ? '全站全量采集触发失败' : '全站增量采集触发失败', false)
    } finally {
      setAllCrawlTriggering((prev) => ({ ...prev, [type]: false }))
    }
  }

  // ── 删除 ───────────────────────────────────────────────────

  async function handleDelete(site: CrawlerSite) {
    if (!confirm(`确定删除源站 "${site.name}"？`)) return
    try {
      await apiClient.delete(`/admin/crawler/sites/${site.key}`)
      await fetchSites()
      showToast('已删除', true)
    } catch {
      showToast('删除失败（配置文件来源的源站不可删除）', false)
    }
  }

  // ── 批量操作 ───────────────────────────────────────────────

  async function handleBatch(action: CrawlerSiteBatchAction) {
    if (selected.size === 0) { showToast('请先选择源站', false); return }
    const label = { enable: '启用', disable: '停用', delete: '删除', mark_adult: '标记成人', unmark_adult: '取消成人', mark_shortdrama: '标记短剧', mark_vod: '标记长片' }[action]
    if (action === 'delete' && !confirm(`确定批量删除 ${selected.size} 个源站？`)) return
    try {
      const res = await apiClient.post<{ data: { affected: number } }>('/admin/crawler/sites/batch', {
        keys: Array.from(selected),
        action,
      })
      await fetchSites()
      clearSelection()
      showToast(`批量${label}成功，影响 ${res.data.affected} 条`, true)
    } catch {
      showToast('批量操作失败', false)
    }
  }

  // ── 新增 ───────────────────────────────────────────────────

  async function handleAdd(form: SiteFormData) {
    const input: CreateCrawlerSiteInput = {
      key:        form.key,
      name:       form.name,
      apiUrl:     form.apiUrl,
      detail:     form.detail || undefined,
      sourceType: form.sourceType,
      format:     form.format,
      weight:     form.weight,
      isAdult:    form.isAdult,
    }
    await apiClient.post('/admin/crawler/sites', input)
    await fetchSites()
    showToast('添加成功', true)
  }

  // ── 编辑 ───────────────────────────────────────────────────

  async function handleEdit(form: SiteFormData) {
    if (!editTarget) return
    const input: UpdateCrawlerSiteInput = {
      name:       form.name,
      apiUrl:     form.apiUrl,
      detail:     form.detail || undefined,
      sourceType: form.sourceType,
      format:     form.format,
      weight:     form.weight,
      isAdult:    form.isAdult,
    }
    await apiClient.patch(`/admin/crawler/sites/${editTarget.key}`, input)
    await fetchSites()
    showToast('更新成功', true)
  }

  // ── 导出 ───────────────────────────────────────────────────

  function handleExport() {
    const data: Record<string, unknown> = {}
    for (const s of sites) {
      data[s.key] = { name: s.name, api: s.apiUrl, detail: s.detail, type: s.sourceType, format: s.format, weight: s.weight, is_adult: s.isAdult }
    }
    const json = JSON.stringify({ crawler_sites: data }, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'crawler_sites.json'; a.click()
    URL.revokeObjectURL(url)
  }

  // ── 导入 ───────────────────────────────────────────────────

  function handleImport() {
    const input = document.createElement('input')
    input.type = 'file'; input.accept = '.json'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      const text = await file.text()
      try {
        const json = JSON.parse(text)
        const parsedSites = parseSitesFromJson(json)
        if (parsedSites.length === 0) {
          showToast('未识别到可导入源站（需包含 name + api/api_url/url）', false)
          return
        }
        const existingByApi = new Map(sites.map((site) => [site.apiUrl, site]))
        let ok = 0, fail = 0
        for (const site of parsedSites) {
          try {
            const existing = existingByApi.get(site.apiUrl)
            if (existing) {
              await apiClient.patch(`/admin/crawler/sites/${existing.key}`, {
                name: site.name,
                apiUrl: site.apiUrl,
                detail: site.detail,
                sourceType: site.sourceType,
                format: site.format,
                weight: site.weight,
                isAdult: site.isAdult,
              })
            } else {
              await apiClient.post('/admin/crawler/sites', site)
            }
            ok++
          } catch { fail++ }
        }
        await fetchSites()
        showToast(`导入完成：成功 ${ok}，失败 ${fail}`, ok > 0)
      } catch {
        showToast('JSON 解析失败', false)
      }
    }
    input.click()
  }

  // ── 渲染 ──────────────────────────────────────────────────

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-sm text-[var(--muted)]">加载中…</div>
  }

  return (
    <div>
      <CrawlerSiteOverviewStats data={overview} />

      <CrawlerSiteTopToolbar
        filters={filters}
        setFilters={setFilters}
        showColumnsPanel={showColumnsPanel}
        columns={columns}
        requiredColumns={requiredColumns}
        selectedCount={selected.size}
        isAllIncrementalTriggering={allCrawlTriggering['incremental-crawl']}
        isAllFullTriggering={allCrawlTriggering['full-crawl']}
        toast={toast}
        columnMeta={columnMeta}
        setShowColumnsPanel={setShowColumnsPanel}
        toggleColumn={toggleColumn}
        onAdd={() => setShowAdd(true)}
        onTriggerIncremental={() => {
          void handleTriggerCrawl('incremental-crawl')
        }}
        onTriggerFull={() => {
          void handleTriggerCrawl('full-crawl')
        }}
        onExport={handleExport}
        onImport={handleImport}
        onBatch={(action) => {
          void handleBatch(action)
        }}
      />

      <ActiveFilterChipsBar filters={filters} setFilters={setFilters} />

      <CrawlerSiteTable
        displaySites={displaySites}
        selected={selected}
        allVisibleSelected={allVisibleSelected}
        sortBy={sortBy}
        sortDir={sortDir}
        filters={filters}
        columnWidths={columnWidths}
        visibleColumnCount={visibleColumnCount}
        visibleTableMinWidth={visibleTableMinWidth}
        validateStates={validateStates}
        rowSaving={rowSaving}
        runningBySite={runningBySite}
        runningModeBySite={runningModeBySite}
        latestTaskBySite={latestTaskBySite}
        setFilters={setFilters}
        colClass={colClass}
        handleSort={handleSort}
        setSort={setSort}
        toggleColumn={toggleColumn}
        requiredColumns={requiredColumns}
        startResize={startResize}
        toggleSelect={toggleSelect}
        toggleAll={toggleAll}
        handleInlineUpdate={handleInlineUpdate}
        handleToggleDisabled={handleToggleDisabled}
        handleValidate={handleValidate}
        handleTriggerCrawl={handleTriggerCrawl}
        handleDelete={handleDelete}
        setEditTarget={setEditTarget}
        showToast={showToast}
      />

      {/* 添加 Modal */}
      {showAdd && (
        <CrawlerSiteFormDialog
          title="添加源站"
          initial={EMPTY_SITE_FORM}
          onSave={handleAdd}
          onClose={() => setShowAdd(false)}
          isEdit={false}
        />
      )}

      {/* 编辑 Modal */}
      {editTarget && (
        <CrawlerSiteFormDialog
          title={`编辑：${editTarget.name}`}
          initial={{
            key:        editTarget.key,
            name:       editTarget.name,
            apiUrl:     editTarget.apiUrl,
            detail:     editTarget.detail ?? '',
            sourceType: editTarget.sourceType,
            format:     editTarget.format,
            weight:     editTarget.weight,
            isAdult:    editTarget.isAdult,
          }}
          onSave={handleEdit}
          onClose={() => setEditTarget(null)}
          isEdit={true}
        />
      )}
    </div>
  )
}
