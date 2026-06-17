import { DualSignal } from '@resovo/admin-ui'

const col: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 12, padding: 16 }
const row: React.CSSProperties = { display: 'flex', gap: 24, padding: 16, alignItems: 'flex-start', flexWrap: 'wrap' }
const item: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 12 }
const label: React.CSSProperties = { fontSize: 11, color: 'var(--fg-muted)', minWidth: 140 }

// 5 种代表性状态组合（覆盖常见线路健康情形）
export const StatusCombinations = () => (
  <div style={col}>
    <div style={item}>
      <span style={label}>ok / ok — 全健康</span>
      <DualSignal probe="ok" render="ok" />
    </div>
    <div style={item}>
      <span style={label}>ok / partial — 渲染部分</span>
      <DualSignal probe="ok" render="partial" />
    </div>
    <div style={item}>
      <span style={label}>partial / dead — 重度失效</span>
      <DualSignal probe="partial" render="dead" />
    </div>
    <div style={item}>
      <span style={label}>dead / dead — 全失效</span>
      <DualSignal probe="dead" render="dead" />
    </div>
    <div style={item}>
      <span style={label}>pending / pending — 待测</span>
      <DualSignal probe="pending" render="pending" />
    </div>
    <div style={item}>
      <span style={label}>unknown / unknown — 未知</span>
      <DualSignal probe="unknown" render="unknown" />
    </div>
    <div style={item}>
      <span style={label}>ok / unknown — 渲染信号缺失</span>
      <DualSignal probe="ok" render="unknown" />
    </div>
    <div style={item}>
      <span style={label}>dead / pending — 探失效渲等测</span>
      <DualSignal probe="dead" render="pending" />
    </div>
  </div>
)

// 多视频行级使用（模拟表格列场景）
export const TableColumn = () => (
  <div style={{ padding: 16 }}>
    <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: '8px 16px', alignItems: 'center' }}>
      <span style={{ fontSize: 13, color: 'var(--fg-default)' }}>孤注一掷</span>
      <DualSignal probe="ok" render="ok" />
      <span style={{ fontSize: 13, color: 'var(--fg-default)' }}>繁花（2023）</span>
      <DualSignal probe="ok" render="partial" />
      <span style={{ fontSize: 13, color: 'var(--fg-default)' }}>扫黑风暴</span>
      <DualSignal probe="dead" render="dead" />
      <span style={{ fontSize: 13, color: 'var(--fg-default)' }}>漫长的季节</span>
      <DualSignal probe="pending" render="pending" />
      <span style={{ fontSize: 13, color: 'var(--fg-default)' }}>狂飙（2023）</span>
      <DualSignal probe="partial" render="ok" />
    </div>
  </div>
)

// minPillWidth 扩展点
export const MinWidthOverride = () => (
  <div style={row}>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={label}>默认 minWidth 62px</span>
      <DualSignal probe="ok" render="partial" />
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={label}>扩展 minWidth 90px</span>
      <DualSignal probe="ok" render="partial" minPillWidth={90} />
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={label}>紧凑 minWidth 48px</span>
      <DualSignal probe="ok" render="partial" minPillWidth={48} />
    </div>
  </div>
)
