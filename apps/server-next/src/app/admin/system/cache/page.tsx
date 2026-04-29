import { redirect } from 'next/navigation'

export default function SystemCachePage() {
  redirect('/admin/system/settings?tab=cache')
}
