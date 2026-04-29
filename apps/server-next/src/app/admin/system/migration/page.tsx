import { redirect } from 'next/navigation'

export default function SystemMigrationPage() {
  redirect('/admin/system/settings?tab=migration')
}
