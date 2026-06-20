/**
 * image-compare.types.ts — ImageCompare 共享组件 Props 契约
 *
 * 真源：IMGH-P2-2A（SEQ-20260619-02 / ADR-208 + ADR-209）· arch-reviewer (claude-opus-4-8, agentId a9732b79ad7128d4d) 设计
 * 姊妹件：image-lightbox.types.ts（同 feedback/ 族，循其受控 open / onLoad 自测尺寸 / slot / dev warn / testId 范式）
 *
 * 用途：替换场景「当前图 vs 候选新图」并排对比，标注两侧 尺寸(naturalW×naturalH) / 比例(aspect) / 可达性。
 *   候选图须先通过「客户端探活 + 最小尺寸校验」后才允许「确认替换」，降低误替风险。
 *   首个消费方 = ImageGovernanceDrawer（server-next _client/，3A）替换封面区。
 *
 * 哑组件契约（对齐 lightbox 受控范式）：
 *   - 不直接调任何 API。onConfirm 仅回传"用户已确认替换 + 候选自测尺寸"，实际 apply-candidate 调用由消费方负责。
 *   - 受控：open 由消费方持有；本组件不持有 open。内嵌已开启的 Drawer 中时消费方常传恒 true。
 *   - 零后端改动：两侧尺寸均由组件内部 `<img onLoad>` 读 naturalWidth/Height（后端 DTO 无尺寸字段，硬约束，与 lightbox 同因）。
 *
 * 探活 + 尺寸校验裁定（arch-reviewer 裁定 A-1/A-2）：
 *   - 校验在组件内部做，不要求消费方传校验态（唯一信号源 = 候选 `<img onLoad/onError>`）。
 *   - 候选 onLoad 成功 = 探活通过；onError = 不可达（降级 + 禁用确认）。
 *   - onLoad 后比对 minWidth/minHeight（默认内置 DEFAULT_MIN_DIMENSION=200，可被 prop 覆盖，不写死业务值）。
 *   - 「确认替换」enabled ⇔ 候选 URL 非空 && onLoad 成功 && 通过最小尺寸校验。
 *
 * 扩展边界（防未来误改）：
 *   (a) 本期固定「双图并排」语义。未来"多候选轮播对比"应作外层 ImageCompareCarousel 包壳本组件，
 *       不得把 current/candidate 改为数组破坏契约。
 *   (b) 比例(aspect) 判定仅做"展示标注"，不纳入确认 enabled 闸门（aspect_mismatch 由后端健康巡检负责，
 *       前置硬阻断会误伤合法异比例图如 logo）。本期冻结此边界，不得提前把 aspect 纳入 confirm 闸门。
 *   (c) onConfirm 不携带 source/sourceRef —— 那是 apply 入参，归消费方从所选候选持有（见 ImageCandidatePicker §C 协同）。
 *
 * 消费方（≥3，Props 不耦合 image-health 业务 DTO）：
 *   1. ImageGovernanceDrawer 替换封面（本期）  2. 视频编辑 TabImages 替换预览（未来）  3. 审核详情图片改判对比（未来）
 */

import type { ReactNode } from 'react'
import type { ImageStatus, ImageNaturalSize } from './image-lightbox.types'

/** 默认最小尺寸阈值（px）；候选短边 < 此值视为尺寸不合格、禁用确认。可被 minWidth/minHeight 覆盖。 */
export const DEFAULT_MIN_DIMENSION = 200

/**
 * 单侧图片输入形态（current 与 candidate 共用）。
 * 尺寸不在此声明：两侧 naturalSize 均由组件内部 onLoad 自测（后端无尺寸 DTO，对齐 lightbox）。
 */
