import type { ReactNode } from 'react'

/**
 * UserRef Props — 表格内 user 引用展示（id + username 双字段）
 *
 * 起源 / 真源：CHG-SN-6-RETRO-3-C / arch-reviewer Opus 1 轮 PASS 起草
 *
 * 消费方场景（≥ 3，沉淀阈值满足）：
 *   - /admin/audit actor 列（actor_id + actor_username）
 *   - /admin/moderation history reviewer 列
 *   - 视频 edit / staging 历史 created_by / updated_by
 *
 * 渲染规则：
 *   - username 非 null → 渲染 username 文本（fg-default）+ id 作 data-user-id 反查
 *   - username 为 null → 渲染 deletedFallback（消费方传 i18n），样式 muted
 *
 * 状态职责：纯渲染；不持有 hover popover / 跳转链接（v1 不内置）
 */
export interface UserRefProps {
  /** 用户 id（UUID / int），必填；作为 `data-user-id` 反查属性 */
  readonly id: string

  /** 用户名；null/undefined 时渲染 deletedFallback */
  readonly username: string | null | undefined

  /** 用户已删除 / 不存在时的 fallback 文案（默认 '—'，i18n 由消费方决定） */
  readonly deletedFallback?: ReactNode

  /** 字号变体（默认 'sm'） */
  readonly size?: 'xs' | 'sm'

  /** 测试钩子（默认 `data-testid="user-ref"`） */
  readonly testId?: string

  /** 自定义 className */
  readonly className?: string
}
