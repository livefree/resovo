import { SignalChip } from '@resovo/admin-ui'

const col: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 10, padding: 16 }
const item: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 10 }
const label: React.CSSProperties = { fontSize: 11, color: 'var(--fg-muted)', minWidth: 160 }

// probe × 5 状态（主轴 1）
export const ProbeStates = () => (
  <div style={col}>
    <div style={item}>
      <span style={label}>probe · ok</span>
      <SignalChip state="ok" variant="probe" />
    </div>
    <div style={item}>
      <span style={label}>probe · partial</span>
      <SignalChip state="partial" variant="probe" />
    </div>
    <div style={item}>
      <span style={label}>probe · dead</span>
      <SignalChip state="dead" variant="probe" />
    </div>
    <div style={item}>
      <span style={label}>probe · pending</span>
      <SignalChip state="pending" variant="probe" />
    </div>
    <div style={item}>
      <span style={label}>probe · unknown</span>
      <SignalChip state="unknown" variant="probe" />
    </div>
  </div>
)

// render × 5 状态（主轴 2）
export const RenderStates = () => (
  <div style={col}>
    <div style={item}>
      <span style={label}>render · ok</span>
      <SignalChip state="ok" variant="render" />
    </div>
    <div style={item}>
      <span style={label}>render · partial</span>
      <SignalChip state="partial" variant="render" />
    </div>
    <div style={item}>
      <span style={label}>render · dead</span>
      <SignalChip state="dead" variant="render" />
    </div>
    <div style={item}>
      <span style={label}>render · pending</span>
      <SignalChip state="pending" variant="render" />
    </div>
    <div style={item}>
      <span style={label}>render · unknown</span>
      <SignalChip state="unknown" variant="render" />
    </div>
  </div>
)

// 尺寸 xs vs sm + 自定义 label
export const SizeAndLabel = () => (
  <div style={col}>
    <div style={item}>
      <span style={label}>xs（默认）probe ok</span>
      <SignalChip state="ok" variant="probe" size="xs" />
    </div>
    <div style={item}>
      <span style={label}>sm probe ok</span>
      <SignalChip state="ok" variant="probe" size="sm" />
    </div>
    <div style={item}>
      <span style={label}>xs render dead</span>
      <SignalChip state="dead" variant="render" size="xs" />
    </div>
    <div style={item}>
      <span style={label}>sm render dead</span>
      <SignalChip state="dead" variant="render" size="sm" />
    </div>
    <div style={item}>
      <span style={label}>自定义 label（探 Level1）</span>
      <SignalChip state="ok" variant="probe" label="探 Level1" />
    </div>
    <div style={item}>
      <span style={label}>自定义 label（播 CDN）</span>
      <SignalChip state="partial" variant="render" label="播 CDN" />
    </div>
  </div>
)
