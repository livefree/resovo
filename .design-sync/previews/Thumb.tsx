import { Thumb } from '@resovo/admin-ui'

const row: React.CSSProperties = { display: 'flex', gap: 12, padding: 16, flexWrap: 'wrap', alignItems: 'flex-start' }
const col: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 16, padding: 16 }
const sectionLabel: React.CSSProperties = { fontSize: 'var(--font-size-xs)', color: 'var(--fg-muted)', marginBottom: 4 }

// 真实封面图 URL（TMDB 公开图，常用占位）
const COVER_SRC = 'https://image.tmdb.org/t/p/w92/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg'
const BANNER_SRC = 'https://image.tmdb.org/t/p/w300/rX2oEQuNZvD5AQ9R3kvsf0JnRvT.jpg'
const SQUARE_SRC = 'https://image.tmdb.org/t/p/w45/jkB6eDIXFVLGDMKELwCPNKzjOAt.jpg'

// 标准用法：视频库表格 poster-sm（默认尺寸 32×48）+ 占位态
export const VideoTableCell = () => (
  <div style={col}>
    <div style={sectionLabel}>视频库表格封面列（poster-sm 默认，decorative=true）</div>
    <div style={row}>
      <Thumb src={COVER_SRC} size="poster-sm" />
      <Thumb src={COVER_SRC} size="poster-sm" />
      <Thumb src={undefined} size="poster-sm" />
      <Thumb src="" size="poster-sm" />
    </div>
  </div>
)

// 多 size 变体——poster-sm / poster-md / poster-lg / poster-xl 海报比例
export const SizeVariants = () => (
  <div style={col}>
    <div style={sectionLabel}>海报尺寸变体（poster 系列 2:3 比例）</div>
    <div style={row}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
        <Thumb src={COVER_SRC} size="poster-sm" />
        <span style={{ fontSize: 'var(--font-size-xxs)', color: 'var(--fg-muted)' }}>sm 32×48</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
        <Thumb src={COVER_SRC} size="poster-md" />
        <span style={{ fontSize: 'var(--font-size-xxs)', color: 'var(--fg-muted)' }}>md 48×72</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
        <Thumb src={COVER_SRC} size="poster-lg" />
        <span style={{ fontSize: 'var(--font-size-xxs)', color: 'var(--fg-muted)' }}>lg 80×120</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
        <Thumb src={COVER_SRC} size="poster-xl" />
        <span style={{ fontSize: 'var(--font-size-xxs)', color: 'var(--fg-muted)' }}>xl 120×180</span>
      </div>
    </div>
  </div>
)

// banner-sm + square-sm 横/方比例
export const BannerSquare = () => (
  <div style={col}>
    <div style={sectionLabel}>banner-sm（64×36 横图）+ square-sm（28×28 方形）</div>
    <div style={row}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
        <Thumb src={BANNER_SRC} size="banner-sm" />
        <span style={{ fontSize: 'var(--font-size-xxs)', color: 'var(--fg-muted)' }}>banner-sm</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
        <Thumb src={SQUARE_SRC} size="square-sm" decorative={false} alt="TMDB 来源图" />
        <span style={{ fontSize: 'var(--font-size-xxs)', color: 'var(--fg-muted)' }}>square-sm</span>
      </div>
    </div>
  </div>
)

// 占位/失败态——src 空 + fallback ReactNode
export const PlaceholderAndFallback = () => (
  <div style={col}>
    <div style={sectionLabel}>占位态与 fallback（src 为空时降级）</div>
    <div style={row}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
        <Thumb src={undefined} size="poster-md" />
        <span style={{ fontSize: 'var(--font-size-xxs)', color: 'var(--fg-muted)' }}>默认占位</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
        <Thumb
          src={undefined}
          size="poster-md"
          fallback={
            <span style={{ fontSize: 10, color: 'var(--fg-muted)' }}>无封面</span>
          }
        />
        <span style={{ fontSize: 'var(--font-size-xxs)', color: 'var(--fg-muted)' }}>fallback 文字</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
        <Thumb src={undefined} size="banner-sm" />
        <span style={{ fontSize: 'var(--font-size-xxs)', color: 'var(--fg-muted)' }}>banner 占位</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
        <Thumb src={undefined} size="square-sm" />
        <span style={{ fontSize: 'var(--font-size-xxs)', color: 'var(--fg-muted)' }}>square 占位</span>
      </div>
    </div>
  </div>
)

// 详情页主图——decorative=false + eager loading（VideoEditDrawer 真实用法）
export const DetailEager = () => (
  <div style={col}>
    <div style={sectionLabel}>详情 Drawer 主图（decorative=false + loading=eager）</div>
    <div style={row}>
      <Thumb src={COVER_SRC} size="poster-lg" decorative={false} alt="孤独摇滚 封面" loading="eager" />
      <Thumb src={undefined} size="poster-lg" decorative={false} alt="无封面视频" />
    </div>
  </div>
)
