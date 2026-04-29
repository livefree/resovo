/**
 * /admin/analytics — redirect 到 dashboard 分析 Tab（ADR-100 IA 修订段 IA-2）
 *
 * URL 保留（plan §5.2 BLOCKER 第 8 条），但内容合并至 /admin?tab=analytics。
 */
import { redirect } from 'next/navigation'

export default function AnalyticsPage() {
  redirect('/admin?tab=analytics')
}
