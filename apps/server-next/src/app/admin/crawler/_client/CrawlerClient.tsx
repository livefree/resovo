'use client'

/**
 * CrawlerClient.tsx — `/admin/crawler` 采集控制视图 MVP（CHG-SN-6-13）
 *
 * 范围（M-SN-6 收尾）：
 *   - 站点 CRUD（list / create / update / delete / batch / validate）
 *   - system-status overview（4 scheduler 状态卡）
 *
 * 不在范围（独立卡承接）：
 *   - tasks / runs / freeze / monitor-snapshot（CrawlerJobs 独立视图）
 *   - 任务依赖 DAG（等 reference §5.6 A2 + ADR-DAG）
 *   - MACCMS 详细配置 / 线路别名分组（独立卡）
 *
 * 共享原语（≥ 80%）：
 *   DataTable / Drawer / AdminCard / AdminButton / AdminInput / AdminSelect /
 *   AdminCheckbox / CodeText / EmptyState / ErrorState / LoadingState / useToast
 */

import React, { useState, useEffect, useMemo, useCallback, type CSSProperties } from 'react'
import {
  DataTable,
  Drawer,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  AdminCard,
  AdminButton,
  AdminInput,
  AdminSelect,
  AdminCheckbox,
  CodeText,
  useToast,
  type AdminSelectOption,
  type TableColumn,
  type TableSelectionState,
  type TableSortState,
} from '@resovo/admin-ui'
import {
  listCrawlerSites,
  createCrawlerSite,
  updateCrawlerSite,
  deleteCrawlerSite,
  batchCrawlerSites,
  validateCrawlerSite,
  getCrawlerSystemStatus,
  type CrawlerSite,
  type CrawlerSiteBatchAction,
  type CrawlerSystemStatus,
  type CreateCrawlerSiteInput,
} from '@/lib/crawler/api'
import { ApiClientError } from '@/lib/api-client'

const PAGE_STYLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--section-gap)',
  padding: 'var(--page-padding-y) var(--page-padding-x) 0',
}

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

const FORM_GRID_STYLE: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '120px 1fr',
  gap: '12px 16px',
  alignItems: 'center',
  padding: '16px',
}

const FORM_LABEL_STYLE: CSSProperties = {
  fontSize: 'var(--font-size-xs)',
  color: 'var(--fg-muted)',
}

const FORM_ACTIONS_STYLE: CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: '8px',
  padding: '12px 16px',
  borderTop: '1px solid var(--border-default)',
}

const SOURCE_TYPE_OPTIONS: readonly AdminSelectOption[] = [
  { value: 'vod', label: '长视频（vod）' },
  { value: 'shortdrama', label: '短剧（shortdrama）' },
]

const FORMAT_OPTIONS: readonly AdminSelectOption[] = [
  { value: 'json', label: 'JSON' },
  { value: 'xml', label: 'XML' },
]

const BATCH_ACTION_OPTIONS: ReadonlyArray<{ value: CrawlerSiteBatchAction; label: string }> = [
  { value: 'enable', label: '启用' },
  { value: 'disable', label: '禁用' },
  { value: 'mark_adult', label: '标记成人' },
  { value: 'unmark_adult', label: '取消成人标记' },
  { value: 'mark_shortdrama', label: '标记短剧' },
  { value: 'mark_vod', label: '标记 vod' },
  { value: 'delete', label: '删除（非 config）' },
]

type FormMode = { kind: 'create' } | { kind: 'edit'; key: string }

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

// ── columns ──────────────────────────────────────────────────────

