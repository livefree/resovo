/**
 * tests/e2e-next/_seed/fixtures.ts — CHORE-E2E-WATCH-SSR-SEED
 *
 * e2e-next watch / detail 页 spec 的 SSR seed 真源。
 *
 * 背景：watch 页（`/[locale]/watch/[slug]`）与 detail 页（`/[locale]/[type]/[slug]`）均为
 * server component，SSR `fetchVideoDetail(slug)` 直连 api、404 即 `notFound()`；e2e spec 仅用
 * 客户端 `page.route` mock（拦不住 Next 服务端 fetch）。故这些页引用的视频必须真实存在于 DB
 * （公开可见 + 完整元数据）SSR 才不 404、且渲染数据与断言一致。
 *
 * **关键**：detail.spec / player.spec 共用同一批 shortId，且 detail.spec 断言完整元数据
 * （description/director/cast/year/rating/genres…）。这些字段在 `media_catalog`（非 videos 表，
 * api VIDEO_JOIN 映射 mc.* → Video DTO），故每个 seed 视频须建**专属 catalog 并填全元数据**
 * 与 MOCK 对齐；aB3kR9x1 / bC4lS0y2 精确对齐 detail.spec MOCK_MOVIE / MOCK_ANIME。
 *
 * 线路/集数映射（消费方 apps/web-next/src/lib/line-matrix.ts buildLineKey =(siteDisplayName,sourceName)）：
 *   - 线路数 = 不同 source_name 数；集数 = 同线路下不同 episode_number 数。
 */

export interface SeedSource {
  readonly sourceName: string
  readonly episodeNumber: number
  readonly sourceUrl: string
}

/** 专属 media_catalog 元数据（api 经 VIDEO_JOIN 映射进 Video DTO） */
export interface SeedCatalog {
  readonly titleEn: string | null
  readonly description: string | null
  readonly year: number | null
  readonly country: string | null
  readonly rating: number | null
  readonly ratingVotes: number | null
  readonly runtimeMinutes: number | null
  readonly status: string
  readonly director: readonly string[]
  readonly cast: readonly string[]
  readonly writers: readonly string[]
  readonly genres: readonly string[]
  readonly languages: readonly string[]
}

export interface SeedVideo {
  readonly shortId: string
  readonly slug: string
  readonly title: string
  readonly type: 'movie' | 'anime' | 'tv' | 'variety'
  readonly episodeCount: number
  readonly contentFormat: 'movie' | 'episodic'
  readonly episodePattern: 'single' | 'multi'
  readonly catalog: SeedCatalog
  readonly sources: readonly SeedSource[]
}

/** 构造 lineNames × episodes 笛卡尔积源集（每线路覆盖全部集号） */
function buildSources(
  shortId: string,
  lineNames: readonly string[],
  episodes: readonly number[],
): SeedSource[] {
  const out: SeedSource[] = []
  lineNames.forEach((sourceName, lineIdx) => {
    episodes.forEach((episodeNumber) => {
      out.push({
        sourceName,
        episodeNumber,
        sourceUrl: `https://e2e-seed.example.com/${shortId}/l${lineIdx}/e${episodeNumber}.m3u8`,
      })
    })
  })
  return out
}

const range = (n: number): number[] => Array.from({ length: n }, (_, i) => i + 1)

/** player 域用视频（tri-state/option-tabs/cinema）不断言富元数据，给最小但合法 catalog */
const MINIMAL_CATALOG: SeedCatalog = {
  titleEn: null,
  description: null,
  year: null,
  country: null,
  rating: null,
  ratingVotes: null,
  runtimeMinutes: null,
  status: 'completed',
  director: [],
  cast: [],
  writers: [],
  genres: [],
  languages: [],
}

/**
 * watch / detail 页 spec seed 集（5 视频）：
 *   - aB3kR9x1 / player.spec MOCK_MOVIE + detail.spec MOCK_MOVIE：movie 1 集 / 3 线路
 *   - bC4lS0y2 / player.spec MOCK_ANIME + detail.spec MOCK_ANIME：anime 12 集 / 1 线路
 *   - TriState / player-tri-state：movie 1 集 / 2 线路
 *   - TabsTest / player-option-tabs-stable：anime 12 集 / 2 线路
 *   - CinemaM1 / cinema-mode-size：movie 1 集 / 1 线路
 */
