import { useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { CrawlerSiteBatchAction } from '@/types'
import type { ColumnId, ColumnVisibility, FilterState } from '@/components/admin/system/crawler-site/tableState'
import { AdminBatchBar } from '@/components/admin/shared/batch/AdminBatchBar'
import { AdminToolbar } from '@/components/admin/shared/toolbar/AdminToolbar'
import { AdminButton } from '@/components/admin/shared/button/AdminButton'
import { CrawlerSiteAdvancedFilters } from '@/components/admin/system/crawler-site/components/CrawlerSiteAdvancedFilters'

interface CrawlerSiteTopToolbarProps {
  filters: FilterState
  setFilters: Dispatch<SetStateAction<FilterState>>
  showColumnsPanel: boolean
  columns: ColumnVisibility
  requiredColumns: ColumnId[]
  selectedCount: number
  isAllIncrementalTriggering: boolean
  isAllFullTriggering: boolean
  toast: { msg: string; ok: boolean } | null
  columnMeta: Array<{ id: ColumnId; label: string }>
  setShowColumnsPanel: Dispatch<SetStateAction<boolean>>
  toggleColumn: (columnId: ColumnId) => void
  onAdd: () => void
  onTriggerIncremental: () => void
  onTriggerFull: () => void
  onExport: () => void
  onImport: () => void
  onBatch: (action: CrawlerSiteBatchAction) => void
}

export function CrawlerSiteTopToolbar({
  filters,
  setFilters,
  showColumnsPanel,
  columns,
  requiredColumns,
  selectedCount,
  isAllIncrementalTriggering,
  isAllFullTriggering,
  toast,
  columnMeta,
  setShowColumnsPanel,
  toggleColumn,
  onAdd,
  onTriggerIncremental,
  onTriggerFull,
  onExport,
  onImport,
  onBatch,
}: CrawlerSiteTopToolbarProps) {
  const [showAdvanced, setShowAdvanced] = useState(false)

  return (
    <div className="mb-4">
      <AdminToolbar
        className="gap-3"
        actions={(
          <>
            <AdminButton onClick={onAdd} variant="primary" className="px-4 font-medium">
              + 添加源站
            </AdminButton>
            <AdminButton
              onClick={onTriggerIncremental}
              disabled={isAllIncrementalTriggering}
            >
              全站增量采集
            </AdminButton>
            <AdminButton
              onClick={onTriggerFull}
              disabled={isAllFullTriggering}
            >
              全站全量采集
            </AdminButton>

            <input
              value={filters.keyOrName}
              onChange={(event) => setFilters((prev) => ({ ...prev, keyOrName: event.target.value }))}
              placeholder="筛选 名称 / key"
              className="rounded-md border border-[var(--border)] bg-[var(--bg3)] px-3 py-2 text-sm text-[var(--text)]"
            />

            <select
              value={filters.sourceType}
              onChange={(event) => setFilters((prev) => ({ ...prev, sourceType: event.target.value as typeof prev.sourceType }))}
              className="rounded-md border border-[var(--border)] bg-[var(--bg3)] px-3 py-2 text-sm text-[var(--text)]"
            >
              <option value="all">全部类型</option>
              <option value="vod">长片</option>
              <option value="shortdrama">短剧</option>
            </select>
            <select
              value={filters.disabled}
              onChange={(event) => setFilters((prev) => ({ ...prev, disabled: event.target.value as typeof prev.disabled }))}
              className="rounded-md border border-[var(--border)] bg-[var(--bg3)] px-3 py-2 text-sm text-[var(--text)]"
            >
              <option value="all">全部状态</option>
              <option value="enabled">运行中</option>
              <option value="disabled">停用</option>
            </select>
            <select
              value={filters.fromConfig}
              onChange={(event) => setFilters((prev) => ({ ...prev, fromConfig: event.target.value as typeof prev.fromConfig }))}
              className="rounded-md border border-[var(--border)] bg-[var(--bg3)] px-3 py-2 text-sm text-[var(--text)]"
            >
              <option value="all">全部来源</option>
              <option value="config">配置</option>
              <option value="manual">手工</option>
            </select>

            <AdminButton onClick={onExport}>
              导出 JSON
            </AdminButton>
            <AdminButton onClick={onImport}>
              导入 JSON
            </AdminButton>

            <div className="relative">
              <AdminButton
                type="button"
                onClick={() => setShowColumnsPanel((prev) => !prev)}
              >
                列设置
              </AdminButton>
              {showColumnsPanel && (
                <div className="absolute left-0 z-20 mt-1 w-56 rounded-md border border-[var(--border)] bg-[var(--bg2)] p-2 shadow-lg">
                  <p className="mb-2 text-xs text-[var(--muted)]">勾选显示列（名称/管理操作为必显）</p>
                  <div className="space-y-1">
                    {columnMeta.map((column) => (
                      <label key={column.id} className="flex items-center gap-2 rounded px-2 py-1 text-xs text-[var(--text)] hover:bg-[var(--bg3)]">
                        <input
                          type="checkbox"
                          checked={columns[column.id]}
                          disabled={requiredColumns.includes(column.id)}
                          onChange={() => toggleColumn(column.id)}
                          className="accent-[var(--accent)]"
                        />
                        <span>{column.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <AdminButton
              type="button"
              onClick={() => setShowAdvanced((prev) => !prev)}
              className={showAdvanced ? 'border-[var(--accent)] bg-[var(--accent)]/10' : ''}
            >
              高级筛选
            </AdminButton>

            <AdminBatchBar
              selectedCount={selectedCount}
              actions={[
                { key: 'enable', label: '批量启用', onClick: () => onBatch('enable') },
                { key: 'disable', label: '批量停用', onClick: () => onBatch('disable') },
                { key: 'mark_adult', label: '标记成人', onClick: () => onBatch('mark_adult') },
                { key: 'delete', label: '批量删除', onClick: () => onBatch('delete'), danger: true },
              ]}
            />
          </>
        )}
        feedback={toast ? <span className={`text-sm ${toast.ok ? 'text-green-500' : 'text-red-500'}`}>{toast.msg}</span> : null}
      />

      {showAdvanced ? <CrawlerSiteAdvancedFilters filters={filters} setFilters={setFilters} /> : null}
    </div>
  )
}