function buildColumns(): readonly TableColumn<CrawlerSite>[] {
  return [
    {
      id: 'key',
      header: 'Key',
      accessor: (r) => r.key,
      width: 160,
      defaultVisible: true,
      pinned: true,
      cell: ({ row }) => <CodeText value={row.key} dataAttr={{ 'data-site-key': row.key }} />,
    },
    {
      id: 'name',
      header: '名称',
      accessor: (r) => r.name,
      minWidth: 180,
      defaultVisible: true,
      cell: ({ row }) => (
        <span style={{ display: 'inline-flex', flexDirection: 'column', gap: '2px' }}>
          <span>{row.name}</span>
          {row.displayName ? (
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--fg-muted)' }}>
              显示名：{row.displayName}
            </span>
          ) : null}
        </span>
      ),
    },
    {
      id: 'apiUrl',
      header: 'API URL',
      accessor: (r) => r.apiUrl,
      minWidth: 240,
      defaultVisible: true,
      cell: ({ row }) => <CodeText value={row.apiUrl} muted dataAttr={{ 'data-api-url': row.apiUrl }} />,
    },
    {
      id: 'sourceType',
      header: '类型',
      accessor: (r) => r.sourceType,
      width: 110,
      defaultVisible: true,
      cell: ({ row }) => <CodeText value={row.sourceType} />,
    },
    {
      id: 'format',
      header: '格式',
      accessor: (r) => r.format,
      width: 80,
      defaultVisible: true,
      cell: ({ row }) => <CodeText value={row.format} muted />,
    },
    {
      id: 'weight',
      header: '权重',
      accessor: (r) => r.weight,
      width: 80,
      defaultVisible: true,
      cell: ({ row }) => <span data-weight>{row.weight}</span>,
    },
    {
      id: 'status',
      header: '状态',
      accessor: (r) => (r.disabled ? 'disabled' : 'enabled'),
      width: 100,
      defaultVisible: true,
      cell: ({ row }) => {
        const enabled = !row.disabled
        return (
          <span
            style={{
              display: 'inline-block',
              padding: '2px 8px',
              borderRadius: 'var(--radius-pill, 12px)',
              fontSize: 'var(--font-size-xs)',
              background: enabled ? 'var(--state-success-bg)' : 'var(--state-warning-bg)',
              color: enabled ? 'var(--state-success-fg)' : 'var(--state-warning-fg)',
            }}
            data-site-status={enabled ? 'enabled' : 'disabled'}
          >
            {enabled ? '启用' : '禁用'}
          </span>
        )
      },
    },
    {
      id: 'fromConfig',
      header: '来源',
      accessor: (r) => (r.fromConfig ? 'config' : 'admin'),
      width: 90,
      defaultVisible: true,
      cell: ({ row }) => (
        <span
          style={{
            fontSize: 'var(--font-size-xs)',
            color: row.fromConfig ? 'var(--fg-muted)' : 'var(--fg-default)',
          }}
          data-from-config={String(row.fromConfig)}
        >
          {row.fromConfig ? 'config 文件' : '管理员创建'}
        </span>
      ),
    },
  ]
}

// ── main ─────────────────────────────────────────────────────────

