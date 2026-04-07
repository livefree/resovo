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
  // 奇幻 / 魔幻
  '奇幻': 'fantasy', 'Fantasy': 'fantasy', '魔幻': 'fantasy', '玄幻': 'fantasy',
  // 历史 / 古装
  '历史': 'history', 'History': 'history', '古装': 'history', '历史剧': 'history',
  // 犯罪
  '犯罪': 'crime', 'Crime': 'crime',
  // 悬疑
  '悬疑': 'mystery', 'Mystery': 'mystery', 'Thriller/Mystery': 'mystery',
  // 战争
  '战争': 'war', 'War': 'war',
  // 家庭 / 亲情
  '家庭': 'family', 'Family': 'family', '亲情': 'family',
  // 传记 / 人物
  '传记': 'biography', 'Biography': 'biography', 'Documentary': 'biography',
  // 武侠 / 功夫
  '武侠': 'martial_arts', '功夫': 'martial_arts', 'Martial Arts': 'martial_arts', '武打': 'martial_arts',
  // 剧情（不单独归类，跳过）
  '剧情': null,
  'Drama': null,
  '音乐': null,
  'Music': null,
  '歌舞': null,
  '运动': null,
  '冒险': null,
  'Adventure': null,
  '动画': null,
  'Animation': null,
  '短片': null,
  'Short': null,
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
