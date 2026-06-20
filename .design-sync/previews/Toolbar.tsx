import { Toolbar, AdminButton, AdminInput } from '@resovo/admin-ui'

const RefreshIcon = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
    <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
    <path d="M16 16h5v5" />
  </svg>
)
const PlusIcon = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M12 5v14M5 12h14" />
  </svg>
)
const ExportIcon = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
)
const SettingsIcon = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14" />
  </svg>
)

const wrap: React.CSSProperties = {
  background: 'var(--bg-surface)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 'var(--radius-md)',
  padding: '0 16px',
}
const col: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 12, padding: 16 }

// 搜索框 + 操作按钮（最常见用法）
export const WithSearch = () => (
  <div style={col}>
    <div style={wrap}>
      <Toolbar
        leading={
          <AdminInput
            placeholder="搜索视频标题、短 ID…"
            style={{ width: 280 }}
          />
        }
        trailing={
          <div style={{ display: 'flex', gap: 8 }}>
            <AdminButton variant="ghost" size="sm" leftIcon={RefreshIcon}>刷新</AdminButton>
            <AdminButton variant="primary" size="sm" leftIcon={PlusIcon}>新建视频</AdminButton>
          </div>
        }
      />
    </div>
  </div>
)

// 搜索 + 列设置 + 导出（三槽位全满）
export const FullSlots = () => (
  <div style={col}>
    <div style={wrap}>
      <Toolbar
        leading={
          <AdminInput
            placeholder="搜索视频标题…"
            style={{ width: 260 }}
          />
        }
        columnSettings={
          <AdminButton variant="ghost" size="sm" leftIcon={SettingsIcon}>列设置</AdminButton>
        }
        trailing={
          <div style={{ display: 'flex', gap: 8 }}>
            <AdminButton variant="ghost" size="sm" leftIcon={ExportIcon}>导出</AdminButton>
            <AdminButton variant="primary" size="sm" leftIcon={PlusIcon}>新建</AdminButton>
          </div>
        }
      />
    </div>
  </div>
)

// 仅右侧 trailing（审核模块无搜索场景）
export const TrailingOnly = () => (
  <div style={col}>
    <div style={wrap}>
      <Toolbar
        trailing={
          <div style={{ display: 'flex', gap: 8 }}>
            <AdminButton variant="ghost" size="sm">批量审核</AdminButton>
            <AdminButton variant="danger" size="sm">批量拒绝</AdminButton>
          </div>
        }
      />
    </div>
  </div>
)
