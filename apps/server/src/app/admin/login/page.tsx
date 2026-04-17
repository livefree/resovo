/**
 * /admin/login — 管理员登录页
 * DEC-07: 后台独立登录路由，复用 LoginForm，登录成功后通过 callbackUrl 跳转 /admin
 */

import { AdminLoginForm } from '@/components/auth/AdminLoginForm'

export default function AdminLoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden"
      style={{ background: 'var(--background)' }}
    >
      <div
        className="relative w-full max-w-md rounded-2xl p-8 md:p-10 shadow-2xl border backdrop-blur-xl z-10"
        style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
      >
        <div className="mb-8 text-center">
          <h1
            className="text-3xl font-extrabold tracking-tight mb-2"
            style={{ color: 'var(--accent)' }}
          >
            Resovo
          </h1>
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
            管理控制台
          </p>
        </div>

        <h2
          className="text-lg font-semibold mb-6"
          style={{ color: 'var(--foreground)' }}
        >
          管理员登录
        </h2>

        <AdminLoginForm />
      </div>
    </div>
  )
}
