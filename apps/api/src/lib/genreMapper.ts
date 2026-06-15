/**
 * genreMapper.ts — genres 归一化映射
 *
 * 两套映射函数：
 * 1. mapDoubanGenres：豆瓣原始题材（中文）→ VideoGenre[]（高置信度）
 * 2. mapSourceCategory：爬虫 source_category → VideoGenre[]（低置信度，规则推断）
 *
 * 置信度说明：
 *   豆瓣提供明确题材列表，单条目最多 3-5 个，映射准确度高。
 *   source_category 是采集端原始字符串，含义模糊（如"都市"可能是爱情也可能是剧情），
 *   仅在无豆瓣数据时作为兜底推断，结果应标记低置信度。
 */

import type { VideoGenre } from '@/types'

// ── 豆瓣题材映射（中文 → VideoGenre）────────────────────────────

const DOUBAN_GENRE_MAP: Record<string, VideoGenre> = {
  // 动作
  '动作': 'action', 'Action': 'action',
  // 喜剧
  '喜剧': 'comedy', 'Comedy': 'comedy',
  // 爱情 / 浪漫
  '爱情': 'romance', 'Romance': 'romance', '浪漫': 'romance',
  // 惊悚
  '惊悚': 'thriller', 'Thriller': 'thriller',
  // 恐怖
  '恐怖': 'horror', 'Horror': 'horror',
  // 科幻
  '科幻': 'sci_fi', 'Science Fiction': 'sci_fi', 'Sci-Fi': 'sci_fi',
  '反乌托邦': 'sci_fi', 'Dystopian': 'sci_fi',
  // 奇幻 / 魔幻
  '奇幻': 'fantasy', 'Fantasy': 'fantasy', '魔幻': 'fantasy', '玄幻': 'fantasy',
  // 历史 / 古装
  '历史': 'history', 'History': 'history', '古装': 'history', '历史剧': 'history', 'Costume': 'history',
  // 犯罪
  '犯罪': 'crime', 'Crime': 'crime',
  // 悬疑 / 黑色电影
  '悬疑': 'mystery', 'Mystery': 'mystery', 'Thriller/Mystery': 'mystery',
  '黑色电影': 'mystery', 'Film-Noir': 'mystery',
  // 战争
  '战争': 'war', 'War': 'war',
  // 家庭 / 亲情
  '家庭': 'family', 'Family': 'family', '亲情': 'family',
  // 传记 / 人物（注：豆瓣 'Documentary' 在题材层同时指"纪录片"，本地由 VideoType 承载，不在此映射）
  '传记': 'biography', 'Biography': 'biography',
  // 武侠 / 功夫
  '武侠': 'martial_arts', '功夫': 'martial_arts', 'Martial Arts': 'martial_arts', '武打': 'martial_arts',
  // 冒险（META-10 新增）
  '冒险': 'adventure', 'Adventure': 'adventure',
  // 灾难（META-10 新增）
  '灾难': 'disaster', 'Disaster': 'disaster',
  // 歌舞 / 音乐（META-10 新增，合并）
  '歌舞': 'musical', 'Musical': 'musical',
  '音乐': 'musical', 'Music': 'musical',
  // 西部（META-10 新增）
  '西部': 'western', 'Western': 'western',
  // 运动（META-10 新增）
  '运动': 'sport', 'Sport': 'sport', 'Sports': 'sport',
  // 以下标签不单独归类 genre（由 VideoType 承载或政策敏感）
  '剧情': null, 'Drama': null,                                   // 万能标签，不携带信息
  '动画': null, 'Animation': null,                               // 由 VideoType=anime 承载
  '纪录片': null, 'Documentary': null,                           // 由 VideoType=documentary 承载
  '短片': null, 'Short': null,                                    // 由 VideoType=short 承载
  '儿童': null, 'Children': null,                                // 由 VideoType=kids 承载
  '同性': null, 'Gay': null, 'LGBT': null,                       // 政策敏感，raw 保留至 source_category
  '情色': null, 'Erotic': null,                                  // 政策敏感，触发审核
} as unknown as Record<string, VideoGenre>

/**
 * 将豆瓣原始题材列表（genres_raw）映射到规范 VideoGenre 枚举数组。
 * 不可映射的项（如"剧情""Drama"）静默跳过。
 * 返回去重后的 VideoGenre 数组。
 */
export function mapDoubanGenres(genresRaw: string[]): VideoGenre[] {
  const result = new Set<VideoGenre>()
  for (const raw of genresRaw) {
    const mapped = DOUBAN_GENRE_MAP[raw]
    if (mapped) result.add(mapped)
  }
  return [...result]
}

