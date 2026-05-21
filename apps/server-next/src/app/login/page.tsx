import { Suspense } from 'react'
import { LoginForm } from './LoginForm'

export default function LoginPage() {
  return (
    <main
      style={{
        display: 'grid',
        placeItems: 'center',
        minHeight: '100vh',
        padding: '40px 16px',
        background:
          'radial-gradient(ellipse 80% 60% at 50% 0%, color-mix(in oklch, var(--accent-default) 12%, transparent), transparent)',
        backgroundColor: 'var(--bg-canvas)',
      }}
    >
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </main>
  )
}
