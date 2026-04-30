/**
 * components-demo.tsx — packages/admin-ui 全量组件交互 demo（CHG-SN-2-19）
 * 'use client'：useTableQuery / Drawer / Modal / AdminDropdown 需要浏览器 API
 */
'use client'

import React, { useState, useRef } from 'react'
import {
  DataTable,
  Toolbar,
  FilterChipBar,
  ColumnSettingsPanel,
  Pagination,
  Drawer,
  Modal,
  AdminDropdown,
  SelectionActionBar,
  EmptyState,
  ErrorState,
  LoadingState,
  useTableQuery,
} from '@resovo/admin-ui'
import type {
  TableColumn,
  TableSelectionState,
  TableQueryPatch,
  FilterChipProps,
  AdminDropdownItem,
  SelectionAction,
} from '@resovo/admin-ui'
import { useTableRouterAdapter } from '@/lib/table-router-adapter'

// ── mock data ─────────────────────────────────────────────────────

interface DemoRow {
  id: string
  title: string
  category: string
  views: number
  status: 'active' | 'draft' | 'archived'
}

const MOCK_ROWS: DemoRow[] = Array.from({ length: 35 }, (_, i) => ({
  id: String(i + 1),
  title: `示例视频 ${i + 1}：${['剧情', '喜剧', '动作', '科幻', '爱情'][i % 5]}片段`,
  category: ['电影', '剧集', '综艺', '纪录片', '动漫'][i % 5],
  views: (i + 1) * 2500,
  status: (['active', 'draft', 'archived'] as const)[i % 3],
}))

const COLUMNS: TableColumn<DemoRow>[] = [
  { id: 'title', header: '标题', accessor: (r) => r.title, enableSorting: true },
  { id: 'category', header: '分类', accessor: (r) => r.category, enableSorting: true },
  {
    id: 'views',
    header: '播放量',
    accessor: (r) => r.views,
    enableSorting: true,
    cell: (ctx) => <span>{(ctx.value as number).toLocaleString()}</span>,
  },
  {
    id: 'status',
    header: '状态',
    accessor: (r) => r.status,
    cell: (ctx) => {
      const v = ctx.value as string
      const color = v === 'active' ? 'var(--state-success-fg)' : v === 'draft' ? 'var(--fg-muted)' : 'var(--state-error-fg)'
      return <span style={{ color, fontWeight: 500 }}>{v === 'active' ? '已上线' : v === 'draft' ? '草稿' : '已归档'}</span>
    },
  },
]

const DROPDOWN_ITEMS: AdminDropdownItem[] = [
  { key: 'edit', label: '编辑', onClick: () => alert('编辑') },
  { key: 'copy', label: '复制链接', onClick: () => alert('复制') },
  { key: 'delete', label: '删除', onClick: () => alert('删除'), danger: true, separator: true },
]

const SELECTION_ACTIONS: SelectionAction[] = [
  { key: 'export', label: '批量导出', onClick: () => alert('导出'), variant: 'default' },
  {
    key: 'delete',
    label: '批量删除',
    onClick: () => alert('已删除'),
    variant: 'danger',
    confirm: { title: '确认批量删除？此操作不可撤销' },
  },
]

// ── section wrapper ───────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 48 }}>
      <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--fg-default)', margin: '0 0 16px', paddingBottom: 8, borderBottom: '1px solid var(--border-subtle)' }}>
        {title}
      </h2>
      {children}
    </section>
  )
}

// ── DataTable client mode ─────────────────────────────────────────

