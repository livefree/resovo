/**
 * /admin/subtitles — 兼容旧入口，重定向到统一内容审核页
 * CHG-138
 */

import { redirect } from 'next/navigation'

export default function AdminSubtitlesPage() {
  redirect('/admin/content?tab=subtitles')
}
