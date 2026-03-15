/**
 * /[locale]/auth/register — 注册页
 */

import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { RegisterForm } from '@/components/auth/RegisterForm'

export default function RegisterPage() {
  const t = useTranslations('auth.register')

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

        <RegisterForm />

        <p
          className="mt-6 text-center text-sm"
          style={{ color: 'var(--muted-foreground)' }}
        >
          {t('hasAccount')}{' '}
          <Link
            href="/auth/login"
            className="font-medium hover:opacity-80 transition-opacity"
            style={{ color: 'var(--gold)' }}
          >
            {t('loginLink')}
          </Link>
        </p>
      </div>
    </div>
  )
}
