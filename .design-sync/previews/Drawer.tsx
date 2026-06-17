import { Drawer, AdminButton, AdminInput } from '@resovo/admin-ui'

const col: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 16, padding: 16 }
const field: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 6 }
const label: React.CSSProperties = { fontSize: 'var(--font-size-xs)', fontWeight: 500, color: 'var(--fg-muted)' }
const row: React.CSSProperties = { display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 8, borderTop: '1px solid var(--border-subtle)', marginTop: 8 }

// 右侧抽屉 — 新建 Banner（open=true，受控打开态）
export const RightDrawerBanner = () => (
  <Drawer
    open={true}
    placement="right"
    onClose={() => {}}
    title="新建 Banner"
    width={440}
    data-testid="preview-banner-drawer"
  >
    <div style={col}>
      <div style={field}>
        <span style={label}>标题（中文）</span>
        <AdminInput value="夏日限定特辑" onChange={() => {}} placeholder="请输入 Banner 标题" />
      </div>
      <div style={field}>
        <span style={label}>标题（英文）</span>
        <AdminInput value="Summer Special" onChange={() => {}} placeholder="Banner title (English)" />
      </div>
      <div style={field}>
        <span style={label}>跳转链接</span>
        <AdminInput value="https://resovo.app/series/summer-special" onChange={() => {}} />
      </div>
      <div style={row}>
        <AdminButton variant="ghost" size="sm">取消</AdminButton>
        <AdminButton variant="primary" size="sm">保存</AdminButton>
      </div>
    </div>
  </Drawer>
)

// 右侧抽屉 — 编辑线路信息（带 noPadding=false 默认）
export const RightDrawerLineEdit = () => (
  <Drawer
    open={true}
    placement="right"
    onClose={() => {}}
    title="编辑线路 — cdn-hk-01"
    width={400}
  >
    <div style={col}>
      <div style={field}>
        <span style={label}>线路名称</span>
        <AdminInput value="cdn-hk-01.resovo.net" onChange={() => {}} />
      </div>
      <div style={field}>
        <span style={label}>优先级</span>
        <AdminInput value="1" onChange={() => {}} type="number" />
      </div>
      <div style={field}>
        <span style={label}>区域</span>
        <AdminInput value="香港 / 东亚" onChange={() => {}} />
      </div>
      <div style={row}>
        <AdminButton variant="ghost" size="sm">取消</AdminButton>
        <AdminButton variant="primary" size="sm">保存更改</AdminButton>
      </div>
    </div>
  </Drawer>
)

// 底部抽屉 — 批量操作面板
export const BottomDrawer = () => (
  <Drawer
    open={true}
    placement="bottom"
    onClose={() => {}}
    title="批量操作 — 已选 12 个视频"
    height="40vh"
  >
    <div style={{ display: 'flex', gap: 12, padding: '8px 0', flexWrap: 'wrap' }}>
      <AdminButton variant="secondary" size="sm">批量通过</AdminButton>
      <AdminButton variant="secondary" size="sm">批量拒绝</AdminButton>
      <AdminButton variant="danger" size="sm">批量删除</AdminButton>
      <AdminButton variant="ghost" size="sm">导出选中</AdminButton>
    </div>
  </Drawer>
)
