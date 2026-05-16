/**
 * CodeText Props — 表格内单字段 monospace 文本
 *
 * 起源 / 真源：CHG-SN-6-RETRO-3-C / arch-reviewer Opus 1 轮 PASS 起草
 *
 * 消费方场景（≥ 3）：
 *   - /admin/audit actionType 列
 *   - /admin/audit requestId 列
 *   - 任何 migration id / job id / 短 hash / api endpoint 单字段 monospace 展示
 *
 * 视觉规格：
 *   - font-family: var(--font-mono)
 *   - font-size: var(--font-size-xs)
 *   - color: muted=true → var(--fg-muted) / false → var(--fg-default)
 *
 * data-* 反查：消费方传 `dataAttr={{ 'data-xxx': value }}` 注入；
 * 不内置默认 data-* 避免与消费方语义冲突。
 */
export interface CodeTextProps {
  /** 文本内容；null/undefined 时渲染 fallback */
  readonly value: string | null | undefined

  /** value 为空时的 fallback（默认 '—'，i18n 由消费方决定） */
  readonly fallback?: string

  /** 是否 muted 配色（默认 false） */
  readonly muted?: boolean

  /**
   * 消费方注入的 data-* 属性（透传到 `<code>` 根节点）
   * 例: `{ 'data-action-type': value }` / `{ 'data-request-id': value }`
   */
  readonly dataAttr?: Readonly<Record<`data-${string}`, string>>

  /** 测试钩子 */
  readonly testId?: string

  /** 自定义 className */
  readonly className?: string
}
