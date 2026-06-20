import { IdRef } from '@resovo/admin-ui'

const col: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 12, padding: 16 }
const row: React.CSSProperties = { display: 'flex', gap: 16, padding: 16, flexWrap: 'wrap', alignItems: 'baseline' }
const sectionLabel: React.CSSProperties = { fontSize: 'var(--font-size-xs)', color: 'var(--fg-muted)', marginBottom: 4 }
const divider: React.CSSProperties = { borderBottom: '1px solid var(--border-subtle)', margin: '4px 0' }

// 标准用法：视频/源/评论 三类实体 ID（8 字符截断，默认）
export const EntityIds = () => (
  <div style={col}>
    <div style={sectionLabel}>视频/源/评论 实体 ID（idShortChars=8 默认截断）</div>
    <IdRef kind="video" id="a1b2c3d4e5f6789012345678" />
    <div style={divider} />
    <IdRef kind="source" id="b3c4d5e6f7a8901234567890" />
    <div style={divider} />
    <IdRef kind="comment" id="c5d6e7f8a9b0123456789012" />
  </div>
)

// 审核模块真实用法（AuditColumns targetKind + targetId）
export const AuditTargets = () => (
  <div style={col}>
    <div style={sectionLabel}>审核目标引用（AuditColumns 真实用法）</div>
    <div style={row}>
      <IdRef kind="video" id="d4e5f6a7b8c9012345678901" />
      <IdRef kind="episode" id="e5f6a7b8c9d0123456789012" />
      <IdRef kind="source" id="f6a7b8c9d0e1234567890123" />
      <IdRef kind="comment" id={null as unknown as string} batchFallback="批量" />
    </div>
  </div>
)

// id 截断长度变体：全显 / 4字 / 12字
export const ShortCharsVariants = () => (
  <div style={col}>
    <div style={sectionLabel}>idShortChars 截断变体（0=完整 / 4 / 8默认 / 12）</div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
        <span style={{ ...sectionLabel, minWidth: 80, marginBottom: 0 }}>完整（0）：</span>
        <IdRef kind="video" id="abc12345" idShortChars={0} />
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
        <span style={{ ...sectionLabel, minWidth: 80, marginBottom: 0 }}>4 字：</span>
        <IdRef kind="video" id="a1b2c3d4e5f6789012345678" idShortChars={4} />
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
        <span style={{ ...sectionLabel, minWidth: 80, marginBottom: 0 }}>8 字（默认）：</span>
        <IdRef kind="video" id="a1b2c3d4e5f6789012345678" />
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
        <span style={{ ...sectionLabel, minWidth: 80, marginBottom: 0 }}>12 字：</span>
        <IdRef kind="video" id="a1b2c3d4e5f6789012345678" idShortChars={12} />
      </div>
    </div>
  </div>
)

// id 空/批量 fallback 态
export const FallbackStates = () => (
  <div style={col}>
    <div style={sectionLabel}>fallback 态（id 为空时降级 — 审核批量操作场景）</div>
    <div style={row}>
      <IdRef kind="video" id={null as unknown as string} />
      <IdRef kind="source" id={null as unknown as string} batchFallback="批量" />
      <IdRef kind="comment" id={'' as string} batchFallback="—" />
    </div>
  </div>
)
