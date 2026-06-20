import { ErrorState } from '@resovo/admin-ui'

const col: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 24, padding: 16 }

// 标准错误态：带重试
export const WithRetry = () => (
  <div style={col}>
    <ErrorState
      error={new Error('视频元数据加载超时，请检查网络连接后重试')}
      title="加载失败"
      onRetry={() => {}}
    />
  </div>
)

// 网络 / 鉴权错误
export const AuthError = () => (
  <div style={col}>
    <ErrorState
      error={new Error('HTTP 403 Forbidden — 当前账号无权访问审核管理模块，请联系管理员')}
      title="权限不足"
    />
  </div>
)

// 服务端异常（无重试）
export const ServerError = () => (
  <div style={col}>
    <ErrorState
      error={new Error('Internal Server Error: TMDB 搜索服务暂时不可用（错误码 503），请稍后刷新')}
      title="服务异常"
    />
  </div>
)

// 自定义错误标题 + 重试按钮
export const CustomTitle = () => (
  <div style={col}>
    <ErrorState
      error={new Error('线路健康检测失败：连接 cdn-hk-01.resovo.net 超时（timeout 10 000 ms）')}
      title="线路诊断出错"
      onRetry={() => {}}
    />
  </div>
)
