import { Pagination } from '@resovo/admin-ui'

const col: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 16, padding: 16 }
const label: React.CSSProperties = { fontSize: 'var(--font-size-xs)', color: 'var(--fg-muted)', marginBottom: 4 }

// 标准用法：视频库列表分页（中段页码）
export const Default = () => (
  <div style={col}>
    <div style={label}>视频资源库 · 第 5 页 / 共 23 页（456 条）</div>
    <Pagination
      page={5}
      pageSize={20}
      totalRows={456}
      onPageChange={() => {}}
      onPageSizeChange={() => {}}
    />
  </div>
)

// 首页态：上一页禁用、首页高亮
export const FirstPage = () => (
  <div style={col}>
    <div style={label}>第 1 页（首页，上一页禁用）</div>
    <Pagination
      page={1}
      pageSize={20}
      totalRows={238}
      onPageChange={() => {}}
      onPageSizeChange={() => {}}
    />
  </div>
)

// 末页态：下一页禁用、末页高亮
export const LastPage = () => (
  <div style={col}>
    <div style={label}>末页（下一页禁用）</div>
    <Pagination
      page={12}
      pageSize={20}
      totalRows={238}
      onPageChange={() => {}}
      onPageSizeChange={() => {}}
    />
  </div>
)

// 空数据态：显示"暂无数据"
export const Empty = () => (
  <div style={col}>
    <div style={label}>空数据（totalRows=0）</div>
    <Pagination
      page={1}
      pageSize={20}
      totalRows={0}
      onPageChange={() => {}}
    />
  </div>
)

// 自定义 pageSize 选项 + 大数据集（番剧元数据库）
export const LargeDataset = () => (
  <div style={col}>
    <div style={label}>番剧元数据库 · 每页 50 条 · 共 12340 条</div>
    <Pagination
      page={8}
      pageSize={50}
      totalRows={12340}
      onPageChange={() => {}}
      onPageSizeChange={() => {}}
      pageSizeOptions={[20, 50, 100, 200]}
      windowSize={3}
    />
  </div>
)
