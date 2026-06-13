/**
 * tests/e2e-next/_seed/fixtures.ts — CHORE-E2E-WATCH-SSR-SEED
 *
 * e2e-next watch 页 spec 的 SSR seed 真源。
 *
 * 背景：watch 页（server component）SSR `fetchVideoDetail(slug)` 直连 api，404 即 `notFound()`；
 * e2e spec 仅用客户端 `page.route` mock（拦不住 Next 服务端 fetch）。故 watch 页 spec 引用的
 * 视频必须真实存在于 DB（公开可见）SSR 才不 404。本文件定义这些固定视频 + 源，由
 * global-setup 直连 pg 落库、global-teardown 级联清理。
 *
 * 线路/集数映射（消费方 apps/web-next/src/lib/line-matrix.ts buildLineKey =(siteDisplayName,sourceName)）：
 *   - 线路数 = 不同 source_name 数；集数 = 同线路下不同 episode_number 数。
 *   - 各视频的 source_name / episode_number 须满足对应 spec 的 source-btn-N / side-episode-N 断言。
 */

export interface SeedSource {
  /** 线路键（line-matrix 按 (siteDisplayName=null → sourceName) 分组） */
  readonly sourceName: string
  /** 集号（电影恒 1；多集动漫 1..N） */
  readonly episodeNumber: number
  readonly sourceUrl: string
}

export interface SeedVideo {
  readonly shortId: string
  /** 仅作 DB slug 列值；路由由 api 按 short_id 取，slug 不参与（extractShortId 提取 URL 末段） */
  readonly slug: string
  readonly title: string
  readonly type: 'movie' | 'anime' | 'tv' | 'variety'
  readonly episodeCount: number
  readonly contentFormat: 'movie' | 'episodic'
  readonly episodePattern: 'single' | 'multi'
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

/**
 * watch 页 spec seed 集（5 视频）：
 *   - aB3kR9x1 / player.spec MOCK_MOVIE：movie 1 集 / 3 线路 → source-btn-0..2
 *   - bC4lS0y2 / player.spec MOCK_ANIME：anime 12 集 / 1 线路 → side-episode-1..12
 *   - TriState / player-tri-state：movie 1 集 / 2 线路 → source-btn-0..1
 *   - TabsTest / player-option-tabs-stable：anime 12 集 / 2 线路 → 选集+线路双 tab 共存
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
    sources: buildSources('CinemaM1', ['线路1'], [1]),
  },
]

export const E2E_SEED_SHORT_IDS: readonly string[] = E2E_SEED_VIDEOS.map((v) => v.shortId)
