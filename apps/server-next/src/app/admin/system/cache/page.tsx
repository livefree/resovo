/**
 * /admin/system/cache — 永久重定向到 `/admin/settings?tab=cache`（ADR-125 D2）。
 */
import { permanentRedirect } from 'next/navigation'

export default function SystemCachePage() {
  permanentRedirect('/admin/settings?tab=cache')
}
