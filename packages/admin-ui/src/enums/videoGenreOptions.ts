import { VIDEO_GENRES, type VideoGenre } from '@resovo/types'
import type { AdminSelectOption } from '../components/admin-select/admin-select'
import type { TFunction } from './index'

/** ⚠️ FALLBACK 同步责任：见 videoTypeOptions.ts 头部说明 / `videoGenre.*` i18n 词条 */
const VIDEO_GENRE_FALLBACK_LABEL: Record<VideoGenre, string> = {
  action: '动作',
  comedy: '喜剧',
  romance: '爱情',
  thriller: '惊悚',
  horror: '恐怖',
  sci_fi: '科幻',
  fantasy: '奇幻/魔幻',
  history: '历史/古装',
  crime: '犯罪',
  mystery: '悬疑',
  war: '战争',
  family: '家庭/亲情',
  biography: '传记/人物',
  martial_arts: '武侠/功夫',
  adventure: '冒险',
  disaster: '灾难',
  musical: '歌舞',
  western: '西部',
  sport: '运动',
  other: '其他',
}

export function getVideoGenreOptions(t?: TFunction): readonly AdminSelectOption<VideoGenre>[] {
  return VIDEO_GENRES.map((value) => ({
    value,
    label: t ? t(`videoGenre.${value}`) : VIDEO_GENRE_FALLBACK_LABEL[value],
  }))
}
