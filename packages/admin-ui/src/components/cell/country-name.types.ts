/**
 * country-name.types.ts — CountryName Props 契约（CHG-366 / plan §10.4.3）
 *
 * 真源约束：consume `formatCountryName` from `@resovo/types`；本组件仅 React wrapper，
 * 不重复实现 ISO → 本地化映射逻辑。
 */

export interface CountryNameProps {
  /** ISO 3166-1 alpha-2 code（'US' / 'CN' / 'JP' / ...）；null/undefined/空串 → 显示 fallback */
  readonly code: string | null | undefined
  /**
   * 本地化区域。`'zh-CN'`（默认） → "美国"；`'en'` → "United States"。
   * 当前 admin / web-next 默认 `'zh-CN'`；多语言切换由消费方传入。
   */
  readonly locale?: string
  /** 空 / 无效 code 时显示的占位（默认 `'—'`） */
  readonly fallback?: string
  /** 是否使用 muted token 色（默认 `false`，与现有 cell 范式一致） */
  readonly muted?: boolean
  /** 测试钩子 */
  readonly testId?: string
  readonly className?: string
}
