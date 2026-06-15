/**
 * SourceParserService.maps.ts — 苹果CMS 类型/题材/成人/国家 静态映射表
 * 从 SourceParserService.ts 拆出，纯数据声明，无运行时依赖
 */

import type { VideoType, VideoGenre } from '@/types'

// ── 类型映射表（ADR-017）─────────────────────────────────────────

// CRAWLER-07: 扩充覆盖苹果 CMS 常见细分类，以及 vod_class 常见值
export const TYPE_MAP: Record<string, VideoType> = {
  // ── 电影 ──
  '电影': 'movie', 'movie': 'movie', 'Movie': 'movie',
  '剧情片': 'movie', '动作片': 'movie', '喜剧片': 'movie', '爱情片': 'movie',
  '科幻片': 'movie', '恐怖片': 'movie', '战争片': 'movie', '悬疑片': 'movie',
  '冒险片': 'movie', '惊悚片': 'movie', '灾难片': 'movie', '犯罪片': 'movie',
  '奇幻片': 'movie', '武侠片': 'movie', '歌舞片': 'movie', '伦理片': 'movie',
  '网络电影': 'movie', '微电影': 'movie',
  // ── 连续剧 / 电视剧 ──
  '电视剧': 'series', '连续剧': 'series', '国产剧': 'series', '剧集': 'series',
  '美剧': 'series', '韩剧': 'series', '日剧': 'series', '港剧': 'series', '台剧': 'series',
  '日韩剧': 'series', '欧美剧': 'series', '海外剧': 'series',
  '国语剧': 'series', '华语剧': 'series', '网络剧': 'series',
  'series': 'series', 'drama': 'series',
  // ── 动漫 ──
  '动漫': 'anime', '卡通': 'anime', '动画': 'anime', 'anime': 'anime',
  '国产动漫': 'anime', '日本动漫': 'anime', '日韩动漫': 'anime',
  '欧美动漫': 'anime', '港台动漫': 'anime', '动画片': 'anime',
  // ── 综艺（含游戏类综艺）──
  '综艺': 'variety', '真人秀': 'variety', '晚会': 'variety', '综艺节目': 'variety',
  '游戏': 'variety', 'game_show': 'variety',
  '大陆综艺': 'variety', '国产综艺': 'variety', '港台综艺': 'variety',
  '日韩综艺': 'variety', '欧美综艺': 'variety', '海外综艺': 'variety',
  // ── 短剧 / 短片 ──
  '短剧': 'short', '微剧': 'short', 'short_drama': 'short', 'short': 'short',
  '国产短剧': 'short', '海外短剧': 'short', '短视频': 'short',
  // ── 体育 ──
  '体育': 'sports', 'sports': 'sports', '足球': 'sports', '篮球': 'sports', '赛事': 'sports',
  // ── 音乐 ──
  '音乐': 'music', 'MV': 'music', 'music': 'music',
  '音乐节目': 'music', '音乐会': 'music',
  // ── 纪录片 ──
  '纪录片': 'documentary', 'documentary': 'documentary', '纪实': 'documentary', '记录': 'documentary',
  // ── 少儿 ──
  '少儿': 'kids', '儿童': 'kids', 'children': 'kids', 'kids': 'kids', '少儿节目': 'kids',
  // ── 新闻 ──
  '新闻': 'news', 'news': 'news', '资讯': 'news',
}

// ── 题材映射表（source_category → VideoGenre）────────────────────
// 仅映射 source_category 中能明确推断题材的类目；
// 大多数类目（短剧/少儿/动漫/综艺等）描述的是内容形式，不映射到 genre。

export const GENRE_MAP: Record<string, VideoGenre> = {
  // 爱情 / 都市
  '爽文短剧': 'romance', '女频恋爱': 'romance', '现代都市': 'romance',
  // 犯罪
  '犯罪片': 'crime',
  // 战争
  '战争片': 'war',
  // 悬疑
  '悬疑片': 'mystery', '脑洞悬疑': 'mystery',
  // 动作
  '功夫片': 'action', '武侠片': 'martial_arts',
  // 其他（有明确含义但不在上述具体分类）
  '剧情片': 'other',
}

// ── 成人内容类目列表（source_category → content_rating='adult'）────
// 这些类目的内容设为 visibility_status='hidden'（Migration 021 回填）；
// 未来开辟成人专区时，可通过 content_rating='adult' 查询并切换可见性。

export const ADULT_CATEGORIES = new Set<string>([
  '亚洲情色', '亚洲有码', '日本有码', '日本无码', '无码专区',
  '国产自拍', '国产主播', '国产直播', '国产盗摄', '国产SM',
  '欧美性爱', '欧美精品',
  '中文字幕',
  '门事件', '强奸乱伦', '伦理三级', '倫理片',
  '抖阴视频', '自拍偷拍', '重口调教',
  '性感人妻', '主播视讯', '主播秀色',
  '口爆颜射', '换脸明星', '美乳巨乳', '巨乳美乳',
  '黑丝诱惑', '制服丝袜',
  '素人搭讪', '童颜巨乳', '群交淫乱', '多人群交',
  '大象传媒', '探花系列', '传媒原创',
  '女优系列',
])

// COUNTRY_MAP 单一真源已上提 packages/types（META-40，评审 #2「禁止新建第二套国家表」）。
// 此处保留符号名 re-export，零改 parseCountry(:162) / normalizeCountryCode 等下游消费者。
export { COUNTRY_NAME_TO_ISO as COUNTRY_MAP } from '@/types'