export function CrawlerClient() {
  const toast = useToast()

  const [sites, setSites] = useState<readonly CrawlerSite[]>([])
  const [status, setStatus] = useState<CrawlerSystemStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [retryKey, setRetryKey] = useState(0)

  // selection
  const [selection, setSelection] = useState<TableSelectionState>({
    selectedKeys: new Set(),
    mode: 'page',
  })
  const [batchAction, setBatchAction] = useState<CrawlerSiteBatchAction | null>(null)
  const [batchPending, setBatchPending] = useState(false)

  // drawer for create / edit
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [formMode, setFormMode] = useState<FormMode>({ kind: 'create' })
  const [form, setForm] = useState<CreateCrawlerSiteInput>({
    key: '',
    name: '',
    apiUrl: '',
    sourceType: 'vod',
    format: 'json',
    weight: 50,
    isAdult: false,
  })
  const [submitting, setSubmitting] = useState(false)
  const [validating, setValidating] = useState(false)

  // load data
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

  const handleCreate = useCallback(() => {
    setFormMode({ kind: 'create' })
    setForm({
      key: '', name: '', apiUrl: '',
      sourceType: 'vod', format: 'json',
      weight: 50, isAdult: false,
    })
    setDrawerOpen(true)
  }, [])

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
      refresh()
    } catch (err: unknown) {
      const { title, description } = describeApiError(err)
      toast.push({ title, description, level: 'danger' })
    }
  }, [refresh, toast])

  const handleValidate = useCallback(async () => {
    if (!form.apiUrl) return
    setValidating(true)
    try {
      const result = await validateCrawlerSite(form.apiUrl)
      if (result.ok) {
        toast.push({
          title: '验证通过',
          description: `HTTP ${result.statusCode ?? 200} · ${result.message ?? 'API 可达'}`,
          level: 'success',
        })
      } else {
        toast.push({
          title: '验证失败',
          description: result.message ?? `HTTP ${result.statusCode ?? '?'}`,
          level: 'warn',
        })
      }
    } catch (err: unknown) {
      const { title, description } = describeApiError(err)
      toast.push({ title, description, level: 'danger' })
    } finally {
      setValidating(false)
    }
  }, [form.apiUrl, toast])

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
      refresh()
    } catch (err: unknown) {
      const { title, description } = describeApiError(err)
      toast.push({ title, description, level: 'danger' })
    } finally {
      setBatchPending(false)
    }
  }, [batchAction, selection, refresh, toast])

  const columns = useMemo(() => buildColumns(), [])

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

  // ── render ──

  return (
    <div data-crawler-client style={PAGE_STYLE}>
      <PageHeader
        title="采集控制"
        subtitle={`${sites.length} 个站点 · MVP（不含 tasks / runs / DAG）`}
        actions={
          <span style={{ display: 'inline-flex', gap: '8px' }}>
            <AdminButton
              variant="primary"
              size="sm"
              onClick={handleCreate}
              data-testid="crawler-create-btn"
            >
              + 新增站点
            </AdminButton>
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

      {/* system status */}
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

      {/* batch action bar */}
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

      {/* table */}
      {loading && sites.length === 0
        ? <LoadingState variant="skeleton" />
        : error
          ? <ErrorState error={error} title="加载失败" onRetry={refresh} />
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

      {/* create / edit drawer */}
      <Drawer
        open={drawerOpen}
        placement="right"
        width={480}
        onClose={() => setDrawerOpen(false)}
        title={formMode.kind === 'create' ? '新增采集站点' : `编辑站点 · ${formMode.key}`}
        data-testid="crawler-drawer"
      >
        <div style={FORM_GRID_STYLE}>
          <label style={FORM_LABEL_STYLE}>Key</label>
          <AdminInput
            value={form.key}
            onChange={(e) => setForm((f) => ({ ...f, key: e.target.value }))}
            disabled={formMode.kind === 'edit'}
            placeholder="例 jszyapi（创建后不可改）"
            data-testid="crawler-form-key"
          />
          <label style={FORM_LABEL_STYLE}>名称</label>
          <AdminInput
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="例 极速资源"
            data-testid="crawler-form-name"
          />
          <label style={FORM_LABEL_STYLE}>API URL</label>
          <AdminInput
            value={form.apiUrl}
            onChange={(e) => setForm((f) => ({ ...f, apiUrl: e.target.value }))}
            placeholder="https://api.example.com/api.php/..."
            data-testid="crawler-form-apiUrl"
            suffix={
              <AdminButton
                variant="ghost"
                size="sm"
                disabled={!form.apiUrl}
                loading={validating}
                onClick={() => void handleValidate()}
                data-testid="crawler-form-validate"
              >
                验证
              </AdminButton>
            }
          />
          <label style={FORM_LABEL_STYLE}>类型</label>
          <AdminSelect
            options={SOURCE_TYPE_OPTIONS}
            value={form.sourceType ?? 'vod'}
            onChange={(v) => setForm((f) => ({ ...f, sourceType: (v as 'vod' | 'shortdrama') ?? 'vod' }))}
            data-testid="crawler-form-sourceType"
          />
          <label style={FORM_LABEL_STYLE}>格式</label>
          <AdminSelect
            options={FORMAT_OPTIONS}
            value={form.format ?? 'json'}
            onChange={(v) => setForm((f) => ({ ...f, format: (v as 'json' | 'xml') ?? 'json' }))}
            data-testid="crawler-form-format"
          />
          <label style={FORM_LABEL_STYLE}>权重</label>
          <AdminInput
            type="number"
            value={String(form.weight ?? 50)}
            onChange={(e) => setForm((f) => ({ ...f, weight: Number(e.target.value) || 0 }))}
            placeholder="0-100"
            data-testid="crawler-form-weight"
          />
          <label style={FORM_LABEL_STYLE}>成人内容</label>
          <AdminCheckbox
            label="标记为成人内容站点"
            checked={form.isAdult ?? false}
            onChange={(e) => setForm((f) => ({ ...f, isAdult: e.target.checked }))}
            data-testid="crawler-form-isAdult"
          />
        </div>
        <div style={FORM_ACTIONS_STYLE}>
          {formMode.kind === 'edit' ? (
            <AdminButton
              variant="danger"
              size="sm"
              onClick={() => {
                const site = sites.find((s) => s.key === formMode.key)
                if (site) {
                  setDrawerOpen(false)
                  void handleDelete(site)
                }
              }}
              data-testid="crawler-form-delete"
            >
              删除站点
            </AdminButton>
          ) : null}
          <AdminButton
            variant="ghost"
            size="sm"
            onClick={() => setDrawerOpen(false)}
            data-testid="crawler-form-cancel"
          >
            取消
          </AdminButton>
          <AdminButton
            variant="primary"
            size="sm"
            loading={submitting}
            disabled={!form.key || !form.name || !form.apiUrl}
            onClick={() => void handleSubmit()}
            data-testid="crawler-form-submit"
          >
            {formMode.kind === 'create' ? '创建' : '保存'}
          </AdminButton>
        </div>
      </Drawer>
    </div>
  )
}
