'use client'

/**
 * CrawlerSitesTab.tsx — 采集站点 CRUD 容器（CHG-SN-6-29-PATCH-1 拆分后精简）
 *
 * 内嵌：scheduler status + ControlsCard + batch action bar + sites 表 + 表单 Drawer。
 * 列定义在 `./crawler-site-columns`；表单在 `./CrawlerSiteFormDrawer`。
 *
 * Props：
 *   - sites/status/loading/error：来自父组件 fetch
 *   - createTrigger：父组件触发"+新增"时递增
 *   - onRefresh / onStatusUpdate：回父组件状态管理
 */

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import {
  DataTable,
  EmptyState,
  ErrorState,
  LoadingState,
  AdminCard,
  AdminButton,
  AdminSelect,
  useToast,
  type TableSelectionState,
} from '@resovo/admin-ui'
import {
  createCrawlerSite,
  updateCrawlerSite,
  deleteCrawlerSite,
  batchCrawlerSites,
  type CrawlerSite,
  type CrawlerSiteBatchAction,
  type CrawlerSystemStatus,
  type CreateCrawlerSiteInput,
} from '@/lib/crawler/api'
import { ApiClientError } from '@/lib/api-client'
import { CrawlerControlsCard } from './CrawlerControlsCard'
import { buildCrawlerSiteColumns } from './crawler-site-columns'
import { CrawlerSiteFormDrawer, type CrawlerSiteFormMode } from './CrawlerSiteFormDrawer'

const STATUS_GRID_STYLE: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
  gap: '12px',
}

const STATUS_LABEL_STYLE: CSSProperties = {
  fontSize: 'var(--font-size-xs)',
  color: 'var(--fg-muted)',
}

const STATUS_VALUE_STYLE: CSSProperties = {
  fontSize: 'var(--font-size-sm)',
  fontWeight: 500,
  color: 'var(--fg-default)',
  marginTop: '4px',
  fontFamily: 'var(--font-mono, ui-monospace, monospace)',
}

const BATCH_ACTION_OPTIONS: ReadonlyArray<{ value: CrawlerSiteBatchAction; label: string }> = [
  { value: 'enable', label: '启用' },
  { value: 'disable', label: '禁用' },
  { value: 'mark_adult', label: '标记成人' },
  { value: 'unmark_adult', label: '取消成人标记' },
  { value: 'mark_shortdrama', label: '标记短剧' },
  { value: 'mark_vod', label: '标记 vod' },
  { value: 'delete', label: '删除（非 config）' },
]

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
    return { title: '操作失败', description: err.message }
  }
  return { title: '操作失败', description: err instanceof Error ? err.message : '请稍后重试' }
}

export interface CrawlerSitesTabProps {
  readonly sites: readonly CrawlerSite[]
  readonly status: CrawlerSystemStatus | null
  readonly loading: boolean
  readonly error: Error | null
  readonly createTrigger: number
  readonly onRefresh: () => void
  readonly onStatusUpdate: (next: Partial<CrawlerSystemStatus>) => void
}

