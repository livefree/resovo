import { InlineRowActions } from '@resovo/admin-ui'

const col: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 20, padding: 16 }
const sectionLabel: React.CSSProperties = { fontSize: 'var(--font-size-xs)', color: 'var(--fg-muted)', marginBottom: 6 }

// 视频库标杆：5 操作按钮（查看/编辑/可见性/审核/上架），alwaysVisible=true 展示
export const VideoLibraryActions = () => (
  <div style={col}>
    <div style={sectionLabel}>视频库行操作（reference §6.1 标杆 5 按钮，alwaysVisible=true 展示）</div>
    <InlineRowActions
      alwaysVisible
      actions={[
        { key: 'view', children: '查看', onClick: () => {}, title: '查看详情' },
        { key: 'edit', children: '编辑', onClick: () => {}, title: '编辑元数据' },
        { key: 'visibility', children: '可见性', onClick: () => {}, title: '切换可见性' },
        { key: 'audit', children: '送审', onClick: () => {}, title: '提交审核' },
        { key: 'publish', children: '上架', onClick: () => {}, title: '上架发布', primary: true },
      ]}
    />
  </div>
)

// danger 操作 + disabled 状态
export const WithDangerAndDisabled = () => (
  <div style={col}>
    <div style={sectionLabel}>含 danger 操作 + disabled 态（编辑/删除/拒绝组合）</div>
    <InlineRowActions
      alwaysVisible
      actions={[
        { key: 'edit', children: '编辑', onClick: () => {}, title: '编辑' },
        { key: 'preview', children: '预览', onClick: () => {}, title: '前台预览', disabled: true },
        { key: 'reject', children: '拒绝', onClick: () => {}, title: '拒绝审核', danger: true },
      ]}
    />
  </div>
)

// 源管理：补源/重探/下线 三按钮
export const SourceActions = () => (
  <div style={col}>
    <div style={sectionLabel}>源管理操作（补源 / 重探 / 下线）</div>
    <InlineRowActions
      alwaysVisible
      actions={[
        { key: 'add-source', children: '补源', onClick: () => {}, title: '补充线路源' },
        { key: 'reprobe', children: '重探', onClick: () => {}, title: '重新探测源', primary: true },
        { key: 'offline', children: '下线', onClick: () => {}, title: '下线源', danger: true },
      ]}
    />
  </div>
)

// 审核模块：通过/驳回/标记 三按钮
export const ModerationActions = () => (
  <div style={col}>
    <div style={sectionLabel}>审核行操作（通过 / 驳回 / 标记举报）</div>
    <InlineRowActions
      alwaysVisible
      actions={[
        { key: 'approve', children: '通过', onClick: () => {}, title: '审核通过', primary: true },
        { key: 'reject', children: '驳回', onClick: () => {}, title: '驳回审核', danger: true },
        { key: 'flag', children: '标记', onClick: () => {}, title: '标记为举报' },
      ]}
      ariaLabel="审核行操作"
    />
  </div>
)
