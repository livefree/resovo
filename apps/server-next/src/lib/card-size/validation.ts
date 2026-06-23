/**
 * card-size/validation.ts — 卡片尺寸表单校验边界（ADR-214 D-214-10 + Amendment A1 客户端镜像）
 *
 * 真源在服务端：`apps/api/src/services/CardSizeService.ts` CardSizeBodySchema
 *   （cardWidthPx int [120,400] / gapPx int [0,64]）外加 DB CHECK（migration 124+125）。
 *
 * Amendment A1：单位统一为卡宽（standard size-driven / scroll 横滚同构）；desktopColumns 列数护栏
 *   本轮不暴露编辑（D-214-A1-4），不在可编辑边界内。
 *
 * 本文件以 **plain 常量镜像** 这批边界供 admin 表单即时反馈，
 * **不引入 zod**（server-next 无 zod 依赖；沿用 sibling tab inline 校验约定，避免技术栈外依赖）。
 * 提交仍由服务端 zod `.strict()` + DB CHECK 422 兜底为准——镜像漂移仅退化为"服务端报错"体验。
 */

/** 各可编辑字段的整数范围（镜像服务端 zod min/max） */
export const CARD_SIZE_BOUNDS = {
  /** 卡片宽度 px（standard size-driven / scroll 横滚，全档同构） */
  cardWidthPx: { min: 120, max: 400 },
  /** 卡间距 px（全档通用） */
  gapPx: { min: 0, max: 64 },
} as const

export type CardSizeField = keyof typeof CARD_SIZE_BOUNDS

/**
 * 校验单字段：整数 + 范围。
 * @returns 通过返回 null；失败返回中文错误文案（供 AdminInput error 态 + hint 展示）。
 */
export function validateCardSizeField(field: CardSizeField, value: number): string | null {
  const { min, max } = CARD_SIZE_BOUNDS[field]
  if (!Number.isInteger(value)) return '必须为整数'
  if (value < min || value > max) return `范围 ${min}–${max}`
  return null
}
