import { AdminButton } from '@resovo/admin-ui'

const row: React.CSSProperties = { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }
const col: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 12, padding: 16 }

const PlusIcon = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M12 5v14M5 12h14" />
  </svg>
)
const ChevronIcon = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="m6 9 6 6 6-6" />
  </svg>
)

// 五种视觉变体（default / secondary / primary / ghost / danger）
export const Variants = () => (
  <div style={col}>
    <div style={row}>
      <AdminButton variant="default">默认</AdminButton>
      <AdminButton variant="secondary">次要</AdminButton>
      <AdminButton variant="primary">保存</AdminButton>
      <AdminButton variant="ghost">取消</AdminButton>
      <AdminButton variant="danger">删除</AdminButton>
    </div>
  </div>
)

// 三种尺寸 sm / md / lg
export const Sizes = () => (
  <div style={col}>
    <div style={row}>
      <AdminButton variant="primary" size="sm">小 (sm)</AdminButton>
      <AdminButton variant="primary" size="md">中 (md)</AdminButton>
      <AdminButton variant="primary" size="lg">大 (lg)</AdminButton>
    </div>
  </div>
)

// 图标按钮（leftIcon / rightIcon 由消费方注入 ReactNode）
export const WithIcons = () => (
  <div style={col}>
    <div style={row}>
      <AdminButton variant="primary" leftIcon={PlusIcon}>新建条目</AdminButton>
      <AdminButton variant="default" rightIcon={ChevronIcon}>更多操作</AdminButton>
      <AdminButton variant="ghost" leftIcon={PlusIcon} />
    </div>
  </div>
)

// 加载与禁用态
export const States = () => (
  <div style={col}>
    <div style={row}>
      <AdminButton variant="primary" loading>提交中</AdminButton>
      <AdminButton variant="default" disabled>不可用</AdminButton>
      <AdminButton variant="danger" loading>删除中</AdminButton>
    </div>
  </div>
)
