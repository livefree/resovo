import type { VideoType, VideoStatus } from '@resovo/types'

export type { VideoType, VideoStatus }

// META-35 / ADR-201 §视频编辑抽屉：去 Douban 独占 tab + external→统一「元数据」tab（四源同级）。
// 旧深链取值 'douban' / 'external' 在 VideoEditDrawer 入口归一到 'metadata'（兼容 ≥1 小版本）。
export type TabKey = 'basic' | 'lines' | 'images' | 'metadata'

/** 旧深链兼容：'douban' / 'external' → 'metadata'（ADR-201 §迁移与兼容）。其余原样。 */
export function normalizeTabKey(tab: TabKey | 'douban' | 'external' | undefined): TabKey | undefined {
  if (tab === 'douban' || tab === 'external') return 'metadata'
  return tab
}

export interface FormState {
  title: string
  titleEn: string
  // ADR-206 D-206-9（3B-2）：原名 / 原语种（BCP47）/ 别名（aka 逗号分隔）
  titleOriginal: string
  originalLanguage: string
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
  aliases: string
}

export const EMPTY_FORM: FormState = {
  title: '', titleEn: '', titleOriginal: '', originalLanguage: '', type: 'movie',
  year: '', country: '', description: '',
  genres: '', episodeCount: '', status: '', rating: '',
  director: '', cast: '', writers: '', doubanId: '', aliases: '',
}
