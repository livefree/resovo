import { PageHeader, AdminButton } from '@resovo/admin-ui'

const col: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 24, padding: 16 }
const divider: React.CSSProperties = { borderBottom: '1px solid var(--border-subtle)', paddingBottom: 16 }
const PlusIcon = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M12 5v14M5 12h14" />
  </svg>
)
const RefreshIcon = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
    <path d="M21 3v5h-5" />
    <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
  </svg>
)

// 标准用法：视频库列表页头（标题 + 副标题 + 操作按钮）
export const VideoLibrary = () => (
  <div style={col}>
    <div style={divider}>
      <PageHeader
        title="视频资源库"
        subtitle="共 12,438 条 · 上次同步 2 分钟前"
        actions={
          <>
            <AdminButton variant="default" size="sm" leftIcon={RefreshIcon}>同步元数据</AdminButton>
            <AdminButton variant="primary" size="sm" leftIcon={PlusIcon}>新增资源</AdminButton>
          </>
        }
      />
    </div>
  </div>
)

// 带 Segment 切换的页头（对应 ExternalResourcesClient 真实用法）
export const WithSegmentActions = () => (
  <div style={col}>
    <div style={divider}>
      <PageHeader
        title="外部资源治理"
        subtitle="管理 TMDB / 豆瓣 / Bangumi 等外部元数据源"
        as="header"
        actions={
          <AdminButton variant="primary" size="sm" leftIcon={PlusIcon}>手动触发采集</AdminButton>
        }
      />
    </div>
  </div>
)

// 仅标题（无副标题无操作）
export const TitleOnly = () => (
  <div style={col}>
    <div style={divider}>
      <PageHeader
        title="用户管理"
        headingLevel={1}
      />
    </div>
  </div>
)

// 子区块 headingLevel=2（嵌套在 main 内，避免 nested header）
export const SubSection = () => (
  <div style={col}>
    <div style={divider}>
      <PageHeader
        title="爬虫运行记录"
        subtitle="当前任务：全量重富集 · 进度 68%"
        headingLevel={2}
        as="section"
        actions={
          <AdminButton variant="danger" size="sm">中止任务</AdminButton>
        }
      />
    </div>
  </div>
)

// 审核工作台（ReactNode title：动态状态 pill + 标题复合）
export const ModerationDashboard = () => (
  <div style={col}>
    <div style={divider}>
      <PageHeader
        title={
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 'var(--font-size-lg)', fontWeight: 700, color: 'var(--fg-default)' }}>
            <span>审核工作台</span>
            <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 500, background: 'var(--state-error-fg)', color: '#fff', padding: '2px 8px', borderRadius: 'var(--radius-pill)' }}>
              待处理 23
            </span>
          </span>
        }
        subtitle="处理用户举报、字幕投稿与求片请求"
        actions={
          <>
            <AdminButton variant="default" size="sm">批量处理</AdminButton>
            <AdminButton variant="primary" size="sm">进入工作模式</AdminButton>
          </>
        }
      />
    </div>
  </div>
)
