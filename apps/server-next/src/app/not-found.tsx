import Link from 'next/link'

export default function NotFound() {
  return (
    <main style={{ display: 'grid', placeItems: 'center', minHeight: '100vh', padding: 'var(--space-5)' }}>
      <article style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: 'var(--font-size-2xl)', margin: '0 0 var(--space-3)' }}>404 · 页面不存在</h1>
        <p style={{ color: 'var(--fg-muted)', margin: 0 }}>请求的路径不在 IA v1 路由树内。</p>
        <p style={{ marginTop: 'var(--space-4)' }}>
          <Link href="/admin" style={{ color: 'var(--accent-default)' }}>
            返回管理台站
          </Link>
        </p>
      </article>
    </main>
  )
}
