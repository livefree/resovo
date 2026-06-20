import { AdminCheckbox } from '@resovo/admin-ui'

const col: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 12, padding: 16 }

// canonical：单个受控 checkbox（带 label）
export const Checked = () => (
  <div style={col}>
    <AdminCheckbox label="开启成人内容过滤" checked onChange={() => {}} />
    <AdminCheckbox label="禁用" checked={false} onChange={() => {}} />
    <AdminCheckbox label="未选中（默认态）" checked={false} onChange={() => {}} />
  </div>
)

// 带副说明（description）
export const WithDescription = () => (
  <div style={col}>
    <AdminCheckbox
      label="自动抓取新剧集"
      description="开启后每日 UTC 02:00 自动扫描并补全缺失剧集"
      checked
      onChange={() => {}}
    />
    <AdminCheckbox
      label="视频代理加速"
      description="通过 CDN 节点转发，需额外配置 PROXY_HOST 环境变量"
      checked={false}
      onChange={() => {}}
    />
    <AdminCheckbox
      label="仅抓取近期更新"
      description="限制爬虫范围为最近 30 天内有更新的资源，节省带宽"
      checked
      onChange={() => {}}
    />
  </div>
)

// 三态 indeterminate（表格全选场景）
export const Indeterminate = () => (
  <div style={col}>
    <AdminCheckbox
      label="全选当页（部分选中）"
      indeterminate
      checked={false}
      onChange={() => {}}
    />
    <AdminCheckbox
      label="全选当页（全部选中）"
      checked
      onChange={() => {}}
    />
    <AdminCheckbox
      label="全选当页（全部取消）"
      checked={false}
      onChange={() => {}}
    />
  </div>
)

// 禁用态
export const Disabled = () => (
  <div style={col}>
    <AdminCheckbox
      label="仅管理员可修改"
      description="此选项需要超级管理员权限"
      checked
      disabled
      onChange={() => {}}
    />
    <AdminCheckbox
      label="已锁定配置项"
      checked={false}
      disabled
      onChange={() => {}}
    />
  </div>
)
