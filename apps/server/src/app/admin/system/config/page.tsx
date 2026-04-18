/**
 * /admin/system/config — 307 重定向到采集控制台设置 Tab
 * CHG-169: 配置文件已迁移至 /admin/crawler?tab=settings
 */

import { redirect } from 'next/navigation'

export default function AdminConfigFilePage() {
  redirect('/admin/crawler?tab=settings')
}
