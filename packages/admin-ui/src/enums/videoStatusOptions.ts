import { VIDEO_STATUSES, type VideoStatus } from '@resovo/types'
import type { AdminSelectOption } from '../components/admin-select/admin-select'
import type { TFunction } from './index'

/** ⚠️ FALLBACK 同步责任：见 videoTypeOptions.ts 头部说明 / `videoStatus.*` i18n 词条 */
const VIDEO_STATUS_FALLBACK_LABEL: Record<VideoStatus, string> = {
  ongoing: '连载中',
  completed: '已完结',
}

export function getVideoStatusOptions(t?: TFunction): readonly AdminSelectOption<VideoStatus>[] {
  return VIDEO_STATUSES.map((value) => ({
    value,
    label: t ? t(`videoStatus.${value}`) : VIDEO_STATUS_FALLBACK_LABEL[value],
  }))
}
