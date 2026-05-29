'use client'

/**
 * SourceLineAliasesClient.tsx — Layer B 山名代号管理视图（CHG-368-B-B / ADR-164 §6）
 *
 * 范围：列表 + 行级编辑（displayName / codename / priority）+ 退役 + codename 字库可用性
 *
 * 原语消费：
 *   - PageHeader（page__head 统一壳）
 *   - DataTable 一体化（CLAUDE.md server-next 后台表格强约束）
 *   - AdminCard（codename 池摘要）
 *   - Modal + AdminInput + AdminButton（编辑行 Modal）
 *
 * 硬约束：
 *   - 零 admin-ui 通用组件 props 反向扩展
 *   - 零本地新建 admin-ui 通用组件
 *   - 不复用 ModernDataTable / 外置 PaginationV2 / 外置 SelectionActionBar
 */

import { useState, useEffect, useMemo, useCallback, type CSSProperties } from 'react'
import {
  DataTable,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  AdminButton,
  AdminInput,
  AdminCard,
  Modal,
  useToast,
  type TableColumn,
  type TableSortState,
  type FilterValue,
} from '@resovo/admin-ui'
import type { SourceLineRow } from '@/lib/sources/types'
import {
  listAllSourceLines,
  upsertLineAliasWithFields,
  retireLineAlias,
  getCodenamePool,
} from '@/lib/sources/api'

// ── 类型 ───────────────────────────────────────────────────────────

interface EditingState {
  readonly row: SourceLineRow
  displayName: string
  codename: string
  priority: number
}

interface CodenamePoolView {
  readonly available: readonly string[]
  readonly occupied: readonly string[]
  readonly cooling: readonly string[]
}

// ── 样式 ───────────────────────────────────────────────────────────

const PAGE_STYLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  minHeight: 0,
  gap: 'var(--section-gap)',
}

const POOL_GRID_STYLE: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
  gap: 12,
}

const POOL_CELL_STYLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
}

const POOL_COUNT_STYLE: CSSProperties = {
  fontSize: 'var(--font-size-lg)',
  fontWeight: 600,
  color: 'var(--fg-default)',
}

const POOL_LABEL_STYLE: CSSProperties = {
  fontSize: 'var(--font-size-xs)',
  color: 'var(--fg-muted)',
}

const FIELD_STYLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  marginBottom: 12,
}

const LABEL_STYLE: CSSProperties = {
  fontSize: 'var(--font-size-xs)',
  color: 'var(--fg-muted)',
}

// ── 主组件 ─────────────────────────────────────────────────────────

