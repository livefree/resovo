import { type CSSProperties } from 'react'
import { AdminCard } from '@resovo/admin-ui'

const KPI_LABEL_STYLE: CSSProperties = {
  fontSize: 'var(--font-size-xs)',
  color: 'var(--fg-muted)',
  marginBottom: '8px',
}

const KPI_VALUE_STYLE: CSSProperties = {
  fontSize: 'var(--font-size-xl, 20px)',
  fontWeight: 600,
  color: 'var(--fg-default)',
}

const KPI_SUB_STYLE: CSSProperties = {
  fontSize: 'var(--font-size-xs)',
  color: 'var(--fg-muted)',
  marginTop: '4px',
}

export interface KpiCardProps {
  readonly label: string
  readonly value: string | number
  readonly sub?: string
  readonly 'data-testid'?: string
}

export function KpiCard({ label, value, sub, 'data-testid': testId }: KpiCardProps) {
  return (
    <AdminCard surface="plain" padding="md" data-testid={testId}>
      <div style={KPI_LABEL_STYLE}>{label}</div>
      <div style={KPI_VALUE_STYLE}>{value}</div>
      {sub ? <div style={KPI_SUB_STYLE}>{sub}</div> : null}
    </AdminCard>
  )
}
