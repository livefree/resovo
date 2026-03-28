'use client'

/**
 * SandboxTableDemo — 沙盒演示组件
 *
 * 演示 TableSettingsTrigger + useTableSettings + ModernDataTable 的完整集成。
 * 使用 mock 数据，无 API 调用。
 */

import { useMemo } from 'react'
import { ModernDataTable } from '@/components/admin/shared/modern-table/ModernDataTable'
import type { TableColumn } from '@/components/admin/shared/modern-table/types'
import {
  useTableSettings,
  TableSettingsTrigger,
} from '@/components/admin/shared/modern-table/settings'

// ── mock 数据 ─────────────────────────────────────────────────────────────────

interface MockRow {
  id: string
  title: string
  status: string
  views: number
  createdAt: string
}

const MOCK_ROWS: MockRow[] = [
  { id: '1', title: '星际穿越', status: '已上架', views: 12450, createdAt: '2026-01-15' },
  { id: '2', title: '盗梦空间', status: '已上架', views: 9821, createdAt: '2026-01-20' },
  { id: '3', title: '肖申克的救赎', status: '待审核', views: 0, createdAt: '2026-02-01' },
  { id: '4', title: '搏击俱乐部', status: '已下架', views: 4302, createdAt: '2026-02-10' },
  { id: '5', title: '泰坦尼克号', status: '已上架', views: 21003, createdAt: '2026-03-05' },
]

// ── 列定义 ────────────────────────────────────────────────────────────────────

const SANDBOX_COLUMNS: Array<TableColumn<MockRow>> = [
  {
    id: 'id',
    header: 'ID',
    accessor: (row) => row.id,
    width: 60,
    enableSorting: false,
  },
  {
    id: 'title',
    header: '标题',
    accessor: (row) => row.title,
    width: 200,
    enableSorting: true,
  },
  {
    id: 'status',
    header: '状态',
    accessor: (row) => row.status,
    width: 100,
    enableSorting: true,
  },
  {
    id: 'views',
    header: '播放量',
    accessor: (row) => row.views,
    width: 100,
    enableSorting: true,
  },
  {
    id: 'createdAt',
    header: '创建时间',
    accessor: (row) => row.createdAt,
    width: 140,
    enableSorting: true,
  },
]

// ── settings 列定义 ───────────────────────────────────────────────────────────

const SETTINGS_COLUMNS = [
  { id: 'id', label: 'ID', defaultVisible: true, defaultSortable: false, required: true },
  { id: 'title', label: '标题', defaultVisible: true, defaultSortable: true },
  { id: 'status', label: '状态', defaultVisible: true, defaultSortable: true },
  { id: 'views', label: '播放量', defaultVisible: true, defaultSortable: true },
  { id: 'createdAt', label: '创建时间', defaultVisible: true, defaultSortable: true },
]

// ── 演示组件 ──────────────────────────────────────────────────────────────────

export function SandboxTableDemo() {
  const { orderedSettings, updateSetting, reset, applyToColumns } = useTableSettings({
    tableId: 'sandbox-demo',
    columns: SETTINGS_COLUMNS,
  })

  const visibleColumns = useMemo(
    () => applyToColumns(SANDBOX_COLUMNS),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [applyToColumns, orderedSettings],
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-[var(--text)]">TableSettingsPanel 演示</h2>
        <p className="text-xs text-[var(--muted)]">
          点击右侧 ⋮ 按钮打开设置面板，切换列的显示与排序开关，刷新后状态保持。
        </p>
      </div>

      {/* 表格 + 设置触发器 */}
      <div className="relative">
        <div className="absolute right-2 top-2 z-30">
          <TableSettingsTrigger
            columns={orderedSettings}
            onToggle={updateSetting}
            onReset={reset}
            data-testid="sandbox-settings"
          />
        </div>
        <ModernDataTable
          columns={visibleColumns}
          rows={MOCK_ROWS}
          getRowId={(row) => row.id}
          scrollTestId="sandbox-table"
        />
      </div>

      {/* 状态展示区 */}
      <div className="rounded border border-[var(--border)] bg-[var(--bg2)] p-3">
        <p className="mb-2 text-xs font-medium text-[var(--muted)]">当前设置状态（orderedSettings）</p>
        <div className="grid gap-1">
          {orderedSettings.map((s) => (
            <div key={s.id} className="flex items-center gap-3 text-xs text-[var(--text)]">
              <span className="w-24 truncate font-medium">{s.label}</span>
              <span className={s.visible ? 'text-green-400' : 'text-[var(--muted)]'}>
                {s.visible ? '显示 ✓' : '隐藏 ✗'}
              </span>
              <span className={s.sortable ? 'text-green-400' : 'text-[var(--muted)]'}>
                {s.sortable ? '可排序 ✓' : '不可排序 ✗'}
              </span>
              {s.required && <span className="text-amber-400">必选</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