// ── TMDB 题材映射（数值 genre id → VideoGenre，ADR-202 D-202-8 M5）──────────
//
// 用 TMDB **数值 genre id**（稳定 key，不随 language 变）而非本地化 name——TMDB zh-CN 下
// 部分 genre 不翻译会回退英文（实测 tv 'Sci-Fi & Fantasy' 未翻译），用 name 会污染。
// 单表覆盖 movie + tv 两套 id 体系：共享 id 含义一致，各自特有 id 不冲突。
// null = 不归类 genre（由 VideoType 承载 / 万能标签 / 形式非题材）。

const TMDB_GENRE_MAP: Record<number, VideoGenre | null> = {
  // movie + tv 共享 id（含义一致）
  16: null,          // Animation（由 VideoType=anime 承载）
  35: 'comedy',      // Comedy
  80: 'crime',       // Crime
  99: null,          // Documentary（由 VideoType 承载）
  18: null,          // Drama（万能标签，不携带信息）
  37: 'western',     // Western
  9648: 'mystery',   // Mystery
  10751: 'family',   // Family
  // movie 特有
  28: 'action',      // Action
  12: 'adventure',   // Adventure
  14: 'fantasy',     // Fantasy
  27: 'horror',      // Horror
  36: 'history',     // History
  53: 'thriller',    // Thriller
  878: 'sci_fi',     // Science Fiction
  10402: 'musical',  // Music
  10749: 'romance',  // Romance
  10752: 'war',      // War
  10770: null,       // TV Movie（形式非题材）
  // tv 特有
  10759: 'action',   // Action & Adventure（组合类目取 action）
  10762: null,       // Kids（由 VideoType=kids 承载）
  10763: null,       // News
  10764: null,       // Reality
  10765: 'sci_fi',   // Sci-Fi & Fantasy（组合类目取 sci_fi）
  10766: null,       // Soap
  10767: null,       // Talk
  10768: 'war',      // War & Politics
}

/**
 * 将 TMDB genre id 列表映射到规范 VideoGenre 枚举数组（ADR-202 D-202-8 M5）。
 * 不可映射 / 由 VideoType 承载的 id（如 Animation 16 / Drama 18）静默跳过。去重返回。
 */
export function mapTmdbGenres(genreIds: number[]): VideoGenre[] {
  const result = new Set<VideoGenre>()
  for (const id of genreIds) {
    const mapped = TMDB_GENRE_MAP[id]
    if (mapped) result.add(mapped)
  }
  return [...result]
}

// ── source_category 映射（低置信度）─────────────────────────────

const SOURCE_CATEGORY_MAP: Record<string, VideoGenre> = {
  '爱情':     'romance',
  '言情':     'romance',
  '偶像':     'romance',
  '甜宠':     'romance',
  '青春':     'romance',
  '都市':     'romance',  // 保守推断，都市剧多为爱情
  '动作':     'action',
  '武打':     'martial_arts',
  '武侠':     'martial_arts',
  '仙侠':     'fantasy',
  '玄幻':     'fantasy',
  '奇幻':     'fantasy',
  '魔幻':     'fantasy',
  '穿越':     'fantasy',
  '历史':     'history',
  '古装':     'history',
  '宫廷':     'history',
  '年代':     'history',
  '战争':     'war',
  '军事':     'war',
  '谍战':     'thriller',
  '悬疑':     'mystery',
  '推理':     'mystery',
  '侦探':     'mystery',
  '惊悚':     'thriller',
  '恐怖':     'horror',
  '灵异':     'horror',
  '科幻':     'sci_fi',
  '未来':     'sci_fi',
  '犯罪':     'crime',
  '家庭':     'family',
  '亲情':     'family',
  '喜剧':     'comedy',
  // META-10 新增（对齐豆瓣）
  '冒险':     'adventure',
  '灾难':     'disaster',
  '歌舞':     'musical',
  '音乐':     'musical',
  '西部':     'western',
  '运动':     'sport',
  '体育':     'sport',
  '传记':     'biography',
}

/**
 * 从 source_category（爬虫原始分类字符串）推断 VideoGenre。
 * 置信度低，仅用于无豆瓣数据时的兜底。
 * 返回数组（0 或 1 个元素）。
 */
export function mapSourceCategory(sourceCategory: string | null): VideoGenre[] {
  if (!sourceCategory) return []
  const mapped = SOURCE_CATEGORY_MAP[sourceCategory.trim()]
  return mapped ? [mapped] : []
}
