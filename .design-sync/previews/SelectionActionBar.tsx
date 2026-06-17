import { SelectionActionBar } from '@resovo/admin-ui'

const wrap: React.CSSProperties = {
  position: 'relative',
  minHeight: 64,
  background: 'var(--bg-surface)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 'var(--radius-md)',
  overflow: 'hidden',
}
const col: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 12, padding: 16 }

const APPROVE_ACTION = {
  key: 'approve',
  label: '批量通过',
  variant: 'primary' as const,
  onClick: () => {},
}
const REJECT_ACTION = {
  key: 'reject',
  label: '批量拒绝',
  variant: 'danger' as const,
  confirm: { title: '确认批量拒绝所选视频？', description: '该操作不可撤销' },
  onClick: () => {},
}
const EXPORT_ACTION = {
  key: 'export',
  label: '导出选中',
  onClick: () => {},
}
const DELETE_ACTION = {
  key: 'delete',
  label: '删除',
  variant: 'danger' as const,
  disabled: true,
  onClick: () => {},
}

// page 模式（常规选择，含"选择全部"提示链接）
export const PageMode = () => (
  <div style={col}>
    <div style={wrap}>
      <SelectionActionBar
        visible
        variant="sticky-bottom"
        selectedCount={5}
        totalMatched={128}
        selectionMode="page"
        onSelectionModeChange={() => {}}
        onClearSelection={() => {}}
        actions={[APPROVE_ACTION, REJECT_ACTION, EXPORT_ACTION]}
      />
    </div>
  </div>
)

// all-matched 模式（已选全部匹配项）
export const AllMatchedMode = () => (
  <div style={col}>
    <div style={wrap}>
      <SelectionActionBar
        visible
        variant="sticky-bottom"
        selectedCount={128}
        totalMatched={128}
        selectionMode="all-matched"
        onSelectionModeChange={() => {}}
        onClearSelection={() => {}}
        actions={[APPROVE_ACTION, REJECT_ACTION]}
      />
    </div>
  </div>
)

// sticky-top 变体 + 含 disabled action
export const StickyTopWithDisabled = () => (
  <div style={col}>
    <div style={wrap}>
      <SelectionActionBar
        visible
        variant="sticky-top"
        selectedCount={3}
        selectionMode="page"
        onClearSelection={() => {}}
        actions={[EXPORT_ACTION, DELETE_ACTION]}
      />
    </div>
  </div>
)
