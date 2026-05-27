import { VIDEO_QUALITIES, type VideoQuality } from '@resovo/types'
import type { AdminSelectOption } from '../components/admin-select/admin-select'
import type { TFunction } from './index'

/** ⚠️ FALLBACK 同步责任：见 videoTypeOptions.ts 头部说明 / `videoQuality.*` i18n 词条 */
const VIDEO_QUALITY_FALLBACK_LABEL: Record<VideoQuality, string> = {
  '4K': '4K',
  '1080P': '1080P',
  '720P': '720P',
  '480P': '480P',
  '360P': '360P',
}

export function getVideoQualityOptions(t?: TFunction): readonly AdminSelectOption<VideoQuality>[] {
  return VIDEO_QUALITIES.map((value) => ({
    value,
    label: t ? t(`videoQuality.${value}`) : VIDEO_QUALITY_FALLBACK_LABEL[value],
  }))
}
