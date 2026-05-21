/**
 * content-ref-picker.types.ts — ContentRefPicker 复合业务原语类型定义
 *
 * 真源：CHG-SN-8-FUP-HOME / arch-reviewer Opus A− PASS（2026-05-21）
 *
 * 核心约束：
 *   - 与 @resovo/types HomeModuleContentRefType 字符串值对齐但物理解耦（ADR-103b 同范式）
 *   - 外部受控（不内置 type tab；消费方用 AdminSelect 控制 type）
 *   - 不接收 multiple（首页模块单值；多值场景另起 ContentRefMultiPicker）
 *   - videoFetcher / videoTypeOptions 注入避免业务字面量泄漏到 admin-ui
 */

import type { ReactNode } from 'react'
import type { AdminSelectOption } from '../admin-select/admin-select'
import type { VideoPickerFetcher } from './video-picker.types'

// ── ContentRefType（与 @resovo/types HomeModuleContentRefType 字符串对齐）────

export type ContentRefType = 'video' | 'external_url' | 'custom_html' | 'video_type'

// ── Props ──────────────────────────────────────────────────────────

export interface ContentRefPickerProps {
  // 核心受控
  readonly type: ContentRefType
  readonly value: string
  readonly onChange: (next: string) => void

  // 类型专属注入
  readonly videoFetcher?: VideoPickerFetcher
  readonly videoTypeOptions?: readonly AdminSelectOption[]

  // 通用表单
  readonly disabled?: boolean
  readonly required?: boolean
  /** 外部错误文案（与内部 URL 校验内联错误并存且不冲突） */
  readonly error?: string
  readonly label?: ReactNode
  readonly placeholder?: string

  // a11y / 测试
  readonly id?: string
  readonly 'aria-label'?: string
  readonly 'aria-describedby'?: string
  readonly 'data-testid'?: string
}
