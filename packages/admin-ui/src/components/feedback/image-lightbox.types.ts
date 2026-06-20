/**
 * image-lightbox.types.ts — ImageLightbox 共享组件 Props 契约
 *
 * 真源：IMGH-P1-3（SEQ-20260619-01）· arch-reviewer (claude-opus-4-8) CONDITIONAL PASS 设计
 *
 * 用途：全屏遮罩放大查看一张图片 + 元信息诊断面板（来源 / 状态 / 破损信息 / 尺寸 / URL 复制）。
 *   首个消费方 = image-health 破损样本缩略（点击放大）；破损图 URL 多失效 → 须降级占位 + 尺寸 '—'。
 *
 * 与 overlay 原语关系（包壳 compose，对齐 RejectModal/LineHealthDrawer 先例）：
 *   - 内部复用 admin-ui `useOverlay`（focus trap / Esc / scroll lock）+ `OverlayBackdrop`（token 化遮罩 + z-index）
 *   - **不复用 `Modal`**：Modal 的 size≤800px / 固定 padding / header-body 二段布局不匹配「全屏看图 + 元信息」双区结构
 *   - 受控：`open` 由消费方持有；本组件不持有 open
 *   - 零后端改动：尺寸由内部 `<img onLoad>` 读 naturalWidth/Height（后端 DTO 无此字段，硬约束）
 *
 * 扩展边界（防未来误改）：
 *   (a) 未来多图轮播（stills）应作外层 `ImageGallery` 包壳本组件，**不得**把 `src: string` 改为数组破坏 3 消费方契约
 *   (b) `meta` 字段集本期冻结 P1 四字段；P2 的 `eventType` 精确破损原因明确推迟，不得提前纳入
 *
 * 消费方（≥3，Props 不耦合 image-health 的 MissingVideoRow）：
 *   1. image-health 破损样本（本期）  2. 视频编辑 TabImages 预览（未来）  3. 审核详情图片放大（未来）
 */

import type { ReactNode } from 'react'

/**
 * 图片状态枚举（image-health 域稳定语义；内部映射到 Pill variant）
 * ok → 'ok' / broken|missing → 'danger' / pending_review → 'warn' / low_quality → 'info'
 */
export type ImageStatus = 'ok' | 'broken' | 'missing' | 'pending_review' | 'low_quality'

/** 图片自然尺寸自测结果（组件内部 onLoad 读取后回传给消费方，可选监听） */
export interface ImageNaturalSize {
  /** `<img>.naturalWidth` */
  readonly width: number
  /** `<img>.naturalHeight` */
  readonly height: number
}

/**
 * 元信息诊断面板字段（全部可选；P1 收敛后形态，禁止扩张到 P2 的 eventType）
 * 注意：所有文本须由消费方传入「已格式化字符串」（i18n / 时间格式不下沉组件）。
 */
export interface ImageLightboxMeta {
  /** 来源标识，如 'tmdb' / 'douban' / 'crawler' / 'manual'（原样展示，不下沉枚举映射） */
  readonly source?: string
  /** 图片状态；提供时内部渲染 Pill；与 statusSlot 互斥（同传时 statusSlot 优先 + dev warn） */
  readonly status?: ImageStatus
  /** 破损域名（如 image.tmdb.org）；展示在破损信息区 */
  readonly brokenDomain?: string
  /** 破损发生次数；与 brokenDomain 同区展示；P2 的精确 eventType 不在本期 */
  readonly occurrenceCount?: number
}

/**
 * ImageLightbox Props — 全屏图片放大 + 元信息诊断面板
 */
export interface ImageLightboxProps {
  /** 弹层开关（受控，对齐 Modal/RejectModal/LineHealthDrawer） */
  readonly open: boolean

  /** 关闭回调；Esc / 遮罩点击 / 关闭按钮触发 */
  readonly onClose: () => void

  /**
   * 原始图片 URL。
   * - null / 空 → 直接进入「无图」降级态（不渲染 `<img>`，显示占位）
   * - 非空但加载失败 → onError 进入「加载失败」降级态（占位 + 尺寸 '—'）
   */
  readonly src: string | null

  /** 图片 alt（信息性 a11y 文本）；src 非空但缺失时 dev warn */
  readonly alt?: string

  /** 标题（可选）；展示在元信息面板顶部，并作为 dialog aria-label 来源 */
  readonly title?: string

  /** 元信息诊断字段集（可选）；与 metaSlot 互斥（同传 metaSlot 优先 + dev warn） */
  readonly meta?: ImageLightboxMeta

  /**
   * 元信息面板完全接管逃生口（可选）。
   * 传入时忽略 meta 的内置渲染，整块面板由消费方提供（差异极大的未来消费方用）。
   */
  readonly metaSlot?: ReactNode

  /** status 渲染逃生口（可选）；传入时覆盖 meta.status 的内置 Pill 渲染 */
  readonly statusSlot?: ReactNode

  /**
   * URL 复制行为（可选）。
   * - 省略 → 组件内置复制（navigator.clipboard.writeText(src)）+ 内置「已复制」瞬时反馈
   * - 提供 → 由消费方接管复制（如需 toast / 埋点）
   * 内置复制失败时静默降级 + dev warn（clipboard 在非安全上下文不可用），不抛裸 Error
   */
  readonly onCopyUrl?: (url: string) => void

  /**
   * 自然尺寸读取回调（可选）。
   * 组件内部 onLoad 读到 naturalWidth/Height 后回传；消费方一般无需监听（组件自身已展示尺寸）。
   */
  readonly onNaturalSize?: (size: ImageNaturalSize) => void

  /** Esc 关闭（默认 true，透传 useOverlay） */
  readonly closeOnEscape?: boolean

  /** 遮罩点击关闭（默认 true，透传 useOverlay） */
  readonly closeOnBackdropClick?: boolean

  /** 尺寸不可读时的占位文本（默认 '—'）；不下沉 i18n */
  readonly dimensionFallbackText?: string

  /** 测试钩子（落到 dialog 容器 data-testid，对齐 feedback 层 testId 约定） */
  readonly testId?: string
}
