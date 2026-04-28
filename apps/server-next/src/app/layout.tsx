import { cookies, headers } from 'next/headers'
import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import {
  COOKIE_BRAND,
  COOKIE_THEME,
  DEFAULT_BRAND_SLUG,
  HEADER_THEME,
  parseBrandSlug,
  parseTheme,
} from '@/lib/brand-detection'
import { BrandProvider } from '@/contexts/BrandProvider'
import type { Brand } from '@/types/brand'
import './globals.css'

export const metadata: Metadata = {
  title: 'Resovo Admin',
  description: 'Resovo 后台管理',
}

const DEFAULT_BRAND: Brand = {
  id: '00000000-0000-0000-0000-000000000000',
  slug: DEFAULT_BRAND_SLUG,
  name: 'Resovo',
  overrides: {},
  createdAt: new Date(0),
  updatedAt: new Date(0),
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies()
  const headerStore = await headers()
  const brandSlug = parseBrandSlug(cookieStore.get(COOKIE_BRAND)?.value)
  const initialTheme = parseTheme(headerStore.get(HEADER_THEME) ?? cookieStore.get(COOKIE_THEME)?.value)
  const initialBrand: Brand = { ...DEFAULT_BRAND, slug: brandSlug }

  return (
    <html lang="zh-CN" data-brand={brandSlug} data-theme={initialTheme === 'system' ? 'dark' : initialTheme}>
      <body>
        <BrandProvider initialBrand={initialBrand} initialTheme={initialTheme}>
          {children}
        </BrandProvider>
      </body>
    </html>
  )
}
