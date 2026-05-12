/**
 * brand 文件命名约定（REG-M1-04-PREP）：
 *   - 默认品牌固定使用此文件，slug='resovo'，不新建 resovo.ts
 *   - 多品牌时在此目录添加 <slug>.ts，导出实现了 BrandOverrides 的对象
 *   - BrandOverrides 写回时以 overrides 字段 patch 到 defaultBrandOverrides
 *   - 禁止覆盖 primitive 顶层键（TS excess-property check 在编译期拦截）
 */
import type { Brand, BrandOverrides } from './types.js'

export const DEFAULT_BRAND_SLUG = 'resovo' as const
export const DEFAULT_BRAND_NAME = 'Resovo' as const

export const defaultBrandOverrides: BrandOverrides = Object.freeze({})

export const defaultBrand: Brand = Object.freeze({
  id: '00000000-0000-0000-0000-000000000000',
  slug: DEFAULT_BRAND_SLUG,
  name: DEFAULT_BRAND_NAME,
  overrides: defaultBrandOverrides,
  createdAt: new Date(0),
  updatedAt: new Date(0),
})
