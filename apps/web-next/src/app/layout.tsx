import type { Metadata } from 'next'
import './globals.css'
import { DEFAULT_BRAND_NAME } from '@/lib/brand-detection'

export const metadata: Metadata = {
  title: DEFAULT_BRAND_NAME,
  description: `${DEFAULT_BRAND_NAME} — 视频聚合索引`,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return children
}
