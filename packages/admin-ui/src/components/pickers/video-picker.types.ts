/**
 * video-picker.types.ts — VideoPicker 业务原语类型定义
 *
 * 真源：M-SN-SHARED-04-A（CHG-SN-8 SEQ-20260521-02）
 *      arch-reviewer Opus 1 轮 A− PASS（2026-05-21）
 *
 * 核心约束：
 *   - admin-ui 共享层零 import apps/** 业务路径（ADR-103b）
 *   - 数据通过 props 注入（fetcher 函数）实现隔离
 *   - 单选/多选用 discriminated union（同 AdminSelect 已验证模式）
 *   - PickerVideoItem.type 用 string（VideoType 的超集，消费方无需 cast）
 */

import type { ReactNode } from 'react'

// ── Item shape（admin-ui 内部数据形，与业务 VideoType 解耦）─────────

export interface PickerVideoItem {
  readonly id: string // UUID PK；提交后端用
  readonly shortId: string // 人类可读短 ID；运营复述用
  readonly title: string
  readonly titleEn: string | null
  readonly type: string // VideoType 字面量；admin-ui 声明 string 保持解耦
  readonly year: number | null
  readonly coverUrl: string | null
  readonly isPublished: boolean
}

// ── Filter（外部锁定过滤条件，与搜索 q 叠加）────────────────────────

export interface VideoPickerFilter {
  readonly type?: string
  readonly status?: string // 'published' | 'pending' | 'all'
}

// ── Fetcher 注入契约 ────────────────────────────────────────────────

export interface VideoPickerFetchParams {
  readonly q: string
  readonly limit: number
  readonly cursor?: string
  readonly filter?: VideoPickerFilter
  readonly signal?: AbortSignal
}

export interface VideoPickerFetchResult {
  readonly items: readonly PickerVideoItem[]
  readonly nextCursor?: string
  readonly total?: number
}

export type VideoPickerFetcher = (
  params: VideoPickerFetchParams,
) => Promise<VideoPickerFetchResult>

// ── Props（discriminated union for single/multi）────────────────────

interface BaseVideoPickerProps {
  readonly fetcher: VideoPickerFetcher
  readonly filter?: VideoPickerFilter
  readonly disabled?: boolean
  readonly required?: boolean
  readonly error?: string
  readonly label?: ReactNode
  readonly placeholder?: string
  readonly dialogTitle?: ReactNode
  readonly id?: string
  readonly 'aria-label'?: string
  readonly 'aria-describedby'?: string
  readonly 'data-testid'?: string
}

export interface SingleVideoPickerProps extends BaseVideoPickerProps {
  readonly multiple?: false
  readonly value: PickerVideoItem | null
  readonly onChange: (next: PickerVideoItem | null) => void
}

export interface MultipleVideoPickerProps extends BaseVideoPickerProps {
  readonly multiple: true
  readonly value: readonly PickerVideoItem[]
  readonly onChange: (next: readonly PickerVideoItem[]) => void
  readonly max?: number
}

export type VideoPickerProps =
  | SingleVideoPickerProps
  | MultipleVideoPickerProps

// ── 内部状态机（仅供 dialog 实现内部使用，不公开 export）───────────

export type DialogState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'loading'; readonly cursor?: string }
  | { readonly kind: 'results'; readonly items: readonly PickerVideoItem[]; readonly nextCursor?: string }
  | { readonly kind: 'empty' }
  | { readonly kind: 'error'; readonly message: string }
