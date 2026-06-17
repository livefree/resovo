import { KpiCard, Spark } from '@resovo/admin-ui'

const grid4: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(4, 1fr)',
  gap: 12,
  padding: 16,
}
const row: React.CSSProperties = { display: 'flex', gap: 12, padding: 16, flexWrap: 'wrap' }
const cell: React.CSSProperties = { width: 200 }

// reference §5.1.2 后台仪表盘 4 张 KPI（variant × delta.direction 两维组合）
export const Dashboard = () => (
  <div style={grid4}>
    <KpiCard
      label="视频总量"
      value="695"
      variant="default"
      delta={{ text: '↑ +47 今日', direction: 'up' }}
      spark={<Spark data={[12, 18, 15, 22, 28, 25, 34]} color="var(--accent-default)" variant="area" />}
    />
    <KpiCard
      label="待审 / 暂存"
      value="484 / 23"
      variant="is-warn"
      delta={{ text: '较昨日 +18', direction: 'flat' }}
      spark={<Spark data={[40, 38, 44, 41, 47, 46, 48]} color="var(--state-warning-fg)" variant="line" />}
    />
    <KpiCard
      label="源可达率"
      value="98.7%"
      variant="is-ok"
      delta={{ text: '↑ 0.3pt 7d', direction: 'up' }}
      spark={<Spark data={[97, 98, 97, 99, 98, 99, 99]} color="var(--state-success-fg)" variant="line" />}
    />
    <KpiCard
      label="失效源"
      value="1,939"
      variant="is-danger"
      delta={{ text: '↓ -28 较昨日', direction: 'down' }}
      spark={<Spark data={[60, 55, 58, 50, 45, 42, 39]} color="var(--state-error-fg)" variant="area" />}
    />
  </div>
)

// 四种状态变体 + progress slot
export const Variants = () => (
  <div style={row}>
    <div style={cell}>
      <KpiCard label="中性卡" value="1,024" variant="default" delta={{ text: '↑ +12', direction: 'up' }} />
    </div>
    <div style={cell}>
      <KpiCard label="进度" value="320 / 500" variant="default" progress={{ value: 320, total: 500, showLabel: true }} />
    </div>
    <div style={cell}>
      <KpiCard label="告警" value="42" variant="is-warn" delta={{ text: '持平', direction: 'flat' }} />
    </div>
    <div style={cell}>
      <KpiCard label="异常" value="7" variant="is-danger" delta={{ text: '↓ -3', direction: 'down' }} />
    </div>
  </div>
)
