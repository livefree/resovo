import type { VideoType, VideoStatus } from '@resovo/types'

export type { VideoType, VideoStatus }

export type TabKey = 'basic' | 'lines' | 'images' | 'douban'

export interface FormState {
  title: string
  titleEn: string
  type: VideoType
  year: string
  country: string
  description: string
  genres: string
  episodeCount: string
  status: VideoStatus | ''
  rating: string
  director: string
  cast: string
  writers: string
  doubanId: string
}

export const EMPTY_FORM: FormState = {
  title: '', titleEn: '', type: 'movie', year: '', country: '', description: '',
  genres: '', episodeCount: '', status: '', rating: '',
  director: '', cast: '', writers: '', doubanId: '',
}
