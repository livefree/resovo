import type { Metadata } from 'next'
import { ModerationConsole } from './_client/ModerationConsole'

export const metadata: Metadata = {
  title: '内容审核台 | Resovo Admin',
}

export default function ModerationPage() {
  return <ModerationConsole />
}
