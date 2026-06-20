import { Segment } from '@resovo/admin-ui'

const col: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 16, padding: 16 }
const label: React.CSSProperties = { fontSize: 'var(--font-size-xs)', color: 'var(--fg-muted)', marginBottom: 4 }

// 标准用法：外部资源 provider 切换（对应 ExternalResourcesClient 真实用法）
export const ProviderSwitch = () => (
  <div style={col}>
    <div style={label}>外部资源 provider 切换（size=lg）</div>
    <Segment
      items={[
        { value: 'douban', label: '豆瓣' },
        { value: 'bangumi', label: 'Bangumi', badge: '待接入' },
        { value: 'imdb', label: 'IMDb', badge: '待接入' },
        { value: 'tmdb', label: 'TMDB', badge: '待接入' },
      ]}
      value="douban"
      onChange={() => {}}
      size="lg"
      aria-label="外部资源 provider"
    />
  </div>
)

// 带数字 badge：投稿分类（对应 TabSimilar 真实用法）
export const WithBadge = () => (
  <div style={col}>
    <div style={label}>投稿/举报分类（带数字 badge，选中项 badge 颜色反转）</div>
    <Segment
      items={[
        { value: 'bad_source', label: '失效源举报', badge: 8 },
        { value: 'wish_list', label: '求片', badge: 3 },
        { value: 'subtitle', label: '字幕投稿', badge: 0 },
      ]}
      value="bad_source"
      onChange={() => {}}
      aria-label="投稿分类"
    />
  </div>
)

// 三种尺寸对比
export const Sizes = () => (
  <div style={col}>
    <div style={label}>sm</div>
    <Segment
      items={[
        { value: 'all', label: '全部' },
        { value: 'active', label: '活跃' },
        { value: 'stale', label: '过期' },
      ]}
      value="all"
      onChange={() => {}}
      size="sm"
    />
    <div style={label}>md（默认）</div>
    <Segment
      items={[
        { value: 'all', label: '全部' },
        { value: 'active', label: '活跃' },
        { value: 'stale', label: '过期' },
      ]}
      value="active"
      onChange={() => {}}
      size="md"
    />
    <div style={label}>lg</div>
    <Segment
      items={[
        { value: 'all', label: '全部' },
        { value: 'active', label: '活跃' },
        { value: 'stale', label: '过期' },
      ]}
      value="stale"
      onChange={() => {}}
      size="lg"
    />
  </div>
)

// 禁用态
export const Disabled = () => (
  <div style={col}>
    <div style={label}>整体禁用（disabled=true）</div>
    <Segment
      items={[
        { value: 'overview', label: '概览' },
        { value: 'records', label: '采集记录' },
        { value: 'search', label: '资源搜索' },
      ]}
      value="overview"
      onChange={() => {}}
      disabled
    />
    <div style={label}>单项禁用（item.disabled）</div>
    <Segment
      items={[
        { value: 'pending', label: '待审核', badge: 12 },
        { value: 'approved', label: '已通过' },
        { value: 'rejected', label: '已拒绝', disabled: true },
      ]}
      value="pending"
      onChange={() => {}}
    />
  </div>
)

// 相似度阈值切换（对应 TabSimilar threshold 真实用法）
export const ThresholdSwitch = () => (
  <div style={col}>
    <div style={label}>相似度阈值（严格 / 普通 / 宽松）</div>
    <Segment
      items={[
        { value: '0.95', label: '严格 95%' },
        { value: '0.85', label: '普通 85%' },
        { value: '0.70', label: '宽松 70%' },
      ]}
      value="0.85"
      onChange={() => {}}
      size="sm"
      aria-label="相似度阈值"
    />
  </div>
)
