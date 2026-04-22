import { cookies } from 'next/headers'
import { NextIntlClientProvider } from 'next-intl'
import { getMessages } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { RoutePlayerSync } from './_lib/route-player-sync'
import { routing } from '@/i18n/routing'
import { parseBrandSlug, parseTheme, DEFAULT_BRAND_SLUG } from '@/lib/brand-detection'
import { BrandProvider } from '@/contexts/BrandProvider'
import { Nav } from '@/components/layout/Nav'
import { Footer } from '@/components/layout/Footer'
import { MobileTabBar } from '@/components/layout/MobileTabBar'
import { ScrollRestoration } from '@/components/primitives/scroll-restoration/ScrollRestoration'
import { RouteStack } from '@/components/primitives/route-stack/RouteStack'
import GlobalPlayerHost from './_lib/player/GlobalPlayerHost'
import type { Brand } from '@/types/brand'

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }))
}

const DEFAULT_BRAND: Brand = {
  id: '00000000-0000-0000-0000-000000000000',
  slug: DEFAULT_BRAND_SLUG,
  name: 'Resovo',
  overrides: {},
  createdAt: new Date(0),
  updatedAt: new Date(0),
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
  const cookieStore = await cookies()
  const brandSlug = parseBrandSlug(cookieStore.get('resovo-brand')?.value)
  const initialTheme = parseTheme(cookieStore.get('resovo-theme')?.value)

  const initialBrand: Brand = { ...DEFAULT_BRAND, slug: brandSlug }

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <BrandProvider initialBrand={initialBrand} initialTheme={initialTheme}>
        <div className="app-shell">
          <Nav />
          <ScrollRestoration />
          <RouteStack rootPathname={`/${locale}`}>
            <main id="main-content" className="main-slot">
              {children}
            </main>
          </RouteStack>
          <MobileTabBar />
          <div id="global-player-host-portal" data-testid="global-player-host" />
          <GlobalPlayerHost />
          <RoutePlayerSync />
          <Footer />
        </div>
      </BrandProvider>
    </NextIntlClientProvider>
  )
}
