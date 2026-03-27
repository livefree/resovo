/**
 * /[locale]/auth/register — 注册页
 */

import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { RegisterForm } from '@/components/auth/RegisterForm'

export default function RegisterPage() {
  const t = useTranslations('auth.register')

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden">
      {/* Cinematic Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-black via-[#0a0a0a] to-[#050505]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(232,184,75,0.08)_0%,transparent_60%)]" />
      
      <div
        className="relative w-full max-w-md rounded-2xl p-8 md:p-10 shadow-2xl border border-white/10 backdrop-blur-xl bg-black/40 z-10"
      >
        {/* Logo */}
        <div className="mb-8 text-center">
          <h1
            className="text-3xl font-extrabold tracking-tight mb-2 drop-shadow-md"
            style={{ color: 'var(--accent)' }}
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
            className="font-bold hover:text-[var(--foreground)] transition-colors ml-1"
            style={{ color: 'var(--accent)' }}
          >
            {t('loginLink')}
          </Link>
        </p>
      </div>
    </div>
  )
}
