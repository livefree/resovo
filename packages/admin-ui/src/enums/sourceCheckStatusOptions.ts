import { SOURCE_CHECK_STATUSES, type SourceCheckStatus } from '@resovo/types'
import type { AdminSelectOption } from '../components/admin-select/admin-select'
import type { TFunction } from './index'

/** ⚠️ FALLBACK 同步责任：见 videoTypeOptions.ts 头部说明 / `sourceCheckStatus.*` i18n 词条 */
const SOURCE_CHECK_STATUS_FALLBACK_LABEL: Record<SourceCheckStatus, string> = {
  pending: '待检验',
  ok: '全部正常',
  partial: '部分失效',
  all_dead: '全部失效',
}

export function getSourceCheckStatusOptions(t?: TFunction): readonly AdminSelectOption<SourceCheckStatus>[] {
  return SOURCE_CHECK_STATUSES.map((value) => ({
    value,
    label: t ? t(`sourceCheckStatus.${value}`) : SOURCE_CHECK_STATUS_FALLBACK_LABEL[value],
  }))
}
