import { EnrichmentBadgeCluster } from '@resovo/admin-ui'

const col: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 16, padding: 16 }
const row: React.CSSProperties = { display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }
const sectionLabel: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 600,
  color: 'var(--fg-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
}

// 完整命中（豆瓣+TMDB+IMDb，非动画系列剧）— row 密度（仅彩色 logo）
export const RowDensityMatched = () => (
  <div style={col}>
    <span style={sectionLabel}>row — 三源命中（神探夏洛克 / 系列）</span>
    <div style={row}>
      <EnrichmentBadgeCluster
        summary={{
          doubanStatus: 'matched',
          bangumiStatus: 'pending',
          sourceCheckStatus: 'ok',
          metaScore: 88,
          enrichedAt: '2026-05-10T08:30:00Z',
          titleEnIsPinyin: false,
          doubanConfidence: 0.97,
          bangumiSubjectId: null,
          doubanId: '3016873',
          tmdbId: 19885,
          imdbId: 'tt1475582',
        }}
        type="series"
        density="row"
      />
    </div>
    <span style={sectionLabel}>row — 豆瓣候选 + TMDB 命中（拼音警告）</span>
    <div style={row}>
      <EnrichmentBadgeCluster
        summary={{
          doubanStatus: 'candidate',
          bangumiStatus: 'pending',
          sourceCheckStatus: 'partial',
          metaScore: 52,
          enrichedAt: '2026-04-22T14:00:00Z',
          titleEnIsPinyin: true,
          doubanConfidence: 0.61,
          bangumiSubjectId: null,
          doubanId: '1291542',
          tmdbId: 24428,
          imdbId: null,
        }}
        type="movie"
        density="row"
      />
    </div>
    <span style={sectionLabel}>row — 无命中（全 absent → 不渲染任何 logo）</span>
    <div style={row}>
      <EnrichmentBadgeCluster
        summary={{
          doubanStatus: 'unmatched',
          bangumiStatus: 'pending',
          sourceCheckStatus: 'all_dead',
          metaScore: 15,
          enrichedAt: null,
          titleEnIsPinyin: false,
          doubanConfidence: null,
          bangumiSubjectId: null,
          doubanId: null,
          tmdbId: null,
          imdbId: null,
        }}
        type="series"
        density="row"
      />
      <span style={{ fontSize: '12px', color: 'var(--fg-muted)' }}>（无命中，行中不渲染 logo）</span>
    </div>
  </div>
)

// header 密度（全 logo 含灰显 + meta chip + 富集时间）
export const HeaderDensityFull = () => (
  <div style={col}>
    <span style={sectionLabel}>header — 全源命中（进击的巨人 / anime）</span>
    <div style={row}>
      <EnrichmentBadgeCluster
        summary={{
          doubanStatus: 'matched',
          bangumiStatus: 'matched',
          sourceCheckStatus: 'ok',
          metaScore: 95,
          enrichedAt: '2026-06-01T10:00:00Z',
          titleEnIsPinyin: false,
          doubanConfidence: 0.99,
          bangumiSubjectId: 40196,
          doubanId: '1899212',
          tmdbId: 1429,
          imdbId: 'tt2560140',
        }}
        type="anime"
        density="header"
        enrichedAtLabel="2026-06-01 10:00"
      />
    </div>
    <span style={sectionLabel}>header — Bangumi 候选（anime；豆瓣未匹配）</span>
    <div style={row}>
      <EnrichmentBadgeCluster
        summary={{
          doubanStatus: 'unmatched',
          bangumiStatus: 'candidate',
          sourceCheckStatus: 'ok',
          metaScore: 63,
          enrichedAt: '2026-05-18T09:15:00Z',
          titleEnIsPinyin: false,
          doubanConfidence: null,
          bangumiSubjectId: 328490,
          doubanId: null,
          tmdbId: 85937,
          imdbId: null,
        }}
        type="anime"
        density="header"
        enrichedAtLabel="2026-05-18 09:15"
      />
    </div>
    <span style={sectionLabel}>header — 未富集兜底（enrichedAtLabel 省略）</span>
    <div style={row}>
      <EnrichmentBadgeCluster
        summary={{
          doubanStatus: 'pending',
          bangumiStatus: 'pending',
          sourceCheckStatus: 'pending',
          metaScore: 0,
          enrichedAt: null,
          titleEnIsPinyin: false,
          doubanConfidence: null,
          bangumiSubjectId: null,
          doubanId: null,
          tmdbId: null,
          imdbId: null,
        }}
        type="movie"
        density="header"
      />
    </div>
  </div>
)

// 多类型对比（type 轴）— row 密度
export const TypeAxis = () => (
  <div style={col}>
    <span style={sectionLabel}>type 轴 — anime（显示 Bangumi）vs 非 anime（隐藏 Bangumi）</span>
    <div style={{ ...col, gap: 8 }}>
      <div style={row}>
        <span style={{ fontSize: '12px', color: 'var(--fg-muted)', minWidth: 80 }}>anime</span>
        <EnrichmentBadgeCluster
          summary={{
            doubanStatus: 'matched',
            bangumiStatus: 'matched',
            sourceCheckStatus: 'ok',
            metaScore: 91,
            enrichedAt: '2026-05-20T00:00:00Z',
            titleEnIsPinyin: false,
            doubanConfidence: 0.98,
            bangumiSubjectId: 253,
            doubanId: '2404435',
            tmdbId: 30984,
            imdbId: 'tt0479415',
          }}
          type="anime"
          density="row"
        />
      </div>
      <div style={row}>
        <span style={{ fontSize: '12px', color: 'var(--fg-muted)', minWidth: 80 }}>movie</span>
        <EnrichmentBadgeCluster
          summary={{
            doubanStatus: 'matched',
            bangumiStatus: 'pending',
            sourceCheckStatus: 'ok',
            metaScore: 91,
            enrichedAt: '2026-05-20T00:00:00Z',
            titleEnIsPinyin: false,
            doubanConfidence: 0.98,
            bangumiSubjectId: null,
            doubanId: '1291546',
            tmdbId: 550,
            imdbId: 'tt0137523',
          }}
          type="movie"
          density="row"
        />
      </div>
    </div>
  </div>
)
