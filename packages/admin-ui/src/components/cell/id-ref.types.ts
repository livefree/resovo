import type { ReactNode } from 'react'

/**
 * IdRef Props — 表格内 kind + id 双字段引用（id 短缩 + 批量兜底）
 *
 * 起源 / 真源：CHG-SN-6-RETRO-3-C / arch-reviewer Opus 1 轮 PASS 起草
 *
 * 消费方场景（≥ 3）：
 *   - /admin/audit target_kind + target_id（id null → "批量"）
 *   - 评论审核 video_id + kind / source_id + kind
 *   - merge candidates target_id + source_id
 *
 * 渲染规则：
 *   - id 非 null → `<code muted>kind</code> <span>{id.slice(0, idShortChars)}…</span>`
 *   - id 为 null → `<code muted>kind</code> <span muted>{batchFallback}</span>`
 *
 * 状态职责：仅渲染；不内置点击跳转（v1 不内置）
 */
export interface IdRefProps {
  /** 实体类型（如 'video' / 'source' / 'comment'）— monospace + muted code 前缀 */
  readonly kind: string

  /** 实体 id；null/undefined 触发 batchFallback */
  readonly id: string | null | undefined

  /**
   * id 短缩字符数（默认 8）
   * - 8 + "abcdef0123…" → "abcdef01…"
   * - 0 → 渲染完整 id（不截断；适合短 id）
   */
  readonly idShortChars?: number

  /** id 为 null 时的 fallback（默认 '—'，i18n 由消费方决定） */
  readonly batchFallback?: ReactNode

  /** 省略符号（默认 '…'） */
  readonly ellipsis?: string

  /** 测试钩子 */
  readonly testId?: string

  /** 自定义 className */
  readonly className?: string
}
