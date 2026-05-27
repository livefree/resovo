import { REVIEW_STATUSES, type ReviewStatus } from '@resovo/types'
import type { AdminSelectOption } from '../components/admin-select/admin-select'
import type { TFunction } from './index'

/** ⚠️ FALLBACK 同步责任：见 videoTypeOptions.ts 头部说明 / `reviewStatus.*` i18n 词条 */
const REVIEW_STATUS_FALLBACK_LABEL: Record<ReviewStatus, string> = {
  pending_review: '待审核',
  approved: '已通过',
  rejected: '已拒绝',
}

export function getReviewStatusOptions(t?: TFunction): readonly AdminSelectOption<ReviewStatus>[] {
  return REVIEW_STATUSES.map((value) => ({
    value,
    label: t ? t(`reviewStatus.${value}`) : REVIEW_STATUS_FALLBACK_LABEL[value],
  }))
}
