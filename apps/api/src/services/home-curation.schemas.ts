/**
 * home-curation.schemas.ts — Home Curation 门面端点 zod schemas
 * （ADR-182 D-182-4；自 HomeCurationService.ts 拆出——file-size-budget 500 行硬限，
 * CHG-VSR-3 sources-matrix.schemas.ts 同先例 / CHG-HOME-AUTOFILL-APPLY）
 */

import { z } from 'zod'
import {
  HOME_SECTION_KEYS,
  HOME_AUTOFILL_MODES,
  type HomeSectionKey,
} from '@resovo/types'

export const SectionParamSchema = z.enum(
  HOME_SECTION_KEYS as [HomeSectionKey, ...HomeSectionKey[]],
)

/** PATCH settings body：.strict() partial + ≥1 字段（D-182-4 #3） */
export const UpdateSectionSettingsSchema = z.object({
  autofillMode: z.enum(HOME_AUTOFILL_MODES as [string, ...string[]]).optional(),
  refreshIntervalMinutes: z.number().int().min(1).nullable().optional(),
  displayCount: z.number().int().min(1).max(50).optional(),
  allowDuplicates: z.boolean().optional(),
  pinnedLimit: z.number().int().min(1).nullable().optional(),
  // JSONB 整体替换（非深合并，与 ADR-104 metadata 同语义）
  settings: z.record(z.unknown()).optional(),
}).strict().refine((v) => Object.keys(v).length > 0, { message: '至少一字段' })

/** POST reorder body（D-182-4 #6：≥1 ≤200；形态对齐 HomeModulesService.ReorderSchema） */
export const ReorderSectionSchema = z.object({
  items: z.array(z.object({
    id: z.string().uuid(),
    ordering: z.number().int().min(0),
  })).min(1).max(200),
}).strict()

/** GET /admin/home/preview query（D-182-4 #1；draft=true 草稿叠加 = ADR-182 #1
 * 显式预留的 Phase 4 兑现，additive 非 break——CHG-HOME-DRAFT-PUBLISH-B。
 * 布尔显式枚举防 z.coerce 把 'false' 判 true（CandidatesQuerySchema 同款） */
export const PreviewQuerySchema = z.object({
  brand_slug: z.string().min(1).max(64).optional(),
  locale: z.string().min(2).max(10).optional(),
  at: z.string().datetime().optional(),
  device: z.enum(['desktop', 'mobile']).default('desktop'),
  draft: z.enum(['true', 'false']).optional().transform((v) => v === 'true'),
})

/** GET autofill-candidates query（D-182-4 #4：limit ≤100 默认 50；布尔显式枚举防 z.coerce 把 'false' 判 true） */
export const CandidatesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  include_filtered: z.enum(['true', 'false']).optional()
    .transform((v) => v === 'true'),
})

/** POST apply-autofill body（D-182-4 #5：candidateIds ≥1；上限对齐候选池量级） */
export const ApplyAutofillSchema = z.object({
  candidateIds: z.array(z.string().uuid()).min(1).max(100),
}).strict()
