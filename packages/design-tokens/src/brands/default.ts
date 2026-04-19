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
