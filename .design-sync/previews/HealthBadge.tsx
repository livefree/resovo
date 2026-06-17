import { HealthBadge } from '@resovo/admin-ui'

const col: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 16, padding: 16 }
const topbarMock: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  padding: '0 16px',
  height: 48,
  background: 'var(--surface-overlay)',
  borderBottom: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-md)',
  gap: 16,
}
const sectionLabel: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 600,
  color: 'var(--fg-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
}

// 全绿（系统健康，采集活跃）
export const AllOk = () => (
  <div style={col}>
    <span style={sectionLabel}>全部正常 — 采集活跃 / 失效率低 / 待审少</span>
    <div style={topbarMock}>
      <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--fg-default)' }}>Resovo 运营后台</span>
      <span style={{ flex: 1 }} />
      <HealthBadge
        snapshot={{
          crawler: { running: 12, total: 15, status: 'ok' },
          invalidRate: { rate: 0.008, status: 'ok' },
          moderationPending: { count: 3, status: 'ok' },
        }}
      />
    </div>
  </div>
)

// 警告态（采集部分停止 / 失效率偏高）
export const WarnState = () => (
  <div style={col}>
    <span style={sectionLabel}>警告 — 采集部分停止 / 失效率偏高</span>
    <div style={topbarMock}>
      <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--fg-default)' }}>Resovo 运营后台</span>
      <span style={{ flex: 1 }} />
      <HealthBadge
        snapshot={{
          crawler: { running: 5, total: 15, status: 'warn' },
          invalidRate: { rate: 0.073, status: 'warn' },
          moderationPending: { count: 47, status: 'ok' },
        }}
      />
    </div>
  </div>
)

// 危险态（采集全停 / 失效率高 / 待审积压）
export const DangerState = () => (
  <div style={col}>
    <span style={sectionLabel}>危险 — 采集全停 / 失效率异常 / 待审积压</span>
    <div style={topbarMock}>
      <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--fg-default)' }}>Resovo 运营后台</span>
      <span style={{ flex: 1 }} />
      <HealthBadge
        snapshot={{
          crawler: { running: 0, total: 15, status: 'danger' },
          invalidRate: { rate: 0.312, status: 'danger' },
          moderationPending: { count: 218, status: 'danger' },
        }}
      />
    </div>
  </div>
)

// 混合态（裸组件，不套 topbar）
export const MixedInline = () => (
  <div style={col}>
    <span style={sectionLabel}>混合态 — 裸组件展示（采集 warn / 其余 ok）</span>
    <HealthBadge
      snapshot={{
        crawler: { running: 8, total: 15, status: 'warn' },
        invalidRate: { rate: 0.021, status: 'ok' },
        moderationPending: { count: 12, status: 'ok' },
      }}
    />
    <span style={sectionLabel}>混合态 — 待审危险 / 其余正常</span>
    <HealthBadge
      snapshot={{
        crawler: { running: 15, total: 15, status: 'ok' },
        invalidRate: { rate: 0.005, status: 'ok' },
        moderationPending: { count: 183, status: 'danger' },
      }}
    />
  </div>
)
