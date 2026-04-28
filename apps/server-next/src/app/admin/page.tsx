import { PlaceholderPage } from '@/components/PlaceholderPage'

export default function DashboardPage() {
  return (
    <PlaceholderPage
      title="管理台站 · Dashboard"
      milestone="M-SN-2 起填充关键运营指标卡片；M-SN-3 承接 analytics 内容（IA v1 折叠，详见 ADR-100 IA 修订段）"
      note={<p style={{ margin: 0, color: 'var(--fg-muted)' }}>Hello server-next</p>}
    />
  )
}
