import { redirect } from 'next/navigation'

export default function SystemConfigPage() {
  redirect('/admin/system/settings?tab=config')
}
