/**
 * /admin/system/monitor — 永久重定向到 `/admin/settings?tab=monitor`（ADR-125 D2）。
 */
import { permanentRedirect } from 'next/navigation'

export default function SystemMonitorPage() {
  permanentRedirect('/admin/settings?tab=monitor')
}
