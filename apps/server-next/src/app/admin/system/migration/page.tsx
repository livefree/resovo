/**
 * /admin/system/migration — 永久重定向到 `/admin/settings?tab=migration`（ADR-125 D2）。
 */
import { permanentRedirect } from 'next/navigation'

export default function SystemMigrationPage() {
  permanentRedirect('/admin/settings?tab=migration')
}
