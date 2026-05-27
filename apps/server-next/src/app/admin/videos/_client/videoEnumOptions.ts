import type { VideoType } from '@resovo/types'

export const VIDEO_TYPE_OPTIONS: ReadonlyArray<{ value: VideoType; label: string }> = [
  { value: 'movie', label: '电影' },
  { value: 'series', label: '剧集' },
  { value: 'anime', label: '动漫' },
  { value: 'variety', label: '综艺' },
  { value: 'documentary', label: '纪录片' },
  { value: 'short', label: '短片' },
  { value: 'sports', label: '体育' },
  { value: 'music', label: '音乐' },
  { value: 'news', label: '新闻' },
  { value: 'kids', label: '少儿' },
  { value: 'other', label: '其他' },
]
