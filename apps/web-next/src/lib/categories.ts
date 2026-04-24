/**
 * 分类常量单一来源（ADR-048 §4）
 *
 * typeParam  = URL 路由 slug（/[locale]/[typeParam]）
 * videoType  = API 参数（VideoType enum）
 * labelKey   = i18n key（namespace: 'nav'）
 *
 * tvshow(URL) → variety(API)，其余一一对应。
 */

export interface CategoryEntry {
  readonly typeParam: string
  readonly videoType: string
  readonly labelKey: string
}

export const ALL_CATEGORIES: readonly CategoryEntry[] = [
  { typeParam: 'movie',       videoType: 'movie',       labelKey: 'catMovie'       },
  { typeParam: 'series',      videoType: 'series',      labelKey: 'catSeries'      },
  { typeParam: 'anime',       videoType: 'anime',       labelKey: 'catAnime'       },
  { typeParam: 'tvshow',      videoType: 'variety',     labelKey: 'catVariety'     },
  { typeParam: 'documentary', videoType: 'documentary', labelKey: 'catDocumentary' },
  { typeParam: 'short',       videoType: 'short',       labelKey: 'catShort'       },
  { typeParam: 'sports',      videoType: 'sports',      labelKey: 'catSports'      },
  { typeParam: 'music',       videoType: 'music',       labelKey: 'catMusic'       },
  { typeParam: 'news',        videoType: 'news',        labelKey: 'catNews'        },
  { typeParam: 'kids',        videoType: 'kids',        labelKey: 'catKids'        },
  { typeParam: 'other',       videoType: 'other',       labelKey: 'catOther'       },
]

export const MAIN_TYPE_PARAMS = ['movie', 'series', 'anime', 'tvshow', 'documentary'] as const
export const MORE_TYPE_PARAMS = ['short', 'sports', 'music', 'news', 'kids', 'other'] as const
