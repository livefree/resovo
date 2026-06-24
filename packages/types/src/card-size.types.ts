/**
 * card-size.types.ts — 前台卡片尺寸体系契约（ADR-214 + Amendment A2）
 *
 * DB 单真源：card_size_settings（migration 124 建表 → 125 size-driven → 126 单一全局卡宽）。
 * 本文件提供 TS 侧读写契约 + 兜底默认真源。
 *
 * **单一全局卡宽（Amendment A2 D-214-A2-1，推翻 A1 分档）**：废弃 standard/scroll/compact 分档，
 *   全站所有卡片区域（网格 + 横滚）消费同一全局卡宽 `card_width_px` + `gap_px` → 视觉精确一致。
 *   `CardSizeClass` 收敛为单值 `'global'`（保留类型形状：复用 home_section 配置范式 + audit 行锚点 +
 *   ADR-215 端点 `:sizeClass` param 不变，D-214-A2-6 / Codex-A2-R5）。
 *   desktop_columns 列经 126 删除（A2 无列数概念，列数由 `auto-fill` 容器派生）。
 */

/** 卡片尺寸档位（Amendment A2 收敛为单值 'global'；保留类型以复用配置范式/audit 锚点/端点形状） */
export type CardSizeClass = 'global'

export const CARD_SIZE_CLASSES: readonly CardSizeClass[] = ['global']

/**
 * card_size_settings 行（migration 124 + 125 + 126；单行全局）。
 * cardWidthPx 非空（DB CHECK + NOT NULL 保证；TS 仍宽松 number|null 兼容 SSR 降级合成与 UpdateInput）。
 */
export interface CardSizeSettings {
  /** UUID PK（audit card_size.update 的 target_id 锚点，仿 home_section D-182-5.3） */
  id: string
  sizeClass: CardSizeClass
  /** 全站统一卡片宽度 px [120,400]，非空（D-214-A2-1/2；DB 层 NOT NULL 保证） */
  cardWidthPx: number | null
  /** 卡间距 px [0,64] */
  gapPx: number
  /** 非关键扩展项（样式/文案 override）；禁关键策略字段（ADR-052/182 metadata 守则同款） */
  settings: Record<string, unknown>
  updatedAt: string
}

/**
 * PUT /admin/card-sizes/:sizeClass body 的字段子集（≥1 字段，CardSizeService 落 zod）。
 * sizeClass 不可改（业务键 + UNIQUE）；范围由 DB CHECK + zod 双层守。
 */
export interface UpdateCardSizeSettingsInput {
  cardWidthPx?: number | null
  gapPx?: number
  /** JSONB 整体替换（非深合并，与 ADR-104 metadata 同语义） */
  settings?: Record<string, unknown>
}

/** 默认尺寸结构（CARD_SIZE_DEFAULTS 元素） */
export interface CardSizeDefault {
  cardWidthPx: number | null
  gapPx: number
}

/**
 * 卡片尺寸兜底默认真源（D-214-5）。
 *
 * 用途：① 前端 SSR 取数失败降级（CARD-SIZE-SSR catch 分支）；② token 兜底引用。
 * 与 migration 124→125→126 SQL 字面量 seed 由一致性单测守同步
 * （单测断言「124 INSERT 经 125+126 演进后的净 seed 态 == 本常量」，防双源漂移）。
 *
 * Amendment A2：单行全局，默认 W=160（手机 375 屏 2 列，D-214-A2-4）。
 */
export const CARD_SIZE_DEFAULTS: Record<CardSizeClass, CardSizeDefault> = {
  global: { cardWidthPx: 160, gapPx: 16 },
}
