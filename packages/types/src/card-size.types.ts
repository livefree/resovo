/**
 * card-size.types.ts — 前台卡片尺寸体系契约（ADR-214 + Amendment A1）
 *
 * DB 单真源：card_size_settings（migration 124 建表 + 125 size-driven 翻转）。
 * 本文件提供 TS 侧读写契约 + 兜底默认真源。
 *
 * 2 档封闭枚举（D-214-2 / Amendment A1 D-214-A1-3 废弃 compact）：
 *   新增/退役档位必须走 ADR-214 amendment + migration，不得在消费端临时扩值（与 HomeSectionKey 同款约束）。
 *
 * 统一单位「卡宽 px」（Amendment A1 D-214-A1-1/4/5，翻转原 D-214-4 混合单位）：
 *   - standard 档（网格）：存 cardWidthPx（卡片目标/最小宽度 px）——CSS `auto-fill + minmax` 派生列数，
 *     运营设卡宽、列数随容器宽自动算（size-driven）；desktopColumns 退化为可选最大列数护栏（NULLABLE，本轮 null）。
 *   - scroll 档（横滚行）：存 cardWidthPx（横滚定宽 px）——横滚无列概念、本就固定宽度。
 * DB 侧由 card_size_settings_size_unit_check 强制全档 cardWidthPx 非空 [120,400] + desktopColumns 可空护栏 [2,8]。
 */

/** 卡片尺寸档位（封闭枚举 2 值，D-214-2 / Amendment A1 废弃 compact） */
export type CardSizeClass =
  | 'standard' // 首页 featured/分类网格（size-driven：设卡宽 px + gap，列数容器派生）
  | 'scroll' // 首页横滚行（卡定宽 px + gap）

export const CARD_SIZE_CLASSES: readonly CardSizeClass[] = ['standard', 'scroll']

/**
 * card_size_settings 行（migration 124 + 125）。
 * 全档 cardWidthPx 非空（DB CHECK + NOT NULL 保证；TS 仍宽松 number|null 兼容 SSR 降级合成与 UpdateInput）；
 * desktopColumns 为可选最大列数护栏（NULLABLE，本轮恒 null）。
 */
export interface CardSizeSettings {
  /** UUID PK（audit card_size.update 的 target_id 锚点，仿 home_section D-182-5.3） */
  id: string
  sizeClass: CardSizeClass
  /** 可选最大列数护栏 [2,8]；本轮恒 null（列数由容器宽派生，D-214-A1-4） */
  desktopColumns: number | null
  /** 卡片目标/最小宽度 px [120,400]，全档非空（D-214-A1-1/5；DB 层 NOT NULL 保证） */
  cardWidthPx: number | null
  /** 卡间距 px [0,64] */
  gapPx: number
  /** 非关键扩展项（样式/文案 override）；禁关键策略字段（ADR-052/182 metadata 守则同款） */
  settings: Record<string, unknown>
  updatedAt: string
}

/**
 * PUT /admin/card-sizes/:sizeClass body 的字段子集（≥1 字段，CARD-SIZE-SERVICE-ADMIN 落 zod）。
 * sizeClass 不可改（业务键 + UNIQUE）；范围由 DB CHECK + zod 双层守。
 */
export interface UpdateCardSizeSettingsInput {
  desktopColumns?: number | null
  cardWidthPx?: number | null
  gapPx?: number
  /** JSONB 整体替换（非深合并，与 ADR-104 metadata 同语义） */
  settings?: Record<string, unknown>
}

/** 单档默认尺寸（CARD_SIZE_DEFAULTS 元素结构） */
export interface CardSizeDefault {
  desktopColumns: number | null
  cardWidthPx: number | null
  gapPx: number
}

/**
 * 卡片尺寸兜底默认真源（D-214-5）。
 *
 * 用途：① 前端 SSR 取数失败降级（CARD-SIZE-SSR catch 分支）；② token 兜底引用。
 * 与 migration 124+125 SQL 字面量 seed 由一致性单测守同步
 * （migration 纯 SQL 不能 import TS → seed 写字面量，单测断言「124 INSERT 经 125 演进后的净 seed 态 == 本常量」，防双源漂移）。
 *
 * 值必须满足 size_unit_check：全档 cardWidthPx 非空 [120,400]、desktopColumns 可空护栏。
 */
export const CARD_SIZE_DEFAULTS: Record<CardSizeClass, CardSizeDefault> = {
  standard: { desktopColumns: null, cardWidthPx: 200, gapPx: 16 },
  scroll: { desktopColumns: null, cardWidthPx: 170, gapPx: 16 },
}
