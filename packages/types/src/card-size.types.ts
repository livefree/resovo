/**
 * card-size.types.ts — 前台卡片尺寸体系契约（ADR-214）
 *
 * DB 单真源：card_size_settings（migration 124，CARD-SIZE-DB ✅）。
 * 本文件提供 TS 侧读写契约 + 兜底默认真源。
 *
 * 3 档封闭枚举（D-214-2）：新增/退役档位必须走 ADR-214 amendment + migration，
 * 不得在消费端临时扩值（与 HomeSectionKey 同款约束）。
 *
 * 混合单位（D-214-4）：
 *   - 网格档（standard/compact）：存 desktopColumns（列数），cardWidthPx = null
 *     —— 卡宽由容器宽度 / 列数弹性派生，不写死。
 *   - scroll 档（横滚行）：存 cardWidthPx（定宽 px），desktopColumns = null
 *     —— 横滚无列概念，本就固定宽度。
 * DB 侧由 card_size_settings_unit_by_class_check 强制档位×单位绑定（Codex-R1 倒置行守卫）。
 */

/** 卡片尺寸档位（封闭枚举 3 值，D-214-2） */
export type CardSizeClass =
  | 'standard' // 首页 featured/分类 + 搜索结果网格（列数 + gap）
  | 'compact' // 详情侧栏相关推荐网格（列数 + gap，更密）
  | 'scroll' // 首页横滚行（卡定宽 px + gap）

export const CARD_SIZE_CLASSES: readonly CardSizeClass[] = ['standard', 'compact', 'scroll']

/**
 * card_size_settings 行（migration 124）。
 * desktopColumns / cardWidthPx 二者据档位互斥非空（DB CHECK 保证）：
 *   网格档 → desktopColumns 非空、cardWidthPx null；scroll → 反之。
 */
export interface CardSizeSettings {
  /** UUID PK（audit card_size.update 的 target_id 锚点，仿 home_section D-182-5.3） */
  id: string
  sizeClass: CardSizeClass
  /** 网格档（standard/compact）桌面列数 [2,8]；scroll 档 null */
  desktopColumns: number | null
  /** scroll 档横滚卡定宽 px [120,280]；网格档 null */
  cardWidthPx: number | null
  /** 卡间距 px [0,64] */
  gapPx: number
  /** 非关键扩展项（样式/文案 override）；禁关键策略字段（ADR-052/182 metadata 守则同款） */
  settings: Record<string, unknown>
  updatedAt: string
}

/**
 * PUT /admin/card-sizes/:sizeClass body 的字段子集（≥1 字段，CARD-SIZE-SERVICE-ADMIN 落 zod）。
 * sizeClass 不可改（业务键 + UNIQUE）；档位×单位绑定由 DB CHECK + zod 双层守。
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
 * 与 migration 124 SQL 字面量 seed 由一致性单测守同步
 * （migration 纯 SQL 不能 import TS → seed 写字面量，单测断言 SQL seed == 本常量，防双源漂移）。
 *
 * 值必须满足档位×单位绑定：网格档 desktopColumns 非空 / scroll cardWidthPx 非空。
 */
export const CARD_SIZE_DEFAULTS: Record<CardSizeClass, CardSizeDefault> = {
  standard: { desktopColumns: 5, cardWidthPx: null, gapPx: 16 },
  compact: { desktopColumns: 3, cardWidthPx: null, gapPx: 12 },
  scroll: { desktopColumns: null, cardWidthPx: 170, gapPx: 16 },
}
