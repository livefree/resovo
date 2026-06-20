import { DecisionCard } from '@resovo/admin-ui'

const page: React.CSSProperties = { padding: 20, maxWidth: 480 }

// 决策建议 3 态：ok / warn / danger（由 probeState+renderState 推算）
export const ToneOk = () => (
  <div style={page}>
    <DecisionCard
      video={{
        id: 'vid-001',
        title: '孤注一掷',
        reviewStatus: 'approved',
        visibilityStatus: 'public',
        isPublished: true,
        staffNote: null,
        reviewLabelKey: null,
        sourceCheckStatus: 'ok',
        doubanStatus: 'matched',
      }}
      probeState="ok"
      renderState="ok"
    />
  </div>
)

export const ToneWarn = () => (
  <div style={page}>
    <DecisionCard
      video={{
        id: 'vid-002',
        title: '繁花（2023）',
        reviewStatus: 'pending_review',
        visibilityStatus: 'internal',
        isPublished: false,
        staffNote: '部分线路响应慢，需等 worker 重探',
        reviewLabelKey: null,
        sourceCheckStatus: 'partial',
        doubanStatus: 'matched',
      }}
      probeState="ok"
      renderState="partial"
      onStaffNoteEdit={() => {}}
    />
  </div>
)

export const ToneDanger = () => (
  <div style={page}>
    <DecisionCard
      video={{
        id: 'vid-003',
        title: '扫黑风暴',
        reviewStatus: 'pending_review',
        visibilityStatus: 'hidden',
        isPublished: false,
        staffNote: '所有源全部 dead，建议直接拒绝',
        reviewLabelKey: 'low_quality',
        sourceCheckStatus: 'all_dead',
        doubanStatus: 'unmatched',
      }}
      probeState="dead"
      renderState="dead"
      onStaffNoteEdit={() => {}}
      actions={
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid var(--state-error-border)', background: 'var(--state-error-bg)', color: 'var(--state-error-fg)', cursor: 'pointer' }}>
            拒绝发布
          </button>
          <button type="button" style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid var(--border-default)', background: 'transparent', color: 'var(--fg-muted)', cursor: 'pointer' }}>
            稍后处理
          </button>
        </div>
      }
    />
  </div>
)

// 带 header slot + actions slot 的完整卡片
export const WithHeaderAndActions = () => (
  <div style={page}>
    <DecisionCard
      video={{
        id: 'vid-004',
        title: '狂飙（2023）',
        reviewStatus: 'pending_review',
        visibilityStatus: 'internal',
        isPublished: false,
        staffNote: null,
        reviewLabelKey: null,
        sourceCheckStatus: 'ok',
        doubanStatus: 'matched',
      }}
      probeState="ok"
      renderState="ok"
      header={
        <div style={{ fontSize: 12, color: 'var(--fg-muted)' }}>
          审核队列 › 待审 › 国产剧
        </div>
      }
      actions={
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid var(--state-success-border)', background: 'var(--state-success-bg)', color: 'var(--state-success-fg)', cursor: 'pointer' }}>
            通过
          </button>
          <button type="button" style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid var(--state-error-border)', background: 'var(--state-error-bg)', color: 'var(--state-error-fg)', cursor: 'pointer' }}>
            拒绝
          </button>
          <button type="button" style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid var(--border-default)', background: 'transparent', color: 'var(--fg-muted)', cursor: 'pointer' }}>
            暂存
          </button>
        </div>
      }
    />
  </div>
)

// 信号冲突态（warn — probeState !== renderState）
export const SignalConflict = () => (
  <div style={page}>
    <DecisionCard
      video={{
        id: 'vid-005',
        title: '乔家的儿女（2021）',
        reviewStatus: 'pending_review',
        visibilityStatus: 'internal',
        isPublished: false,
        staffNote: null,
        reviewLabelKey: null,
        sourceCheckStatus: 'partial',
        doubanStatus: 'matched',
      }}
      probeState="ok"
      renderState="dead"
    />
  </div>
)
