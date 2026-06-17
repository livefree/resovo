import { LoadingState } from '@resovo/admin-ui'

const col: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 24, padding: 16 }
const box: React.CSSProperties = { border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }

// spinner 默认（无 label）
export const Spinner = () => (
  <div style={col}>
    <LoadingState variant="spinner" />
  </div>
)

// spinner + label 提示文案
export const SpinnerWithLabel = () => (
  <div style={col}>
    <LoadingState variant="spinner" label="正在拉取番剧元数据…" />
  </div>
)

// skeleton 默认 5 行（DataTable body 内常见用法）
export const Skeleton = () => (
  <div style={col}>
    <div style={box}>
      <LoadingState variant="skeleton" />
    </div>
  </div>
)

// skeleton 自定义行数（3 行短列表）
export const SkeletonShort = () => (
  <div style={col}>
    <div style={box}>
      <LoadingState variant="skeleton" skeletonRows={3} />
    </div>
  </div>
)

// skeleton 长列表（8 行）
export const SkeletonTall = () => (
  <div style={col}>
    <div style={box}>
      <LoadingState variant="skeleton" skeletonRows={8} />
    </div>
  </div>
)