export function CrawlerSitesTab({
  sites,
  status,
  loading,
  error,
  createTrigger,
  onRefresh,
  onStatusUpdate,
}: CrawlerSitesTabProps) {
  const toast = useToast()

  const [selection, setSelection] = useState<TableSelectionState>({
    selectedKeys: new Set(),
    mode: 'page',
  })
  const [batchAction, setBatchAction] = useState<CrawlerSiteBatchAction | null>(null)
  const [batchPending, setBatchPending] = useState(false)

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [formMode, setFormMode] = useState<CrawlerSiteFormMode>({ kind: 'create' })
  const [form, setForm] = useState<CreateCrawlerSiteInput>(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)

  // 父组件触发"+ 新增"时 createTrigger 递增；首次挂载（=0）跳过
  useEffect(() => {
    if (createTrigger === 0) return
    setFormMode({ kind: 'create' })
    setForm(EMPTY_FORM)
    setDrawerOpen(true)
  }, [createTrigger])

  const handleEdit = useCallback((site: CrawlerSite) => {
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
          name: form.name, apiUrl: form.apiUrl, detail: form.detail,
          sourceType: form.sourceType, format: form.format,
          weight: form.weight, isAdult: form.isAdult,
        })
        toast.push({ title: '已更新', description: `站点 ${formMode.key} 更新成功`, level: 'success' })
      }
      setDrawerOpen(false)
      onRefresh()
    } catch (err: unknown) {
      const { title, description } = describeApiError(err)
      toast.push({ title, description, level: 'danger' })
    } finally {
      setSubmitting(false)
    }
  }, [form, formMode, onRefresh, toast])

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
      onRefresh()
    } catch (err: unknown) {
      const { title, description } = describeApiError(err)
      toast.push({ title, description, level: 'danger' })
    }
  }, [onRefresh, toast])

  const handleBatchApply = useCallback(async () => {
    if (!batchAction || selection.selectedKeys.size === 0) return
    setBatchPending(true)
    try {
      const result = await batchCrawlerSites(Array.from(selection.selectedKeys), batchAction)
      toast.push({
        title: '批量操作完成',
        description: `影响 ${result.affected} 个站点`,
        level: 'success',
      })
      setSelection({ selectedKeys: new Set(), mode: 'page' })
      setBatchAction(null)
      onRefresh()
    } catch (err: unknown) {
      const { title, description } = describeApiError(err)
      toast.push({ title, description, level: 'danger' })
    } finally {
      setBatchPending(false)
    }
  }, [batchAction, selection, onRefresh, toast])

  const columns = useMemo(() => buildCrawlerSiteColumns(), [])

  const query = useMemo(
    () => ({
      pagination: { page: 1, pageSize: 100 },
      sort: { field: undefined, direction: 'desc' as const },
      filters: new Map(),
      columns: new Map(),
      selection,
    }),
    [selection],
  )

  const editSite = formMode.kind === 'edit'
    ? sites.find((s) => s.key === formMode.key)
    : undefined

  return (
    <>
      {status?.schedulers ? (
        <AdminCard
          surface="plain"
          padding="md"
          header={{ title: '调度器状态', subtitle: '采集 + 验证 + 索引任务' }}
          data-testid="crawler-system-status"
        >
          <div style={STATUS_GRID_STYLE}>
            {status.schedulers.map((s) => (
              <div key={s.name} data-scheduler={s.name}>
                <div style={STATUS_LABEL_STYLE}>{s.name}</div>
                <div style={STATUS_VALUE_STYLE}>
                  {s.enabled ? '● 运行中' : '○ 已停止'} · {Math.round(s.intervalMs / 1000)}s
                </div>
              </div>
            ))}
          </div>
        </AdminCard>
      ) : null}

      <CrawlerControlsCard
        status={status}
        onStatusUpdate={onStatusUpdate}
        onRefreshAfterSchedulerSave={onRefresh}
      />

      {selection.selectedKeys.size > 0 ? (
        <AdminCard surface="plain" padding="sm" data-testid="crawler-batch-bar">
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--fg-muted)' }}>
              已选 {selection.selectedKeys.size} 个
            </span>
            <AdminSelect
              options={BATCH_ACTION_OPTIONS}
              value={batchAction}
              onChange={(v) => setBatchAction(v as CrawlerSiteBatchAction | null)}
              placeholder="选择批量动作"
              size="sm"
              data-testid="crawler-batch-action-select"
            />
            <AdminButton
              variant="primary"
              size="sm"
              disabled={!batchAction}
              loading={batchPending}
              onClick={() => void handleBatchApply()}
              data-testid="crawler-batch-apply"
            >
              应用
            </AdminButton>
            <AdminButton
              variant="ghost"
              size="sm"
              onClick={() => setSelection({ selectedKeys: new Set(), mode: 'page' })}
              data-testid="crawler-batch-cancel"
            >
              取消
            </AdminButton>
          </div>
        </AdminCard>
      ) : null}

      {loading && sites.length === 0
        ? <LoadingState variant="skeleton" />
        : error
          ? <ErrorState error={error} title="加载失败" onRetry={onRefresh} />
          : (
              <DataTable<CrawlerSite>
                rows={sites}
                columns={columns}
                rowKey={(r) => r.key}
                mode="client"
                query={query}
                onQueryChange={(patch) => {
                  if (patch.selection !== undefined) {
                    setSelection(patch.selection as TableSelectionState)
                  }
                }}
                onRowClick={(row) => handleEdit(row)}
                selection={selection}
                onSelectionChange={setSelection}
                loading={loading}
                emptyState={<EmptyState title="暂无站点" description="点击「新增站点」创建首个采集源" />}
                data-testid="crawler-table"
                pagination={{ hidden: true }}
              />
            )
      }

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
    </>
  )
}
