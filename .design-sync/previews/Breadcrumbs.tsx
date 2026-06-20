import { Breadcrumbs } from '@resovo/admin-ui'

const col: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 16, padding: 16 }
const label: React.CSSProperties = { fontSize: 'var(--font-size-xs)', color: 'var(--fg-muted)', marginBottom: 2 }

// 标准两段：顶级分区 + 当前页（最常见用法，对应 inferBreadcrumbs 返回值）
export const TwoLevel = () => (
  <div style={col}>
    <div style={label}>内容管理 › 视频资源库（最后项加粗 active）</div>
    <Breadcrumbs
      items={[
        { label: '内容管理', href: '/admin/content' },
        { label: '视频资源库' },
      ]}
      onItemClick={() => {}}
    />
  </div>
)

// 三段：分区 + 父页 + 当前子页（children 路由场景）
export const ThreeLevel = () => (
  <div style={col}>
    <div style={label}>系统设置 › 爬虫管理 › 运行记录 #1042</div>
    <Breadcrumbs
      items={[
        { label: '系统设置', href: '/admin/settings' },
        { label: '爬虫管理', href: '/admin/crawler' },
        { label: '运行记录 #1042' },
      ]}
      onItemClick={() => {}}
    />
  </div>
)

// 无 href（纯文本，不可点击），onItemClick 省略
export const NoLinks = () => (
  <div style={col}>
    <div style={label}>纯文本面包屑（无 href，不可点击）</div>
    <Breadcrumbs
      items={[
        { label: '用户管理' },
        { label: '用户详情' },
      ]}
    />
  </div>
)

// 单项（当前页即顶级）
export const SingleItem = () => (
  <div style={col}>
    <div style={label}>单项（首页仪表板）</div>
    <Breadcrumbs
      items={[{ label: '仪表板' }]}
    />
  </div>
)

// 审核工作台嵌套路径
export const ModerationPath = () => (
  <div style={col}>
    <div style={label}>内容管理 › 审核工作台 › 举报详情</div>
    <Breadcrumbs
      items={[
        { label: '内容管理', href: '/admin/content' },
        { label: '审核工作台', href: '/admin/moderation' },
        { label: '举报详情 #8821' },
      ]}
      onItemClick={() => {}}
    />
  </div>
)
