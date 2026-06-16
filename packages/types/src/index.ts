export * from './api-errors'
export type * from './api.types'
export type * from './banner.types'
export type * from './home-module.types'
// ADR-182 / CHG-HOME-PREVIEW-API-A：type + 常量数组 value export（HOME_SECTION_KEYS / HOME_AUTOFILL_MODES）
export * from './home-section.types'
// ADR-185 / CHG-HOME-DRAFT-PUBLISH-A：发布治理（HOME_PUBLISH_SOURCES 常量 value export）
export * from './home-publish.types'
export type * from './home.types'
export type * from './user.types'
// ADR-165 / CHG-SN-9-ROUTE-LABEL-D-A1：runtime exports（zod schema + 常量 + helper）
export {
  CUSTOM_THEME_CONSTRAINTS,
  CustomThemeDataSchema,
  RouteThemePreferenceSchema,
  UserPreferencesSchema,
  UserPreferencesStrictSchema,
  UserPreferencesPatchSchema,
  canAccessAdmin,
  canManageSystem,
  canModerate,
} from './user.types'
export type * from './video.types'
export type * from './search.types'
export type * from './list.types'
export type * from './player.types'

export type * from './crawler.types'
export type * from './system.types'
export type * from './external.types'
// ADR-188 D-188-2 / CHG-EXT-RES-STORE-A：provider registry runtime exports（const + helper，非 type-only）
export {
  PROVIDER_KEYS,
  ACQUISITION_METHODS,
  PROVIDER_CAPABILITIES,
  EXTERNAL_PROVIDERS,
  getExternalProvider,
} from './external.types'
export type * from './integration-credentials.types'
// ADR-173 D-173-2：provider 凭证注册表 runtime exports（const + helper，非 type-only）
export { PROVIDER_CREDENTIAL_SPECS, getProviderCredentialSpec } from './integration-credentials.types'

export type * from './admin-moderation.types'
// SEARCH-01 / ADR-200：后台全局搜索统一结果 DTO（GET /admin/search）
export type * from './admin-search.types'
// SEARCH-03-PRE-IMPL / D-200-10：kind 枚举 const（value 导出，`export type *` 不带 const）
export { ADMIN_SEARCH_KINDS } from './admin-search.types'
// CHG-360-A / ADR-159：runtime helper（非 type-only）
export { deriveAggregateState } from './admin-moderation.types'
// MODUX-P3-1-A：富集状态枚举 const（value 导出，`export type *` 不带 const）
export { ENRICHMENT_STATUSES } from './admin-moderation.types'
export type * from './video-merge.types'
export type * from './identity-evidence.types'
export type * from './identity-decision.types'
export type * from './sources-matrix.types'
// CHG-VSR-1（2026-06-01 / ADR-157 D-157-1 双形态）：sources-matrix 枚举 const 值再导出（type-only export 不透出 const）
export { SOURCE_QUICK_FILTERS, SOURCE_PROBLEM_KINDS, NEEDS_SOURCE_SEVERITIES } from './sources-matrix.types'
// CHG-368-B-A1 / ADR-164 D-164-10：codename 字库 50 山名常量（runtime export / 非 type-only）
export { MOUNTAIN_CODENAMES, MOUNTAIN_CODENAMES_COUNT } from './route-codenames'
export type * from './admin-audit.types'
export type * from './admin-shell.types'
// ADR-190 / NTLG-P0-1：侧边栏导航计数聚合 DTO
export type * from './admin-nav-counts.types'
export type * from './dashboard'

export { DEFAULT_INGEST_POLICY, MASK_PREFIX, SECRET_KEY_PATTERNS, isSecretSettingKey } from './system.types'

// ── ADR-157 D-157-1 视频枚举值常量（双形态，12 enum 全集 P0/P1/P2）─
export {
  VIDEO_TYPES, VIDEO_GENRES, VIDEO_STATUSES, REVIEW_STATUSES,
  VISIBILITY_STATUSES, CONTENT_FORMATS, EPISODE_PATTERNS, TRENDING_TAGS,
  DOUBAN_STATUSES, SOURCE_CHECK_STATUSES, VIDEO_QUALITIES, SOURCE_TYPES,
  DOUBAN_MATCH_METHODS, DOUBAN_MATCH_STATUSES,
  BANGUMI_STATUSES,
  EXTERNAL_REF_PROVIDERS, EXTERNAL_REF_MATCH_STATUSES,
  AUDIO_LANGUAGE_SOURCES, SUBTITLE_LANGUAGE_SOURCES,
} from './video.types'

// ── ADR-201 / META-32-A 统一元数据状态契约（类型 + 枚举双形态）─────
export type * from './metadata-status.types'
export {
  METADATA_PROVIDERS, METADATA_PROVIDER_ORDER, METADATA_STATUS_OVERALLS,
  METADATA_PROVIDER_STATES, METADATA_ISSUE_LEVELS, METADATA_NEXT_ACTIONS,
  // META-36-C：「已匹配源」过滤值域哨兵 + 全集（value re-export，type-only `export type *` 不透出 const）
  METADATA_MATCHED_NONE, METADATA_MATCHED_FILTER_VALUES,
} from './metadata-status.types'

// ── ADR-157 D-157-1 类型守卫工具 ────────────────────────────────
export * from './utils/exhaustive'

// ── ADR-160 D-160-7 跨 app URL 派生 helper（CHG-361-A）──────────
export { getVideoDetailHref } from './url-helpers'

// ── plan §10.4.3 国家代码显示 helper（CHG-366 META-COUNTRY-DISPLAY）─
export { formatCountryName } from './format-country-name'

// ── country 归一真源（META-40，与 format-country-name 构成双向真源）─
export { countryToIso, COUNTRY_NAME_TO_ISO } from './country-to-iso'
