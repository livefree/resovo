import type { Metadata } from 'next'
import { getLocale } from 'next-intl/server'
import { Noto_Sans, Noto_Sans_SC } from 'next/font/google'
import './globals.css'
import { DEFAULT_BRAND_NAME } from '@/lib/brand-detection'
import { THEME_INIT_SCRIPT } from '@/lib/theme-init-script'

// CHORE-08: 字体族决策 = Noto Sans + Noto Sans SC（用户 2026-04-22）
// 使用 next/font/google 内建加载：自动 self-host、zero layout shift、display: swap
const notoSans = Noto_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  display: 'swap',
  variable: '--font-noto-sans',
})

const notoSansSC = Noto_Sans_SC({
  weight: ['400', '500', '700'],
  display: 'swap',
  variable: '--font-noto-sans-sc',
  preload: false, // SC 字体包较大，按需加载避免阻塞 LCP
})

export const metadata: Metadata = {
  title: DEFAULT_BRAND_NAME,
  description: `${DEFAULT_BRAND_NAME} — 视频聚合索引`,
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale()
  return (
    <html
      lang={locale}
      suppressHydrationWarning
      className={`${notoSans.variable} ${notoSansSC.variable}`}
    >
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
