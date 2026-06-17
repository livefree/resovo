import { EmptyState } from '@resovo/admin-ui'

const col: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 24, padding: 16 }

// 常规空态：待审视频列表为空
export const PendingReview = () => (
  <div style={col}>
    <EmptyState
      illustration="🎬"
      title="暂无待审视频"
      description="当前没有需要人工审核的投稿，可前往「已通过」或「已拒绝」查看历史记录"
      action={{ label: '刷新列表', onClick: () => {} }}
    />
  </div>
)

// 搜索结果为空
export const SearchEmpty = () => (
  <div style={col}>
    <EmptyState
      illustration="🔍"
      title="未找到匹配结果"
      description="尝试修改关键词、放宽筛选条件，或检查番剧名称是否正确"
      action={{ label: '清空筛选', onClick: () => {} }}
    />
  </div>
)

// 无操作按钮的纯提示空态
export const NoAction = () => (
  <div style={col}>
    <EmptyState
      illustration="📭"
      title="暂无历史记录"
      description="系统还没有记录到任何操作日志"
    />
  </div>
)

// 自定义 SVG illustration + 最简用法
export const MinimalSvg = () => (
  <div style={col}>
    <EmptyState
      illustration={
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none" stroke="var(--fg-subtle)" strokeWidth="2">
          <rect x="8" y="8" width="32" height="32" rx="6" />
          <path d="M18 24h12M24 18v12" />
        </svg>
      }
      title="暂无线路配置"
      description="请先为该视频添加至少一条播放线路"
      action={{ label: '添加线路', onClick: () => {} }}
    />
  </div>
)
