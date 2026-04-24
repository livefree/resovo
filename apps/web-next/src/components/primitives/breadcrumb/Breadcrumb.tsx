import Link from 'next/link'

export interface BreadcrumbItem {
  label: string
  href?: string
}

interface BreadcrumbProps {
  items: BreadcrumbItem[]
}

export function Breadcrumb({ items }: BreadcrumbProps) {
  return (
    <nav aria-label="breadcrumb">
      <ol
        style={{
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '4px',
          fontSize: '12px',
          listStyle: 'none',
          padding: 0,
          margin: '0 0 20px',
        }}
      >
        {items.map((item, i) => (
          <li key={i} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            {i > 0 && (
              <span aria-hidden style={{ color: 'var(--fg-subtle)', opacity: 0.5 }}>›</span>
            )}
            {item.href ? (
              <Link
                href={item.href}
                className="hover:underline"
                style={{ color: 'var(--fg-subtle)' }}
              >
                {item.label}
              </Link>
            ) : (
              <span aria-current="page" style={{ color: 'var(--fg-muted)' }}>
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}
