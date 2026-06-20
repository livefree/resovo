import { VisChip } from '@resovo/admin-ui'

const col: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 10, padding: 16 }
const item: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 10 }
const label: React.CSSProperties = { fontSize: 11, color: 'var(--fg-muted)', minWidth: 200 }

// 5 个派生分支全覆盖（按优先级）
export const AllDerivedStates = () => (
  <div style={col}>
    <div style={item}>
      <span style={label}>rejected（优先 1）→ 已拒 danger</span>
      <VisChip visibility="public" review="rejected" />
    </div>
    <div style={item}>
      <span style={label}>pending_review（优先 2）→ 待审 warn</span>
      <VisChip visibility="public" review="pending_review" />
    </div>
    <div style={item}>
      <span style={label}>public + approved（优先 3）→ 前台可见 ok</span>
      <VisChip visibility="public" review="approved" />
    </div>
    <div style={item}>
      <span style={label}>internal + approved（优先 4）→ 仅内部 neutral</span>
      <VisChip visibility="internal" review="approved" />
    </div>
    <div style={item}>
      <span style={label}>hidden + approved（优先 5）→ 隐藏 danger</span>
      <VisChip visibility="hidden" review="approved" />
    </div>
  </div>
)

// 交叉矩阵（visibility × review 常见组合）
export const CrossMatrix = () => (
  <div style={{ padding: 16 }}>
    <div style={{ display: 'grid', gridTemplateColumns: '220px auto auto auto', gap: '8px 12px', alignItems: 'center' }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--fg-muted)' }}>visibility / review</span>
      <span style={{ fontSize: 11, color: 'var(--fg-muted)' }}>approved</span>
      <span style={{ fontSize: 11, color: 'var(--fg-muted)' }}>pending_review</span>
      <span style={{ fontSize: 11, color: 'var(--fg-muted)' }}>rejected</span>

      <span style={{ fontSize: 12, color: 'var(--fg-default)' }}>public</span>
      <VisChip visibility="public" review="approved" />
      <VisChip visibility="public" review="pending_review" />
      <VisChip visibility="public" review="rejected" />

      <span style={{ fontSize: 12, color: 'var(--fg-default)' }}>internal</span>
      <VisChip visibility="internal" review="approved" />
      <VisChip visibility="internal" review="pending_review" />
      <VisChip visibility="internal" review="rejected" />

      <span style={{ fontSize: 12, color: 'var(--fg-default)' }}>hidden</span>
      <VisChip visibility="hidden" review="approved" />
      <VisChip visibility="hidden" review="pending_review" />
      <VisChip visibility="hidden" review="rejected" />
    </div>
  </div>
)

// 表格行级模拟（视频库视觉场景）
export const VideoListContext = () => (
  <div style={{ padding: 16 }}>
    <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: '8px 16px', alignItems: 'center' }}>
      <span style={{ fontSize: 13 }}>孤注一掷</span>
      <VisChip visibility="public" review="approved" />
      <span style={{ fontSize: 13 }}>繁花（2023）</span>
      <VisChip visibility="internal" review="pending_review" />
      <span style={{ fontSize: 13 }}>扫黑风暴</span>
      <VisChip visibility="hidden" review="rejected" />
      <span style={{ fontSize: 13 }}>狂飙（2023）</span>
      <VisChip visibility="public" review="pending_review" />
      <span style={{ fontSize: 13 }}>漫长的季节</span>
      <VisChip visibility="hidden" review="approved" />
    </div>
  </div>
)
