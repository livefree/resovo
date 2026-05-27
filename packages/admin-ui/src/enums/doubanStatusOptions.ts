import { DOUBAN_STATUSES, type DoubanStatus } from '@resovo/types'
import type { AdminSelectOption } from '../components/admin-select/admin-select'
import type { TFunction } from './index'

/** ⚠️ FALLBACK 同步责任：见 videoTypeOptions.ts 头部说明 / `doubanStatus.*` i18n 词条 */
const DOUBAN_STATUS_FALLBACK_LABEL: Record<DoubanStatus, string> = {
  pending: '待匹配',
  matched: '已匹配',
  candidate: '候选',
  unmatched: '未匹配',
}

export function getDoubanStatusOptions(t?: TFunction): readonly AdminSelectOption<DoubanStatus>[] {
  return DOUBAN_STATUSES.map((value) => ({
    value,
    label: t ? t(`doubanStatus.${value}`) : DOUBAN_STATUS_FALLBACK_LABEL[value],
  }))
}
