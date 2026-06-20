import { FilterChip } from '@resovo/admin-ui'

const row: React.CSSProperties = { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', padding: 16 }
const col: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 16, padding: 16 }

// 单个 FilterChip：label / value 各种长度
export const Single = () => (
  <div style={col}>
    <div style={row}>
      <FilterChip id="type" label="类型" value="电影" onClear={() => {}} />
      <FilterChip id="status" label="状态" value="审核通过" onClear={() => {}} />
      <FilterChip id="year" label="年份" value="2024" onClear={() => {}} />
      <FilterChip id="source" label="来源" value="TMDB" onClear={() => {}} />
    </div>
  </div>
)

// 多条件并排（FilterChipBar 场景模拟）
export const MultipleChips = () => (
  <div style={col}>
    <div style={{ ...row, background: 'var(--bg-surface)', padding: '8px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
      <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--fg-muted)', flexShrink: 0 }}>已筛选：</span>
      <FilterChip id="type" label="类型" value="电视剧" onClear={() => {}} />
      <FilterChip id="status" label="状态" value="待审核" onClear={() => {}} />
      <FilterChip id="year" label="年份" value="2023–2024" onClear={() => {}} />
      <FilterChip id="region" label="地区" value="中国大陆" onClear={() => {}} />
    </div>
  </div>
)
