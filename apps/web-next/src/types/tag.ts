export type LifecycleTag =
  | 'new'
  | 'coming_soon'
  | 'ongoing'
  | 'completed'
  | 'delisting'

export type TrendingTag =
  | 'hot'
  | 'weekly_top'
  | 'exclusive'
  | 'editors_pick'

export type SpecTag = '4k' | 'hdr' | 'dolby' | 'subtitled' | 'multilang'

export type RatingSource = 'douban' | 'imdb'

export interface TagLayerProps {
  lifecycle?: LifecycleTag
  trending?: TrendingTag
  specs?: SpecTag[]
  rating?: {
    source: RatingSource
    value: number
  }
}
