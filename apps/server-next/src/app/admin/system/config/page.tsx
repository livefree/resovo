/**
 * /admin/system/config — 永久重定向到 `/admin/settings?tab=config`（ADR-125 D2）。
 */
import { permanentRedirect } from 'next/navigation'

export default function SystemConfigPage() {
  permanentRedirect('/admin/settings?tab=config')
}
