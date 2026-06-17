import { DataTable, AdminButton } from '@resovo/admin-ui'
import type { TableColumn, TableQuerySnapshot } from '@resovo/admin-ui'

// ── 视频行数据 ─────────────────────────────────────────────────────────
interface VideoRow {
  id: string
  shortId: string
  title: string
  type: '电影' | '电视剧' | '综艺' | '动漫'
  status: '已发布' | '待审核' | '草稿' | '已拒绝'
  sourceCount: number
  updatedAt: string
}

const ROWS: readonly VideoRow[] = [
  { id: 'v001', shortId: 'V001', title: '流浪地球2', type: '电影', status: '已发布', sourceCount: 8, updatedAt: '2024-03-15' },
  { id: 'v002', shortId: 'V002', title: '繁花', type: '电视剧', status: '已发布', sourceCount: 30, updatedAt: '2024-03-14' },
  { id: 'v003', shortId: 'V003', title: '长安三万里', type: '电影', status: '待审核', sourceCount: 3, updatedAt: '2024-03-13' },
  { id: 'v004', shortId: 'V004', title: '三体', type: '电视剧', status: '已发布', sourceCount: 12, updatedAt: '2024-03-12' },
  { id: 'v005', shortId: 'V005', title: '封神第一部：朝歌风云', type: '电影', status: '待审核', sourceCount: 5, updatedAt: '2024-03-11' },
  { id: 'v006', shortId: 'V006', title: '漫长的季节', type: '电视剧', status: '已发布', sourceCount: 22, updatedAt: '2024-03-10' },
  { id: 'v007', shortId: 'V007', title: '年会不能停！', type: '电影', status: '草稿', sourceCount: 0, updatedAt: '2024-03-09' },
  { id: 'v008', shortId: 'V008', title: '欢乐喜剧人', type: '综艺', status: '已拒绝', sourceCount: 0, updatedAt: '2024-03-08' },
]

// ── 状态颜色 ───────────────────────────────────────────────────────────
function statusColor(status: VideoRow['status']): string {
  switch (status) {
    case '已发布': return 'var(--state-success-fg)'
    case '待审核': return 'var(--state-warning-fg)'
    case '草稿': return 'var(--fg-muted)'
    case '已拒绝': return 'var(--state-error-fg)'
  }
}

// ── 列定义 ─────────────────────────────────────────────────────────────
const COLUMNS: readonly TableColumn<VideoRow>[] = [
  {
    id: 'shortId',
    header: '短 ID',
    accessor: (r) => r.shortId,
    width: 80,
    enableSorting: true,
    kind: 'data',
  },
  {
    id: 'title',
    header: '标题',
    accessor: (r) => r.title,
    enableSorting: true,
    kind: 'data',
    cell: ({ row }) => (
      <span style={{ fontWeight: 500, color: 'var(--fg-default)' }}>{row.title}</span>
    ),
  },
  {
    id: 'type',
    header: '类型',
    accessor: (r) => r.type,
    width: 90,
    enableSorting: true,
    kind: 'data',
    filterKind: 'enum',
    filterOptions: [
      { value: '电影', label: '电影' },
      { value: '电视剧', label: '电视剧' },
      { value: '综艺', label: '综艺' },
      { value: '动漫', label: '动漫' },
    ],
  },
  {
    id: 'status',
    header: '状态',
    accessor: (r) => r.status,
    width: 100,
    enableSorting: true,
    kind: 'data',
    filterKind: 'enum',
    filterOptions: [
      { value: '已发布', label: '已发布' },
      { value: '待审核', label: '待审核' },
      { value: '草稿', label: '草稿' },
      { value: '已拒绝', label: '已拒绝' },
    ],
    cell: ({ row }) => (
      <span style={{ color: statusColor(row.status), fontWeight: 500 }}>{row.status}</span>
    ),
  },
  {
    id: 'sourceCount',
    header: '源数',
    accessor: (r) => r.sourceCount,
    width: 70,
    enableSorting: true,
    kind: 'data',
    filterKind: 'number',
    cell: ({ row }) => (
      <span style={{ color: row.sourceCount === 0 ? 'var(--state-error-fg)' : 'var(--fg-default)' }}>
        {row.sourceCount}
      </span>
    ),
  },
  {
    id: 'updatedAt',
    header: '更新时间',
    accessor: (r) => r.updatedAt,
    width: 110,
    enableSorting: true,
    kind: 'data',
    filterKind: 'date',
  },
  {
    id: 'actions',
    header: '操作',
    accessor: () => null,
    width: 100,
    kind: 'action',
    cell: () => (
      <div style={{ display: 'flex', gap: 4 }}>
        <AdminButton variant="ghost" size="sm">编辑</AdminButton>
      </div>
    ),
  },
]

