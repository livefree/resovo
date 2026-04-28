export default function ForbiddenPage() {
  return (
    <main style={{ display: 'grid', placeItems: 'center', minHeight: '100vh', padding: 'var(--space-5)' }}>
      <article style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: 'var(--font-size-2xl)', margin: '0 0 var(--space-3)' }}>403 · 无权访问</h1>
        <p style={{ color: 'var(--fg-muted)', margin: 0 }}>当前账户无权访问该后台模块。</p>
        <p style={{ color: 'var(--fg-muted)', marginTop: 'var(--space-3)', fontSize: 'var(--font-size-sm)' }}>
          ADR-010 后台入口与角色权限：user 角色拒绝进入 admin。
        </p>
      </article>
    </main>
  )
}
