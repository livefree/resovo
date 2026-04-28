import { PlaceholderPage } from '@/components/PlaceholderPage'

export default function LoginPage() {
  return (
    <main style={{ display: 'grid', placeItems: 'center', minHeight: '100vh', padding: 'var(--space-5)' }}>
      <PlaceholderPage
        title="登录"
        milestone="CHG-SN-1-06（apiClient + 鉴权层接入；POST /v1/auth/login → 跳 /admin）"
      />
    </main>
  )
}
