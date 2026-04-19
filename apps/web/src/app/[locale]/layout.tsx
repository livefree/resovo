import { headers } from 'next/headers'
import { NextIntlClientProvider } from 'next-intl'
import { getMessages } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { routing } from '@/i18n/routing'
import { BrandProvider } from '@/contexts/BrandProvider'
import { HEADER_BRAND, HEADER_THEME, parseBrandSlug, parseTheme } from '@/lib/brand-detection'
import type { Brand, Theme } from '@/types/brand'

// 默认品牌常量（与 packages/design-tokens/src/brands/default.ts 保持同步）
// TOKEN-14 起将从 DB 动态加载非默认品牌
const RESOVO_DEFAULT_BRAND: Brand = {
  id: '00000000-0000-0000-0000-000000000000',
  slug: 'resovo',
  name: 'Resovo',
  overrides: {},
  createdAt: new Date(0),
  updatedAt: new Date(0),
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }))
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params

  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) {
    notFound()
  }

  const messages = await getMessages()
  const reqHeaders = await headers()

  const _brandSlug = parseBrandSlug(reqHeaders.get(HEADER_BRAND) ?? undefined)
  const theme = parseTheme(reqHeaders.get(HEADER_THEME) ?? undefined) as Theme

  // TOKEN-14 起：非默认品牌从 /api/brands/:slug 加载；当前仅支持默认品牌
  const initialBrand: Brand = RESOVO_DEFAULT_BRAND

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <BrandProvider initialBrand={initialBrand} initialTheme={theme}>
        {children}
      </BrandProvider>
    </NextIntlClientProvider>
  )
}
