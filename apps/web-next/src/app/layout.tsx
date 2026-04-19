import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Resovo',
  description: 'Resovo — 流光视频索引',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return children
}