function ClientTableDemo() {
  const router = useTableRouterAdapter()
  const [selection, setSelection] = useState<TableSelectionState>({ selectedKeys: new Set(), mode: 'page' })
  const { snapshot, patch, reset } = useTableQuery({
    tableId: 'demo-client',
    router,
    columns: COLUMNS,
    defaults: { pagination: { page: 1, pageSize: 10 } },
  })
  const settingsAnchor = useRef<HTMLButtonElement>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const filterText = (snapshot.filters.get('title') as { kind: 'text'; value: string } | undefined)?.value ?? ''

  const chipItems: FilterChipProps[] = filterText
    ? [{ id: 'title', label: '标题', value: filterText, onClear: () => { const next = new Map(snapshot.filters); next.delete('title'); patch({ filters: next }) } }]
    : []

  return (
    <div>
      <Toolbar
        leading={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="search"
              placeholder="搜索标题…"
              value={filterText}
              style={{ padding: '5px 10px', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-sm)', fontSize: 13, background: 'var(--bg-surface)', color: 'var(--fg-default)', width: 200 }}
              onChange={(e) => {
                const next = new Map<string, import('@resovo/admin-ui').FilterValue>(snapshot.filters)
                next.set('title', { kind: 'text', value: e.target.value })
                patch({ filters: next })
              }}
            />
            <FilterChipBar
              items={chipItems}
              onClearAll={chipItems.length > 0 ? () => patch({ filters: new Map() }) : undefined}
            />
          </div>
        }
        columnSettings={
          <button
            ref={settingsAnchor}
            type="button"
            onClick={() => setSettingsOpen((o) => !o)}
            style={{ padding: '5px 10px', fontSize: 12, border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-sm)', background: 'var(--bg-surface)', color: 'var(--fg-muted)', cursor: 'pointer' }}
          >
            列设置
          </button>
        }
        trailing={
          <button
            type="button"
            onClick={reset}
            style={{ padding: '5px 10px', fontSize: 12, border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-sm)', background: 'var(--bg-surface)', color: 'var(--fg-muted)', cursor: 'pointer' }}
          >
            重置
          </button>
        }
      />
      <ColumnSettingsPanel
        open={settingsOpen}
        columns={COLUMNS}
        value={snapshot.columns}
        onChange={(cols) => patch({ columns: cols })}
        onClose={() => setSettingsOpen(false)}
        anchorRef={settingsAnchor}
      />
      <DataTable
        columns={COLUMNS}
        rows={MOCK_ROWS}
        mode="client"
        query={snapshot}
        onQueryChange={(next: TableQueryPatch) => patch(next)}
        selection={selection}
        onSelectionChange={setSelection}
        rowKey={(r) => r.id}
      />
      <Pagination
        page={snapshot.pagination.page}
        pageSize={snapshot.pagination.pageSize}
        totalRows={MOCK_ROWS.length}
        onPageChange={(p) => patch({ pagination: { page: p } })}
        onPageSizeChange={(ps) => patch({ pagination: { pageSize: ps } })}
        pageSizeOptions={[10, 20, 50]}
      />
      <SelectionActionBar
        visible={selection.selectedKeys.size > 0}
        selectedCount={selection.selectedKeys.size}
        totalMatched={MOCK_ROWS.length}
        selectionMode={selection.mode}
        onSelectionModeChange={(mode) => setSelection((s) => ({ ...s, mode }))}
        onClearSelection={() => setSelection({ selectedKeys: new Set(), mode: 'page' })}
        actions={SELECTION_ACTIONS}
      />
    </div>
  )
}

// ── DataTable server mode ─────────────────────────────────────────

function ServerTableDemo() {
  const router = useTableRouterAdapter()
  const [page, setPage] = useState(1)
  const pageSize = 5
  const totalRows = MOCK_ROWS.length
  const sliced = MOCK_ROWS.slice((page - 1) * pageSize, page * pageSize)

  const { snapshot, patch } = useTableQuery({
    tableId: 'demo-server',
    router,
    columns: COLUMNS,
    defaults: { pagination: { page: 1, pageSize } },
    urlNamespace: 'sv',
  })

  return (
    <div>
      <DataTable
        columns={COLUMNS}
        rows={sliced}
        mode="server"
        query={snapshot}
        onQueryChange={(next: TableQueryPatch) => { patch(next); setPage(1) }}
        rowKey={(r) => r.id}
        totalRows={totalRows}
      />
      <Pagination
        page={page}
        pageSize={pageSize}
        totalRows={totalRows}
        onPageChange={setPage}
      />
    </div>
  )
}

// ── AdminDropdown standalone demo ─────────────────────────────────

function DropdownDemo() {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
      <AdminDropdown
        open={open}
        trigger={
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            style={{ padding: '6px 14px', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-sm)', background: 'var(--bg-surface)', cursor: 'pointer', fontSize: 13, color: 'var(--fg-default)' }}
          >
            操作菜单 ▾
          </button>
        }
        items={DROPDOWN_ITEMS}
        onOpenChange={setOpen}
        align="left"
      />
      <span style={{ fontSize: 12, color: 'var(--fg-muted)' }}>open={String(open)}</span>
    </div>
  )
}

// ── Pagination standalone demo ────────────────────────────────────

function PaginationDemo() {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  return (
    <div>
      <Pagination
        page={page}
        pageSize={pageSize}
        totalRows={235}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        pageSizeOptions={[10, 20, 50, 100]}
      />
      <p style={{ fontSize: 12, color: 'var(--fg-muted)', marginTop: 8 }}>page={page} pageSize={pageSize}</p>
    </div>
  )
}

// ── Drawer demo ───────────────────────────────────────────────────

function DrawerDemo() {
  const [open, setOpen] = useState(false)
  const [placement, setPlacement] = useState<'left' | 'right' | 'top' | 'bottom'>('right')
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      {(['left', 'right', 'top', 'bottom'] as const).map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => { setPlacement(p); setOpen(true) }}
          style={{ padding: '6px 14px', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-sm)', background: 'var(--bg-surface)', cursor: 'pointer', fontSize: 13, color: 'var(--fg-default)' }}
        >
          {p} Drawer
        </button>
      ))}
      <Drawer open={open} placement={placement} onClose={() => setOpen(false)} title={`${placement} 方向抽屉`}>
        <p style={{ color: 'var(--fg-muted)' }}>抽屉内容区域。placement={placement}。ESC 或点击遮罩可关闭。</p>
      </Drawer>
    </div>
  )
}

