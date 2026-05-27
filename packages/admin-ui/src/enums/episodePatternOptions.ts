import { EPISODE_PATTERNS, type EpisodePattern } from '@resovo/types'
import type { AdminSelectOption } from '../components/admin-select/admin-select'
import type { TFunction } from './index'

/** ⚠️ FALLBACK 同步责任：见 videoTypeOptions.ts 头部说明 / `episodePattern.*` i18n 词条 */
const EPISODE_PATTERN_FALLBACK_LABEL: Record<EpisodePattern, string> = {
  single: '单集',
  multi: '多集',
  ongoing: '连载剧',  /* 形态语义 / 与 VideoStatus.ongoing="连载中"（状态语义）区分 / CHG-340-B 评审 Y1 消化 */
  unknown: '未知',
}

export function getEpisodePatternOptions(t?: TFunction): readonly AdminSelectOption<EpisodePattern>[] {
  return EPISODE_PATTERNS.map((value) => ({
    value,
    label: t ? t(`episodePattern.${value}`) : EPISODE_PATTERN_FALLBACK_LABEL[value],
  }))
}