export function SourceLineAliasesClient() {
  const toast = useToast()
  const [rows, setRows] = useState<readonly SourceLineRow[]>([])
  const [pool, setPool] = useState<CodenamePoolView | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<unknown>(null)
  const [editing, setEditing] = useState<EditingState | null>(null)
  const [saving, setSaving] = useState(false)
  const [retiring, setRetiring] = useState<string | null>(null)
  const [sort, setSort] = useState<TableSortState>({ field: undefined, direction: 'asc' })

  // DataTable v2 query state（mode='client' / 数据量 <200 / 无 pagination / 仅 sort）
  const query = useMemo(
    () => ({
      pagination: { page: 1, pageSize: 200 },
      sort,
      filters: new Map<string, FilterValue>(),
      columns: new Map(),
      selection: { selectedKeys: new Set<string>(), mode: 'page' as const },
    }),
    [sort],
  )

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      // CHG-SN-9-LINES-VIEW-UNIFY：换用 listAllSourceLines（含未分配别名 unassigned 行）
      const [list, codenamePool] = await Promise.all([listAllSourceLines(), getCodenamePool()])
      setRows(list)
      setPool(codenamePool)
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const handleEdit = (row: SourceLineRow) => {
    setEditing({
      row,
      // 未分配行：displayName 已 fallback 到 source_name；用户编辑保存 = 首次分配 upsert
      displayName: row.displayName,
      codename: row.codename ?? '',
      priority: row.priority,
    })
  }

  const handleSave = async () => {
    if (!editing) return
    if (!editing.displayName.trim()) {
      toast.push({ title: '别名不能为空', level: 'warn' })
      return
    }
    if (editing.priority < 0 || editing.priority > 100) {
      toast.push({ title: 'priority 必须在 0-100', level: 'warn' })
      return
    }
    setSaving(true)
    try {
      await upsertLineAliasWithFields(
        editing.row.sourceSiteKey,
        editing.row.sourceName,
        {
          displayName: editing.displayName.trim(),
          codename: editing.codename.trim() || null,
          priority: editing.priority,
        },
      )
      toast.push({
        title: editing.row.assignedAt === null ? '已分配别名' : '已保存',
        level: 'success',
      })
      setEditing(null)
      await refresh()
    } catch (err) {
      const msg = err instanceof Error ? err.message : '保存失败'
      toast.push({ title: '保存失败', description: msg, level: 'danger' })
    } finally {
      setSaving(false)
    }
  }

  const handleRetire = async (row: SourceLineRow) => {
    const codenameLabel = row.codename ?? '（未分配）'
    const ok = window.confirm(
      `确认退役 ${row.sourceSiteKey} / ${row.sourceName}？\n\n` +
      `codename ${codenameLabel} 将进入 90 天冷却期，期间不可被新别名复用。`,
    )
    if (!ok) return
    const key = `${row.sourceSiteKey}/${row.sourceName}`
    setRetiring(key)
    try {
      await retireLineAlias(row.sourceSiteKey, row.sourceName)
      toast.push({ title: '已退役', level: 'success' })
      await refresh()
    } catch (err) {
      const msg = err instanceof Error ? err.message : '退役失败'
      toast.push({ title: '退役失败', description: msg, level: 'danger' })
    } finally {
      setRetiring(null)
    }
  }

  const columns: readonly TableColumn<SourceLineRow>[] = [
    {
      id: 'sourceSiteKey',
      header: 'site_key',
      accessor: (r) => r.sourceSiteKey,
      cell: ({ row }) => (
        <code style={{ fontSize: '12px', color: 'var(--fg-muted)' }}>{row.sourceSiteKey}</code>
      ),
    },
    {
      id: 'sourceName',
      header: 'source_name',
      accessor: (r) => r.sourceName,
      cell: ({ row }) => (
        <code style={{ fontSize: '12px', color: 'var(--fg-muted)' }}>{row.sourceName}</code>
      ),
    },
    {
      id: 'displayName',
      header: '别名',
      accessor: (r) => r.displayName,
      cell: ({ row }) =>
        row.assignedAt === null ? (
          <span style={{ color: 'var(--fg-muted)', fontStyle: 'italic' }}>
            {row.displayName}（未分配）
          </span>
        ) : (
          <span style={{ color: 'var(--fg-default)' }}>{row.displayName}</span>
        ),
    },
    {
      id: 'codename',
      header: '代号 (Layer B)',
      accessor: (r) => r.codename ?? '—',
      cell: ({ row }) =>
        row.codename ? (
          <span style={{ color: 'var(--fg-default)' }}>{row.codename}</span>
        ) : (
          <span style={{ color: 'var(--fg-muted)' }}>—</span>
        ),
    },
    {
      id: 'priority',
      header: '优先级',
      accessor: (r) => r.priority,
    },
    {
      id: 'status',
      header: '状态',
      kind: 'computed',
      accessor: (r) =>
        r.assignedAt === null
          ? 'unassigned'
          : r.retiredAt === null
            ? 'active'
            : r.autoRetired
              ? 'auto_retired'
              : 'retired',
      cell: ({ row }) => {
        if (row.assignedAt === null) {
          return <span style={{ color: 'var(--fg-muted)' }}>未分配</span>
        }
        if (row.retiredAt === null) {
          return <span style={{ color: 'var(--state-success-fg)' }}>在役</span>
        }
        return (
          <span style={{ color: 'var(--state-warning-fg)' }}>
            已退役{row.autoRetired ? '（自动）' : '（手动）'}
          </span>
        )
      },
    },
    {
      id: 'usage',
      header: '使用',
      accessor: (r) => r.videoCount,
      cell: ({ row }) => {
        // FIX-3: alias-only 孤儿行（已分配别名但 video_sources 全软删 / 不存在）
        // 仍需在 UI 显示让运维监控冷却期 codename 占用
        if (row.assignedAt !== null && row.videoCount === 0) {
          return (
            <span style={{ color: 'var(--state-warning-fg)', fontSize: 'var(--font-size-xs)' }} title="此别名行无关联 video_sources / 可能仅存在于冷却期或历史归档">
              无关联视频
            </span>
          )
        }
        return (
          <span style={{ color: 'var(--fg-muted)', fontSize: 'var(--font-size-xs)' }}>
            {row.videoCount} 视频 · {row.activeCount}/{row.episodeCount} 集
          </span>
        )
      },
    },
    {
      id: 'actions',
      header: '操作',
      kind: 'action',
      accessor: () => null,
      cell: ({ row }) => {
        const key = `${row.sourceSiteKey}/${row.sourceName}`
        const isAssigned = row.assignedAt !== null
        const isActive = isAssigned && row.retiredAt === null
        return (
          <div style={{ display: 'flex', gap: 4 }}>
            <AdminButton size="sm" variant="ghost" onClick={() => handleEdit(row)}>
              {isAssigned ? '编辑' : '分配'}
            </AdminButton>
            {isActive && (
              <AdminButton
                size="sm"
                variant="danger"
                disabled={retiring === key}
                onClick={() => void handleRetire(row)}
                data-testid={`retire-${key}`}
              >
                {retiring === key ? '退役中…' : '退役'}
              </AdminButton>
            )}
          </div>
        )
      },
    },
  ]

  return (
    <div style={PAGE_STYLE}>
      <PageHeader
        title="线路别名管理"
        subtitle="所有线路（含未分配别名）/ Layer B 山名代号 / 退役治理"
      />

      {pool && (
        <AdminCard>
          <div style={POOL_GRID_STYLE}>
            <div style={POOL_CELL_STYLE}>
              <span style={POOL_COUNT_STYLE}>{pool.available.length}</span>
              <span style={POOL_LABEL_STYLE}>可用 codename</span>
            </div>
            <div style={POOL_CELL_STYLE}>
              <span style={POOL_COUNT_STYLE}>{pool.occupied.length}</span>
              <span style={POOL_LABEL_STYLE}>已占用</span>
            </div>
            <div style={POOL_CELL_STYLE}>
              <span style={POOL_COUNT_STYLE}>{pool.cooling.length}</span>
              <span style={POOL_LABEL_STYLE}>冷却中（&lt; 90 天）</span>
            </div>
          </div>
        </AdminCard>
      )}

      {loading && rows.length === 0 ? (
        <LoadingState variant="skeleton" />
      ) : error ? (
        <ErrorState
          error={error instanceof Error ? error : new Error(error instanceof Object ? JSON.stringify(error) : String(error))}
          title="加载失败"
          onRetry={refresh}
        />
      ) : (
        <DataTable<SourceLineRow>
          rows={rows}
          columns={columns}
          rowKey={(r) => `${r.sourceSiteKey}/${r.sourceName}`}
          mode="client"
          query={query}
          onQueryChange={(patch) => {
            if (patch.sort) setSort(patch.sort)
          }}
          emptyState={<EmptyState title="暂无别名" description="还未配置任何线路别名" />}
          data-testid="source-line-aliases-table"
          enableHeaderMenu
        />
      )}

      {editing && (
        <Modal
          open={true}
          onClose={() => !saving && setEditing(null)}
          title={`${editing.row.assignedAt === null ? '分配别名' : '编辑别名'}：${editing.row.sourceSiteKey} / ${editing.row.sourceName}`}
          size="sm"
        >
          <div style={{ padding: 16 }}>
            <div style={FIELD_STYLE}>
              <label style={LABEL_STYLE} htmlFor="alias-display-name">
                别名（必填，1-100 字符）
              </label>
              <AdminInput
                id="alias-display-name"
                value={editing.displayName}
                onChange={(e) => setEditing({ ...editing, displayName: e.target.value })}
                size="sm"
                disabled={saving}
              />
            </div>

            <div style={FIELD_STYLE}>
              <label style={LABEL_STYLE} htmlFor="alias-codename">
                codename（可选 / 山名代号 / 1-20 字符 / 中文-数字-连字符）
              </label>
              <AdminInput
                id="alias-codename"
                value={editing.codename}
                onChange={(e) => setEditing({ ...editing, codename: e.target.value })}
                placeholder="如：泰山-2"
                size="sm"
                disabled={saving}
              />
            </div>

            <div style={FIELD_STYLE}>
              <label style={LABEL_STYLE} htmlFor="alias-priority">
                优先级（0-100 / 影响 effective_score 5% 通道）
              </label>
              <AdminInput
                id="alias-priority"
                type="number"
                value={String(editing.priority)}
                onChange={(e) => setEditing({ ...editing, priority: parseInt(e.target.value, 10) || 0 })}
                size="sm"
                disabled={saving}
              />
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
              <AdminButton variant="ghost" size="sm" disabled={saving} onClick={() => setEditing(null)}>
                取消
              </AdminButton>
              <AdminButton variant="primary" size="sm" disabled={saving} onClick={() => void handleSave()}>
                {saving ? '保存中…' : '保存'}
              </AdminButton>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
