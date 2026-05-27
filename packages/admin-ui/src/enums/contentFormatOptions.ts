import { CONTENT_FORMATS, type ContentFormat } from '@resovo/types'
import type { AdminSelectOption } from '../components/admin-select/admin-select'
import type { TFunction } from './index'

/** ⚠️ FALLBACK 同步责任：见 videoTypeOptions.ts 头部说明 / `contentFormat.*` i18n 词条 */
const CONTENT_FORMAT_FALLBACK_LABEL: Record<ContentFormat, string> = {
  movie: '电影',
  episodic: '剧集',
  collection: '合集',
  clip: '片段',
}

export function getContentFormatOptions(t?: TFunction): readonly AdminSelectOption<ContentFormat>[] {
  return CONTENT_FORMATS.map((value) => ({
    value,
    label: t ? t(`contentFormat.${value}`) : CONTENT_FORMAT_FALLBACK_LABEL[value],
  }))
}
