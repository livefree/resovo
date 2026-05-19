/**
 * /admin/system/settings — 永久重定向到顶级 `/admin/settings`（ADR-125 D1/D5）。
 *
 * IA 收敛：M-SN-7 REDO-03-A 将 Settings 提升为顶级路由，旧 URL 走 308 兜底。
 */
import { permanentRedirect } from 'next/navigation'

export default function LegacySystemSettingsPage() {
  permanentRedirect('/admin/settings')
}