// ── State primitives demo ─────────────────────────────────────────

function StateDemo() {
  const [variant, setVariant] = useState<'empty' | 'error' | 'spinner' | 'skeleton'>('empty')
  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {(['empty', 'error', 'spinner', 'skeleton'] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setVariant(v)}
            style={{ padding: '5px 12px', border: `1px solid ${variant === v ? 'var(--accent-default)' : 'var(--border-strong)'}`, borderRadius: 'var(--radius-sm)', background: variant === v ? 'var(--accent-default)' : 'var(--bg-surface)', cursor: 'pointer', fontSize: 12, color: variant === v ? 'var(--fg-on-accent)' : 'var(--fg-default)' }}
          >
            {v}
          </button>
        ))}
      </div>
      <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
        {variant === 'empty' && <EmptyState title="暂无数据" description="添加第一条记录开始使用" action={{ label: '新建', onClick: () => alert('新建') }} />}
        {variant === 'error' && <ErrorState error={new Error('HTTP 500: Internal Server Error')} onRetry={() => alert('重试')} />}
        {variant === 'spinner' && <LoadingState label="数据加载中…" />}
        {variant === 'skeleton' && <LoadingState variant="skeleton" skeletonRows={5} />}
      </div>
    </div>
  )
}

// ── main demo ─────────────────────────────────────────────────────

export function ComponentsDemo() {
  const [modalOpen, setModalOpen] = useState(false)
  const [modalSize, setModalSize] = useState<'sm' | 'md' | 'lg'>('md')

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1200 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 32px', color: 'var(--fg-default)' }}>
        Admin UI 组件 Demo — CHG-SN-2-19
      </h1>

      <Section title="1. DataTable v2 — 客户端模式（useTableQuery + URL 同步）">
        <p style={{ fontSize: 12, color: 'var(--fg-muted)', marginBottom: 12 }}>
          URL 参数同步验证：调整排序/分页后刷新页面，参数应保留。tableId=demo-client
        </p>
        <ClientTableDemo />
      </Section>

      <Section title="2. DataTable v2 — 服务端模式（外部分页受控）">
        <p style={{ fontSize: 12, color: 'var(--fg-muted)', marginBottom: 12 }}>
          分页由外部 state 控制，DataTable 渲染传入的 rows slice。tableId=demo-server (urlNamespace=sv)
        </p>
        <ServerTableDemo />
      </Section>

      <Section title="3. Pagination v2 — 独立使用">
        <PaginationDemo />
      </Section>

      <Section title="4. Drawer — 四向 placement">
        <DrawerDemo />
      </Section>

      <Section title="5. Modal — 三档 size">
        <div style={{ display: 'flex', gap: 8 }}>
          {(['sm', 'md', 'lg'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => { setModalSize(s); setModalOpen(true) }}
              style={{ padding: '6px 14px', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-sm)', background: 'var(--bg-surface)', cursor: 'pointer', fontSize: 13, color: 'var(--fg-default)' }}
            >
              Modal {s}
            </button>
          ))}
        </div>
        <Modal open={modalOpen} size={modalSize} onClose={() => setModalOpen(false)} title={`Modal ${modalSize}（ESC 关闭）`}>
          <p style={{ margin: 0, color: 'var(--fg-muted)' }}>这是 Modal 的内容区域。点击遮罩层或按 ESC 可关闭。</p>
        </Modal>
      </Section>

      <Section title="6. AdminDropdown — 行操作菜单">
        <DropdownDemo />
      </Section>

      <Section title="7. EmptyState / ErrorState / LoadingState">
        <StateDemo />
      </Section>
    </div>
  )
}
