import { AdminDropdown } from '@resovo/admin-ui'

const col: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 20, padding: 16 }

const EditIcon = (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
)

const DeleteIcon = (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    <path d="M10 11v6M14 11v6" />
  </svg>
)

const HideIcon = (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
)

const TriggerButton = ({ label }: { label?: string }) => (
  <button
    type="button"
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      padding: '4px 10px',
      fontSize: 'var(--font-size-xs)',
      color: 'var(--fg-default)',
      background: 'var(--bg-surface)',
      border: '1px solid var(--border-default)',
      borderRadius: 'var(--radius-sm)',
      cursor: 'pointer',
    }}
  >
    {label ?? '操作'}
    <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
      <path d="M3 5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  </button>
)

const VIDEO_ACTIONS = [
  { key: 'edit', label: '编辑元数据', icon: EditIcon, onClick: () => {} },
  { key: 'hide', label: '下架资源', icon: HideIcon, onClick: () => {} },
  { key: 'sep1', label: '', separator: true, onClick: () => {} },
  { key: 'delete', label: '永久删除', icon: DeleteIcon, onClick: () => {}, danger: true },
]

const SOURCE_ACTIONS = [
  { key: 'refresh', label: '刷新线路', onClick: () => {}, shortcut: 'Mod+R' },
  { key: 'test', label: '测速检查', onClick: () => {}, shortcut: 'Mod+T' },
  { key: 'disable', label: '禁用此线路', onClick: () => {}, disabled: true },
  { key: 'sep', label: '', separator: true, onClick: () => {} },
  { key: 'remove', label: '移除线路', onClick: () => {}, danger: true },
]

// canonical：视频行操作菜单（关闭态，展示触发器样式）
export const Closed = () => (
  <div style={col}>
    <div>
      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--fg-muted)', marginBottom: 8 }}>
        视频列表行 · 行操作菜单（关闭态）
      </div>
      <AdminDropdown
        open={false}
        trigger={<TriggerButton />}
        items={VIDEO_ACTIONS}
        onOpenChange={() => {}}
      />
    </div>
    <div>
      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--fg-muted)', marginBottom: 8 }}>
        线路管理行 · 操作菜单
      </div>
      <AdminDropdown
        open={false}
        trigger={<TriggerButton label="线路操作" />}
        items={SOURCE_ACTIONS}
        onOpenChange={() => {}}
      />
    </div>
  </div>
)

// 打开态（portal 到 body，菜单项目可见；截图可能因 portal 逃逸而位置偏移）
export const Open = () => (
  <div style={{ ...col, minHeight: 260, position: 'relative' }}>
    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--fg-muted)', marginBottom: 8 }}>
      视频行操作菜单（打开态）— portal 渲染到 document.body
    </div>
    <AdminDropdown
      open
      trigger={<TriggerButton />}
      items={VIDEO_ACTIONS}
      onOpenChange={() => {}}
      align="left"
    />
  </div>
)

// 危险项 + shortcut 组合
export const WithShortcutsAndDanger = () => (
  <div style={{ ...col, minHeight: 280 }}>
    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--fg-muted)', marginBottom: 8 }}>
      线路操作菜单（打开态，含快捷键 + 禁用项 + 危险项）
    </div>
    <AdminDropdown
      open
      trigger={<TriggerButton label="线路操作" />}
      items={SOURCE_ACTIONS}
      onOpenChange={() => {}}
      align="left"
    />
  </div>
)
