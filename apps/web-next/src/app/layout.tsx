import type { Metadata } from 'next'
import { getLocale } from 'next-intl/server'
import './globals.css'
import { DEFAULT_BRAND_NAME } from '@/lib/brand-detection'
import { THEME_INIT_SCRIPT } from '@/lib/theme-init-script'

export const metadata: Metadata = {
  title: DEFAULT_BRAND_NAME,
  description: `${DEFAULT_BRAND_NAME} — 视频聚合索引`,
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale()
  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        {/* eslint-disable-next-line react/no-danger */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        {children}
      </body>
    </html>
  )
}
