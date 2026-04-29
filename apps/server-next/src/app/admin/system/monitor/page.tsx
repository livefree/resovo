import { redirect } from 'next/navigation'

export default function SystemMonitorPage() {
  redirect('/admin/system/settings?tab=monitor')
}
