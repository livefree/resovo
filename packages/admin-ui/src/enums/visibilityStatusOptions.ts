import { VISIBILITY_STATUSES, type VisibilityStatus } from '@resovo/types'
import type { AdminSelectOption } from '../components/admin-select/admin-select'
import type { TFunction } from './index'

/** ⚠️ FALLBACK 同步责任：见 videoTypeOptions.ts 头部说明 / `visibilityStatus.*` i18n 词条 */
const VISIBILITY_STATUS_FALLBACK_LABEL: Record<VisibilityStatus, string> = {
  public: '公开',
  internal: '内部',
  hidden: '隐藏',
}

export function getVisibilityStatusOptions(t?: TFunction): readonly AdminSelectOption<VisibilityStatus>[] {
  return VISIBILITY_STATUSES.map((value) => ({
    value,
    label: t ? t(`visibilityStatus.${value}`) : VISIBILITY_STATUS_FALLBACK_LABEL[value],
  }))
}
