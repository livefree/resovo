import { EnrichmentBadge } from '@resovo/admin-ui'

const col: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 12, padding: 16 }
const row: React.CSSProperties = { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }
const label: React.CSSProperties = { fontSize: '12px', color: 'var(--fg-muted)', minWidth: 80 }

// 元数据完整度评分——阈值三色带（≥80 ok / 50-79 warn / <50 danger）
export const MetaScoreVariants = () => (
  <div style={col}>
    <div style={row}>
      <span style={label}>完整（≥80）</span>
      <EnrichmentBadge kind="meta" score={95} />
      <EnrichmentBadge kind="meta" score={80} />
    </div>
    <div style={row}>
      <span style={label}>部分（50-79）</span>
      <EnrichmentBadge kind="meta" score={72} />
      <EnrichmentBadge kind="meta" score={50} />
    </div>
    <div style={row}>
      <span style={label}>缺失（&lt;50）</span>
      <EnrichmentBadge kind="meta" score={38} />
      <EnrichmentBadge kind="meta" score={0} />
    </div>
  </div>
)

// 尺寸对比 sm / md
export const MetaScoreSizes = () => (
  <div style={col}>
    <div style={row}>
      <span style={label}>sm（默认）</span>
      <EnrichmentBadge kind="meta" score={87} size="sm" />
      <EnrichmentBadge kind="meta" score={62} size="sm" />
      <EnrichmentBadge kind="meta" score={23} size="sm" />
    </div>
    <div style={row}>
      <span style={label}>md</span>
      <EnrichmentBadge kind="meta" score={87} size="md" />
      <EnrichmentBadge kind="meta" score={62} size="md" />
      <EnrichmentBadge kind="meta" score={23} size="md" />
    </div>
  </div>
)

// 拼音警告徽标（isPinyin=true → 出现，false → 不渲染）
export const PinyinWarning = () => (
  <div style={col}>
    <div style={row}>
      <span style={label}>拼音警告</span>
      <EnrichmentBadge kind="pinyin" isPinyin={true} />
      <EnrichmentBadge kind="pinyin" isPinyin={true} size="md" />
    </div>
    <div style={row}>
      <span style={label}>非拼音（不渲染）</span>
      {/* isPinyin=false → 组件 return null，此处只展示占位说明 */}
      <span style={{ fontSize: '12px', color: 'var(--fg-muted)' }}>（组件不渲染）</span>
      <EnrichmentBadge kind="pinyin" isPinyin={false} />
    </div>
  </div>
)

// showLabel=false — 仅 dot（row 密度紧凑用法）
export const DotOnly = () => (
  <div style={col}>
    <div style={row}>
      <span style={label}>仅 dot</span>
      <EnrichmentBadge kind="meta" score={91} showLabel={false} />
      <EnrichmentBadge kind="meta" score={65} showLabel={false} />
      <EnrichmentBadge kind="meta" score={28} showLabel={false} />
      <EnrichmentBadge kind="pinyin" isPinyin={true} showLabel={false} />
    </div>
  </div>
)
