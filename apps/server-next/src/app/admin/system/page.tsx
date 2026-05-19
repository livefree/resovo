/**
 * /admin/system — 永久重定向到顶级 `/admin/settings`（ADR-125 D3）。
 *
 * IA 收敛：M-SN-7 REDO-03-A 移除 system landing 占位，直接落到 Settings 顶级。
 */
import { permanentRedirect } from 'next/navigation'

export default function SystemLandingPage() {
  permanentRedirect('/admin/settings')
}
