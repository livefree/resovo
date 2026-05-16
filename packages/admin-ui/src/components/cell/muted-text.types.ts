/**
 * MutedText Props — 表格内灰色 muted 长文本 + 兜底
 *
 * 起源 / 真源：CHG-SN-6-RETRO-3-C / arch-reviewer Opus 1 轮 PASS 起草
 *
 * 消费方场景（≥ 3）：
 *   - /admin/audit payloadSummary 列
 *   - 视频库 description 列预览
 *   - 评论审核 comment 摘要 / 注释列
 *
 * 视觉规格：
 *   - font-size: var(--font-size-xs)
 *   - color: var(--fg-muted)
 *   - clamp=1 → 单行截断（white-space: nowrap + text-overflow: ellipsis）
 *   - clamp>1 → 多行 line-clamp（-webkit-line-clamp）
 *
 * 状态职责：仅渲染；不内置 tooltip（v1 不内置）
 */
export interface MutedTextProps {
  /** 文本内容；null/undefined/空字符串 → 渲染 fallback */
  readonly value: string | null | undefined

  /** value 为空时的 fallback（默认 '—'，i18n 由消费方决定） */
  readonly fallback?: string

  /** 行数（默认 1）；0 或负数视为 1 */
  readonly clamp?: number

  /** 消费方注入的 data-* 属性 */
  readonly dataAttr?: Readonly<Record<`data-${string}`, string>>

  /** 测试钩子 */
  readonly testId?: string

  /** 自定义 className */
  readonly className?: string
}