export interface ImageCompareSide {
  /**
   * 图片 URL。
   * - null / 空 → 该侧进入「无图」降级态（占位 + 尺寸 '—'）。candidate 侧为 null → 确认按钮恒禁用。
   * - 非空但加载失败 → onError 降级（占位 + 尺寸 '—'）；candidate 侧失败 → 确认禁用。
   */
  readonly url: string | null
  /** 该侧图片状态 Pill（可选）；提供时内部渲染 Pill，复用 lightbox 的 ImageStatus 枚举语义。 */
  readonly status?: ImageStatus
  /** 该侧标签文本（已格式化，i18n 不下沉），如 '当前' / '候选'；省略走内置默认。 */
  readonly label?: ReactNode
  /** alt（信息性 a11y）；url 非空但缺失时 dev warn（对齐 lightbox）。 */
  readonly alt?: string
}

/** onConfirm 回传载荷：确认替换时把候选已自测尺寸交回消费方（用于 toast / 审计展示）。 */
export interface ImageCompareConfirmPayload {
  /** 候选 url（非空时才可能 confirm，故此处恒为 string）。 */
  readonly candidateUrl: string
  /** 候选已自测自然尺寸（onLoad 读得；通过校验才可 confirm，故必存在）。 */
  readonly candidateSize: ImageNaturalSize
}

/** 候选客户端校验结果（onCandidateValidated 回传 / 组件内部驱动确认 enabled）。 */
export interface ImageCompareValidation {
  /** 探活：onLoad 成功 true / onError 或 url 空 false。 */
  readonly reachable: boolean
  /** 尺寸校验：reachable && naturalW≥minWidth && naturalH≥minHeight。 */
  readonly meetsMinDimension: boolean
  /** 探活通过时的自测尺寸；不可达 → null。 */
  readonly size: ImageNaturalSize | null
}

/**
 * ImageCompare Props — 当前图 vs 候选图并排对比 + 确认替换闸门
 */
export interface ImageCompareProps {
  /** 区块开关（受控，对齐 lightbox/Modal）。内嵌在已开启的 Drawer 中时消费方常传恒 true。 */
  readonly open: boolean

  /** 当前图（被替换方）。 */
  readonly current: ImageCompareSide

  /** 候选图（替换为）。candidate.url 为 null → 「待选图」占位 + 确认禁用。 */
  readonly candidate: ImageCompareSide

  /**
   * 确认替换回调。仅在 enabled（候选 url 非空 && onLoad 成功 && 通过最小尺寸校验）时可触发。
   * 组件保持哑：不调 API，仅回传候选 url + 自测尺寸；实际 apply-candidate 由消费方持有候选 source/sourceRef 后调用。
   */
  readonly onConfirm: (payload: ImageCompareConfirmPayload) => void

  /** 取消回调；取消按钮触发。 */
  readonly onCancel: () => void

  /** 候选最小宽度阈值（px，默认 DEFAULT_MIN_DIMENSION）；不下沉业务硬编码。 */
  readonly minWidth?: number

  /** 候选最小高度阈值（px，默认 DEFAULT_MIN_DIMENSION）。 */
  readonly minHeight?: number

  /**
   * 候选自测结果回调（可选）。组件内部 onLoad/onError + 尺寸校验后回传，
   * 供消费方监听（如禁用外部并行操作）；一般无需监听，组件自身已表达 enabled 态。
   */
  readonly onCandidateValidated?: (result: ImageCompareValidation) => void

  /** 确认按钮文本（已格式化，默认内置 '确认替换'）；i18n 不下沉。 */
  readonly confirmLabel?: ReactNode

  /** 取消按钮文本（默认内置 '取消'）。 */
  readonly cancelLabel?: ReactNode

  /**
   * 尺寸/比例标注区完全接管逃生口（可选）。
   * 传入时忽略内置两侧 尺寸/比例/可达性 标注，整块由消费方提供（差异极大的未来消费方用）。
   */
  readonly metaSlot?: ReactNode

  /** 尺寸不可读时占位文本（默认 '—'）；不下沉 i18n。 */
  readonly dimensionFallbackText?: string

  /** 测试钩子（落到容器 data-testid，对齐 feedback 层约定）。 */
  readonly testId?: string
}
