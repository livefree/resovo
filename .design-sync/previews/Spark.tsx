import { Spark } from '@resovo/admin-ui'

const row: React.CSSProperties = { display: 'flex', gap: 16, padding: 16, alignItems: 'center', flexWrap: 'wrap' }
const label: React.CSSProperties = { fontSize: 11, color: 'var(--fg-muted)', marginBottom: 4 }

// 核心用法：line + area 两变体，accent 颜色（reference §5.1.2 视频总量）
export const LineAndArea = () => (
  <div style={row}>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={label}>折线 · 视频总量趋势</span>
      <Spark
        data={[12, 18, 15, 22, 28, 25, 34]}
        color="var(--accent-default)"
        variant="line"
        ariaLabel="7 天视频总量趋势"
      />
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={label}>面积 · 视频总量趋势</span>
      <Spark
        data={[12, 18, 15, 22, 28, 25, 34]}
        color="var(--accent-default)"
        variant="area"
        ariaLabel="7 天视频总量趋势（面积）"
      />
    </div>
  </div>
)

// 状态色变体轴：warn / ok / danger（reference §5.1.2 KPI 4 色）
export const ColorVariants = () => (
  <div style={row}>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={label}>warn · 待审数量</span>
      <Spark
        data={[40, 38, 44, 41, 47, 46, 48]}
        color="var(--state-warning-fg)"
        variant="line"
        ariaLabel="7 天待审数量趋势"
      />
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={label}>ok · 源可达率</span>
      <Spark
        data={[97, 98, 97, 99, 98, 99, 99]}
        color="var(--state-success-fg)"
        variant="line"
        ariaLabel="7 天源可达率趋势"
      />
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={label}>danger · 失效源（面积）</span>
      <Spark
        data={[60, 55, 58, 50, 45, 42, 39]}
        color="var(--state-error-fg)"
        variant="area"
        ariaLabel="7 天失效源趋势"
      />
    </div>
  </div>
)

// 尺寸与数据量变体：宽/窄/稀疏/密集数据点
export const SizeAndDensity = () => (
  <div style={row}>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={label}>宽幅 120px · 密集 14 点</span>
      <Spark
        data={[10, 14, 12, 18, 22, 20, 25, 28, 24, 30, 27, 33, 31, 36]}
        color="var(--accent-default)"
        variant="area"
        width={120}
        height={24}
        ariaLabel="14 天趋势"
      />
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={label}>紧凑 40px · 行级 SiteHealth</span>
      <Spark
        data={[5, 8, 6, 10, 9, 12]}
        color="var(--state-success-fg)"
        variant="line"
        width={40}
        height={14}
        strokeWidth={1}
        ariaLabel="线路健康趋势"
      />
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={label}>单点 dot（1 数据点）</span>
      <Spark
        data={[42]}
        color="var(--accent-default)"
        width={60}
        height={18}
        ariaLabel="单点"
      />
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={label}>等值水平线（min===max）</span>
      <Spark
        data={[100, 100, 100, 100, 100]}
        color="var(--state-warning-fg)"
        variant="line"
        ariaLabel="持平趋势"
      />
    </div>
  </div>
)
