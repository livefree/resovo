import { Suspense } from 'react'
import { LoginForm } from './LoginForm'

export default function LoginPage() {
  return (
    <main style={{ display: 'grid', placeItems: 'center', minHeight: '100vh', padding: 'var(--space-5)' }}>
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </main>
  )
}
