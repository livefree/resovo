import { TRENDING_TAGS, type TrendingTag } from '@resovo/types'
import type { AdminSelectOption } from '../components/admin-select/admin-select'
import type { TFunction } from './index'

/** ⚠️ FALLBACK 同步责任：见 videoTypeOptions.ts 头部说明 / `trendingTag.*` i18n 词条 */
const TRENDING_TAG_FALLBACK_LABEL: Record<TrendingTag, string> = {
  hot: '热门',
  weekly_top: '周榜',
  editors_pick: '编辑推荐',
  exclusive: '独家',
}

export function getTrendingTagOptions(t?: TFunction): readonly AdminSelectOption<TrendingTag>[] {
  return TRENDING_TAGS.map((value) => ({
    value,
    label: t ? t(`trendingTag.${value}`) : TRENDING_TAG_FALLBACK_LABEL[value],
  }))
}
