import { SOURCE_TYPES, type SourceType } from '@resovo/types'
import type { AdminSelectOption } from '../components/admin-select/admin-select'
import type { TFunction } from './index'

/** ⚠️ FALLBACK 同步责任：见 videoTypeOptions.ts 头部说明 / `sourceType.*` i18n 词条 */
const SOURCE_TYPE_FALLBACK_LABEL: Record<SourceType, string> = {
  hls: 'HLS',
  mp4: 'MP4',
  dash: 'DASH',
}

export function getSourceTypeOptions(t?: TFunction): readonly AdminSelectOption<SourceType>[] {
  return SOURCE_TYPES.map((value) => ({
    value,
    label: t ? t(`sourceType.${value}`) : SOURCE_TYPE_FALLBACK_LABEL[value],
  }))
}