export const E2E_SEED_VIDEOS: readonly SeedVideo[] = [
  {
    shortId: 'aB3kR9x1',
    slug: 'test-movie-aB3kR9x1',
    title: '测试电影',
    type: 'movie',
    episodeCount: 1,
    contentFormat: 'movie',
    episodePattern: 'single',
    // 精确对齐 detail.spec / player.spec MOCK_MOVIE
    catalog: {
      titleEn: 'Test Movie',
      description: '这是一部测试电影的简介',
      year: 2024,
      country: 'CN',
      rating: 8.5,
      ratingVotes: 1000,
      runtimeMinutes: 120,
      status: 'completed',
      director: ['张导演'],
      cast: ['李演员', '王演员'],
      writers: ['赵编剧'],
      genres: ['action'],
      languages: ['zh-CN'],
    },
    sources: buildSources('aB3kR9x1', ['线路1', '线路2', '线路3'], [1]),
  },
  {
    shortId: 'bC4lS0y2',
    slug: 'test-anime-bC4lS0y2',
    title: '测试动漫',
    type: 'anime',
    episodeCount: 12,
    contentFormat: 'episodic',
    episodePattern: 'multi',
    // 精确对齐 detail.spec / player.spec MOCK_ANIME（MOCK_MOVIE override：anime/ongoing/12 集）
    catalog: {
      titleEn: 'Test Anime',
      description: '这是一部测试电影的简介',
      year: 2024,
      country: 'CN',
      rating: 8.5,
      ratingVotes: 1000,
      runtimeMinutes: 120,
      status: 'ongoing',
      director: ['张导演'],
      cast: ['李演员', '王演员'],
      writers: ['赵编剧'],
      genres: ['action'],
      languages: ['zh-CN'],
    },
    sources: buildSources('bC4lS0y2', ['线路1'], range(12)),
  },
  {
    shortId: 'TriState',
    slug: 'tri-state-movie-TriState',
    title: '三态测试电影',
    type: 'movie',
    episodeCount: 1,
    contentFormat: 'movie',
    episodePattern: 'single',
    catalog: MINIMAL_CATALOG,
    sources: buildSources('TriState', ['线路1', '线路2'], [1]),
  },
  {
    shortId: 'TabsTest',
    slug: 'tabs-stable-anime-TabsTest',
    title: 'Tab 稳定性动漫',
    type: 'anime',
    episodeCount: 12,
    contentFormat: 'episodic',
    episodePattern: 'multi',
    catalog: MINIMAL_CATALOG,
    sources: buildSources('TabsTest', ['线路1', '线路2'], range(12)),
  },
  {
    shortId: 'CinemaM1',
    slug: 'cinema-mode-movie-CinemaM1',
    title: '影院模式测试电影',
    type: 'movie',
    episodeCount: 1,
    contentFormat: 'movie',
    episodePattern: 'single',
    catalog: MINIMAL_CATALOG,
    sources: buildSources('CinemaM1', ['线路1'], [1]),
  },
  {
    // detail-episode-pick.spec MOCK_DETAIL_ANIME：详情页选集链路
    shortId: 'DetailEp',
    slug: 'detail-episode-anime-DetailEp',
    title: '详情选集测试动漫',
    type: 'anime',
    episodeCount: 12,
    contentFormat: 'episodic',
    episodePattern: 'multi',
    catalog: {
      titleEn: 'Detail Episode Anime',
      description: '测试详情简介',
      year: 2024,
      country: 'CN',
      rating: 8.3,
      ratingVotes: 500,
      runtimeMinutes: 24,
      status: 'ongoing',
      director: ['张导'],
      cast: ['李演员'],
      writers: [],
      genres: ['anime'],
      languages: ['zh-CN'],
    },
    sources: buildSources('DetailEp', ['线路1'], range(12)),
  },
]

export const E2E_SEED_SHORT_IDS: readonly string[] = E2E_SEED_VIDEOS.map((v) => v.shortId)

/** 专属 catalog 标记前缀（title_normalized）——teardown / 幂等删旧据此识别 seed catalog。 */
export const E2E_SEED_CATALOG_MARKER = 'e2e-seed-'
export const catalogMarker = (shortId: string): string => `${E2E_SEED_CATALOG_MARKER}${shortId}`
