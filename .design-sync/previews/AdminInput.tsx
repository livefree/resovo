import { AdminInput } from '@resovo/admin-ui'

const col: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 12, padding: 16, maxWidth: 320 }
const labelStyle: React.CSSProperties = { fontSize: 12, color: 'var(--fg-muted)', marginBottom: 2 }
const field = (label: string, node: React.ReactNode) => (
  <label style={{ display: 'block' }}>
    <span style={labelStyle}>{label}</span>
    {node}
  </label>
)

const SearchIcon = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <circle cx="11" cy="11" r="7" />
    <path d="m21 21-4.3-4.3" />
  </svg>
)

// 默认 / 错误 / 禁用三态
export const States = () => (
  <div style={col}>
    {field('默认', <AdminInput placeholder="请输入标题…" defaultValue="星际穿越" />)}
    {field('错误态', <AdminInput error defaultValue="非法 UUID" placeholder="条目 ID" />)}
    {field('禁用', <AdminInput disabled defaultValue="不可编辑" />)}
  </div>
)

// 三种尺寸
export const Sizes = () => (
  <div style={col}>
    {field('小 (sm)', <AdminInput size="sm" placeholder="sm" defaultValue="紧凑行内输入" />)}
    {field('中 (md)', <AdminInput size="md" placeholder="md" defaultValue="标准表单输入" />)}
    {field('大 (lg)', <AdminInput size="lg" placeholder="lg" defaultValue="大号强调输入" />)}
  </div>
)

// 前缀 / 后缀装饰
export const Affixes = () => (
  <div style={col}>
    {field('搜索（prefix 图标）', <AdminInput prefix={SearchIcon} placeholder="搜索视频 / 番剧 / 任务" />)}
    {field('货币（prefix + suffix）', <AdminInput type="number" prefix="¥" suffix="元" defaultValue="128" />)}
    {field('百分比（suffix）', <AdminInput type="number" suffix="%" defaultValue="98.7" />)}
  </div>
)
