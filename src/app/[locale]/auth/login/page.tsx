/**
 * /[locale]/auth/login — 登录页
 */

import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { LoginForm } from '@/components/auth/LoginForm'

export default function LoginPage() {
  const t = useTranslations('auth.login')

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: 'var(--background)' }}
    >
      <div
        className="w-full max-w-md rounded-xl p-8 shadow-sm border"
        style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
      >
        {/* Logo */}
        <div className="mb-8 text-center">
          <h1
            className="text-2xl font-bold tracking-tight mb-1"
            style={{ color: 'var(--gold)' }}
          >
            Resovo
          </h1>
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
            {t('subtitle')}
          </p>
        </div>

        <h2
          className="text-lg font-semibold mb-6"
          style={{ color: 'var(--foreground)' }}
        >
          {t('title')}
        </h2>

        <LoginForm />

        <p
          className="mt-6 text-center text-sm"
          style={{ color: 'var(--muted-foreground)' }}
        >
          {t('noAccount')}{' '}
          <Link
            href="/auth/register"
            className="font-medium hover:opacity-80 transition-opacity"
            style={{ color: 'var(--gold)' }}
          >
            {t('registerLink')}
          </Link>
        </p>
      </div>
    </div>
  )
}
