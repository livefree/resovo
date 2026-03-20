import type { Dispatch, SetStateAction } from 'react'
import { AdminBatchBar } from '@/components/admin/shared/batch/AdminBatchBar'
import { AdminToolbar } from '@/components/admin/shared/toolbar/AdminToolbar'
import type { ColumnId, ColumnVisibility } from '@/components/admin/system/crawler-site/tableState'
import type { CrawlerSiteBatchAction } from '@/types'

interface CrawlerSiteToolbarProps {
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

export function CrawlerSiteToolbar({
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
}: CrawlerSiteToolbarProps) {
  return (
    <AdminToolbar
      actions={(
        <>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={onAdd} className="rounded-md px-4 py-2 text-sm font-medium bg-[var(--accent)] text-black hover:opacity-90">
              + 添加源站
            </button>
            <button
              onClick={onTriggerIncremental}
              disabled={isAllIncrementalTriggering}
              className="rounded-md px-3 py-2 text-sm border border-[var(--border)] text-[var(--text)] hover:bg-[var(--bg3)] disabled:opacity-50"
            >
              全站增量采集
            </button>
            <button
              onClick={onTriggerFull}
              disabled={isAllFullTriggering}
              className="rounded-md px-3 py-2 text-sm border border-[var(--border)] text-[var(--text)] hover:bg-[var(--bg3)] disabled:opacity-50"
            >
              全站全量采集
            </button>
          </div>
          <div className="h-6 w-px bg-[var(--border)]" aria-hidden="true" />
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={onExport} className="rounded-md px-3 py-2 text-sm border border-[var(--border)] text-[var(--text)] hover:bg-[var(--bg3)]">
              导出 JSON
            </button>
            <button onClick={onImport} className="rounded-md px-3 py-2 text-sm border border-[var(--border)] text-[var(--text)] hover:bg-[var(--bg3)]">
              导入 JSON
            </button>
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowColumnsPanel((prev) => !prev)}
                className="rounded-md border border-[var(--border)] px-3 py-2 text-sm text-[var(--text)] hover:bg-[var(--bg3)]"
              >
                显示列
              </button>
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
                  <p className="mt-2 text-[10px] text-[var(--muted)]">列宽可在表头分隔线上拖拽调整</p>
                </div>
              )}
            </div>
          </div>
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
  )
}
