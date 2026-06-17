import { BarSignal } from '@resovo/admin-ui'

const row: React.CSSProperties = { display: 'flex', gap: 24, padding: 16, alignItems: 'center', flexWrap: 'wrap' }
const col: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 12, padding: 16 }
const label: React.CSSProperties = { fontSize: 11, color: 'var(--fg-muted)', minWidth: 100 }
const item: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 12 }

// 探测/渲染状态 5×5 代表性组合（主轴：5 种 probeState × 代表 renderState）
export const StateMatrix = () => (
  <div style={col}>
    <div style={item}>
      <span style={label}>ok / ok（全健康）</span>
      <BarSignal probeState="ok" renderState="ok" ariaLabel="探测可用，渲染可用" />
    </div>
    <div style={item}>
      <span style={label}>ok / partial（渲染部分）</span>
      <BarSignal probeState="ok" renderState="partial" ariaLabel="探测可用，渲染部分" />
    </div>
    <div style={item}>
      <span style={label}>partial / dead（严重失效）</span>
      <BarSignal probeState="partial" renderState="dead" ariaLabel="探测部分，渲染失效" />
    </div>
    <div style={item}>
      <span style={label}>dead / dead（全失效）</span>
      <BarSignal probeState="dead" renderState="dead" ariaLabel="探测失效，渲染失效" />
    </div>
    <div style={item}>
      <span style={label}>pending / pending（待测）</span>
      <BarSignal probeState="pending" renderState="pending" ariaLabel="探测待测，渲染待测" />
    </div>
    <div style={item}>
      <span style={label}>unknown / unknown（未知）</span>
      <BarSignal probeState="unknown" renderState="unknown" ariaLabel="探测未知，渲染未知" />
    </div>
    <div style={item}>
      <span style={label}>ok / unknown（信号缺失）</span>
      <BarSignal probeState="ok" renderState="unknown" ariaLabel="探测可用，渲染未知" />
    </div>
    <div style={item}>
      <span style={label}>dead / pending（混合）</span>
      <BarSignal probeState="dead" renderState="pending" ariaLabel="探测失效，渲染待测" />
    </div>
  </div>
)

// 尺寸预设对比：sm vs md
export const Sizes = () => (
  <div style={row}>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
      <span style={label}>sm · 行级紧凑</span>
      <BarSignal probeState="ok" renderState="ok" size="sm" ariaLabel="探测可用，渲染可用（sm）" />
      <BarSignal probeState="ok" renderState="partial" size="sm" ariaLabel="探测可用，渲染部分（sm）" />
      <BarSignal probeState="dead" renderState="dead" size="sm" ariaLabel="探测失效，渲染失效（sm）" />
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
      <span style={label}>md · 默认（详情）</span>
      <BarSignal probeState="ok" renderState="ok" size="md" ariaLabel="探测可用，渲染可用（md）" />
      <BarSignal probeState="ok" renderState="partial" size="md" ariaLabel="探测可用，渲染部分（md）" />
      <BarSignal probeState="dead" renderState="dead" size="md" ariaLabel="探测失效，渲染失效（md）" />
    </div>
  </div>
)

// 可点击态：onClick → 升级为 button（LineHealthDrawer 触发）
export const Clickable = () => (
  <div style={row}>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <span style={label}>可点击 · 打开线路健康抽屉</span>
      <BarSignal
        probeState="ok"
        renderState="partial"
        size="md"
        ariaLabel="探测可用，渲染部分 — 点击查看详情"
        onClick={() => {}}
      />
      <BarSignal
        probeState="dead"
        renderState="dead"
        size="md"
        ariaLabel="全线路失效 — 点击查看详情"
        onClick={() => {}}
      />
    </div>
  </div>
)
