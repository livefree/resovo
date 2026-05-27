/**
 * @resovo/admin-ui/src/enums — 视频枚举值 Option helpers
 * ADR-157 D-157-2：跨包 SSOT / 接受 i18n TFunction / fallback label 中文兜底
 *
 * 命名约定：getXxxOptions(t?: TFunction) → readonly AdminSelectOption<X>[]
 *   - 不传 t → 使用 hardcoded fallback label（中文 / server-next 未接入 i18n 时）
 *   - 传 t → 使用 i18n key `<enumName>.<value>` 如 `videoType.movie`
 *
 * 消费方迁移路径：
 *   - server-next：CHG-341 替换 4 处独立常量 → getVideoTypeOptions() 等
 *   - web-next：CHG-342 部分替换（仍保留 categories.ts ALL_CATEGORIES ADR-048）
 *   - server v1：不迁移（v1 维护期约束 / 仅 CHG-343 补 Genre 5 项）
 */

export type TFunction = (key: string) => string

export * from './videoTypeOptions'
export * from './videoGenreOptions'
export * from './videoStatusOptions'
export * from './reviewStatusOptions'
