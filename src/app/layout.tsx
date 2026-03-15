import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Resovo | 流光',
  description: '国际化视频资源聚合索引平台',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