// ── 基础 query ─────────────────────────────────────────────────────────
const BASE_QUERY: TableQuerySnapshot = {
  pagination: { page: 1, pageSize: 10 },
  sort: { field: undefined, direction: 'asc' },
  filters: new Map(),
  columns: new Map(),
  selection: { selectedKeys: new Set(), mode: 'page' },
}

// ── Story 1：基础视频列表 ─────────────────────────────────────────────
export const VideoList = () => (
  <div style={{ height: 420, display: 'flex', flexDirection: 'column' }}>
    <DataTable<VideoRow>
      rows={ROWS}
      columns={COLUMNS}
      rowKey={(r) => r.id}
      mode="client"
      query={BASE_QUERY}
      onQueryChange={() => {}}
      pagination={{}}
    />
  </div>
)

// ── Story 2：带内置 Toolbar（搜索 + 新建按钮） ────────────────────────
export const WithToolbar = () => (
  <div style={{ height: 460, display: 'flex', flexDirection: 'column' }}>
    <DataTable<VideoRow>
      rows={ROWS}
      columns={COLUMNS}
      rowKey={(r) => r.id}
      mode="client"
      query={BASE_QUERY}
      onQueryChange={() => {}}
      toolbar={{
        search: (
          <input
            placeholder="搜索视频标题…"
            style={{
              width: 260,
              height: 32,
              padding: '0 10px',
              fontSize: 'var(--font-size-sm-tight)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--bg-surface)',
              color: 'var(--fg-default)',
              outline: 'none',
            }}
          />
        ),
        trailing: (
          <AdminButton variant="primary" size="sm">新建视频</AdminButton>
        ),
      }}
      pagination={{}}
    />
  </div>
)

// ── Story 3：带选区 + 批量操作 ─────────────────────────────────────────
const WITH_SELECTION_QUERY: TableQuerySnapshot = {
  ...BASE_QUERY,
  selection: { selectedKeys: new Set(['v001', 'v003', 'v005']), mode: 'page' },
}

export const WithBulkActions = () => (
  <div style={{ height: 480, display: 'flex', flexDirection: 'column' }}>
    <DataTable<VideoRow>
      rows={ROWS}
      columns={COLUMNS}
      rowKey={(r) => r.id}
      mode="client"
      query={WITH_SELECTION_QUERY}
      onQueryChange={() => {}}
      selection={WITH_SELECTION_QUERY.selection}
      onSelectionChange={() => {}}
      bulkActions={
        <div style={{ display: 'flex', gap: 8 }}>
          <AdminButton variant="primary" size="sm">批量通过</AdminButton>
          <AdminButton variant="danger" size="sm">批量拒绝</AdminButton>
        </div>
      }
      pagination={{}}
    />
  </div>
)

// ── Story 4：加载态 ────────────────────────────────────────────────────
export const Loading = () => (
  <div style={{ height: 360, display: 'flex', flexDirection: 'column' }}>
    <DataTable<VideoRow>
      rows={[]}
      columns={COLUMNS}
      rowKey={(r) => r.id}
      mode="server"
      totalRows={0}
      query={BASE_QUERY}
      onQueryChange={() => {}}
      loading
    />
  </div>
)

// ── Story 5：空状态 ────────────────────────────────────────────────────
export const Empty = () => (
  <div style={{ height: 280, display: 'flex', flexDirection: 'column' }}>
    <DataTable<VideoRow>
      rows={[]}
      columns={COLUMNS}
      rowKey={(r) => r.id}
      mode="client"
      query={BASE_QUERY}
      onQueryChange={() => {}}
      emptyState={
        <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--fg-muted)', fontSize: 'var(--font-size-sm-tight)' }}>
          暂无视频数据，请调整筛选条件后重试
        </div>
      }
    />
  </div>
)
