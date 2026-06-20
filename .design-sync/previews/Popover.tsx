import { Popover, AdminButton, AdminSelect } from '@resovo/admin-ui'

const col: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 16, padding: 16 }
const row: React.CSSProperties = { display: 'flex', gap: 8, alignItems: 'flex-start' }
const panel: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
  width: 220,
  padding: 12,
  fontSize: 'var(--font-size-xs)',
  color: 'var(--fg-default)',
}
const panelTitle: React.CSSProperties = { fontWeight: 600, marginBottom: 4 }
const footer: React.CSSProperties = { display: 'flex', justifyContent: 'flex-end', gap: 6, marginTop: 4 }
const infoPanel: React.CSSProperties = {
  width: 260,
  padding: 12,
  fontSize: 'var(--font-size-xs)',
  color: 'var(--fg-default)',
  lineHeight: 1.6,
}
const filterPanel: React.CSSProperties = {
  width: 300,
  padding: '10px 14px',
  fontSize: 'var(--font-size-xs)',
  color: 'var(--fg-default)',
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
}
const filterRow: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between' }

// 受控开启：角色变更弹层（对应 UserRolePopover 真实用法）
export const RoleChangeOpen = () => (
  <div style={col}>
    <div style={row}>
      <Popover
        open={true}
        onOpenChange={() => {}}
        placement="bottom-end"
        trigger={<AdminButton variant="default" size="sm">变更角色</AdminButton>}
        content={
          <div style={panel}>
            <div style={panelTitle}>变更角色</div>
            <AdminSelect
              options={[
                { value: 'user', label: '用户' },
                { value: 'moderator', label: '版主' },
              ]}
              value="user"
              onChange={() => {}}
              size="sm"
            />
            <div style={footer}>
              <AdminButton variant="default" size="sm">取消</AdminButton>
              <AdminButton variant="primary" size="sm" disabled>确认</AdminButton>
            </div>
          </div>
        }
      />
    </div>
  </div>
)

// 受控开启：字幕拒绝弹层（对应 SubmissionRejectPopover 用法）
export const RejectReasonOpen = () => (
  <div style={col}>
    <div style={row}>
      <Popover
        open={true}
        onOpenChange={() => {}}
        placement="bottom-start"
        trigger={<AdminButton variant="danger" size="sm">拒绝</AdminButton>}
        content={
          <div style={panel}>
            <div style={panelTitle}>拒绝原因</div>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--fg-muted)' }}>
              请填写拒绝该字幕的原因，提交人将收到通知。
            </div>
            <div style={footer}>
              <AdminButton variant="default" size="sm">取消</AdminButton>
              <AdminButton variant="danger" size="sm">确认拒绝</AdminButton>
            </div>
          </div>
        }
      />
    </div>
  </div>
)

// 非受控：视频元数据信息提示（hover/click 查看详情）
export const InfoTooltipDefault = () => (
  <div style={col}>
    <div style={row}>
      <Popover
        defaultOpen={false}
        placement="bottom-start"
        trigger={<AdminButton variant="ghost" size="sm">查看元数据来源</AdminButton>}
        content={
          <div style={infoPanel}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>元数据来源</div>
            <div style={{ color: 'var(--fg-muted)' }}>主源：TMDB（置信度 92%）</div>
            <div style={{ color: 'var(--fg-muted)' }}>备源：豆瓣（置信度 78%）</div>
            <div style={{ color: 'var(--fg-muted)', marginTop: 4 }}>最后同步：2026-06-15 14:32</div>
          </div>
        }
      />
    </div>
  </div>
)

// 受控开启：筛选预设面板（对应 FilterPresetPopover 真实用法）
export const FilterPresetOpen = () => (
  <div style={col}>
    <div style={row}>
      <Popover
        open={true}
        onOpenChange={() => {}}
        placement="bottom-end"
        trigger={<AdminButton variant="secondary" size="sm">预设筛选</AdminButton>}
        content={
          <div style={filterPanel}>
            <div style={{ fontWeight: 600, fontSize: 'var(--font-size-xs)' }}>筛选预设</div>
            {[
              { name: '待审核番剧', desc: '类型=番剧 · 状态=待审' },
              { name: '高优先级举报', desc: '优先级=高 · 未处理' },
              { name: '本周新增源', desc: '创建时间=本周' },
            ].map((p, i) => (
              <div key={i} style={filterRow}>
                <div>
                  <div style={{ fontWeight: 500 }}>{p.name}</div>
                  <div style={{ color: 'var(--fg-muted)', fontSize: 'var(--font-size-xxs)', marginTop: 1 }}>{p.desc}</div>
                </div>
                <AdminButton variant="ghost" size="sm">应用</AdminButton>
              </div>
            ))}
            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 8, marginTop: 4 }}>
              <AdminButton variant="ghost" size="sm">+ 保存当前筛选为预设</AdminButton>
            </div>
          </div>
        }
      />
    </div>
  </div>
)
