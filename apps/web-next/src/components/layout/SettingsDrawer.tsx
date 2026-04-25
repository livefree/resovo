'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useTheme } from '@/hooks/useTheme'
import type { Theme } from '@/types/brand'

/**
 * SettingsDrawer — HANDOFF-26 右侧划入设置抽屉。
 *
 * z-index: var(--z-overlay) = 80，高于 --z-mini-player(50) 和 --z-full-player(70)。
 * 主题选择：Light/Dark/System → useTheme().setTheme()（写 Cookie，更新 BrandProvider context）。
 * 动效强度：0/1/1.5 → document.documentElement.style.setProperty('--motion-scale', val)
 *   + localStorage 持久化（SSR 安全：所有 localStorage 访问加 typeof window !== 'undefined' 守卫）。
 * ESC / 遮罩点击关闭。
 */

const MOTION_STORAGE_KEY = 'resovo:motion-scale'
const MOTION_VALUES = [0, 1, 1.5] as const
type MotionIndex = 0 | 1 | 2

function readMotionIndex(): MotionIndex {
  if (typeof window === 'undefined') return 1
  const stored = localStorage.getItem(MOTION_STORAGE_KEY)
  if (stored === null) return 1
  const val = parseFloat(stored)
  const idx = MOTION_VALUES.indexOf(val as (typeof MOTION_VALUES)[number])
  return (idx >= 0 ? idx : 1) as MotionIndex
}

function applyMotionScale(index: MotionIndex): void {
  if (typeof window === 'undefined') return
  const val = MOTION_VALUES[index]
  document.documentElement.style.setProperty('--motion-scale', String(val))
  localStorage.setItem(MOTION_STORAGE_KEY, String(val))
}

interface SettingsDrawerProps {
  open: boolean
  onClose: () => void
}

export function SettingsDrawer({ open, onClose }: SettingsDrawerProps) {
  const t = useTranslations('settings')
  const { theme, setTheme } = useTheme()
  const [motionIndex, setMotionIndex] = useState<MotionIndex>(1)

  // 从 localStorage 读取 motionScale（客户端 mount 后）
  useEffect(() => {
    const idx = readMotionIndex()
    setMotionIndex(idx)
    applyMotionScale(idx)
  }, [])

  // ESC 关闭
  useEffect(() => {
    if (!open) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  function handleMotionChange(e: React.ChangeEvent<HTMLInputElement>) {
    const idx = Number(e.target.value) as MotionIndex
    setMotionIndex(idx)
    applyMotionScale(idx)
  }

  const THEME_OPTIONS: { value: Theme; label: string }[] = [
    { value: 'light',  label: t('themeLight')  },
    { value: 'dark',   label: t('themeDark')   },
    { value: 'system', label: t('themeSystem') },
  ]

  const MOTION_LABELS = [t('motionNone'), t('motionNormal'), t('motionHigh')]

  return (
    <>
      {/* 遮罩层 */}
      <div
        aria-hidden="true"
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'var(--overlay-bg)',
          zIndex: 'var(--z-overlay)',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
          transition: 'opacity 200ms ease',
        }}
      />

      {/* 抽屉面板 */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('title')}
        data-testid="settings-drawer"
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: '320px',
          zIndex: 'var(--z-overlay)',
          background: 'var(--bg-surface)',
          borderLeft: '1px solid var(--border-default)',
          boxShadow: 'var(--shadow-drawer)',
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto',
          transform: open ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 240ms cubic-bezier(0.32, 0.72, 0, 1)',
        }}
      >
        {/* 头部 */}
        <div
          className="flex items-center justify-between"
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-default)',
            flexShrink: 0,
          }}
        >
          <h2
            style={{ fontSize: '16px', fontWeight: 700, color: 'var(--fg-default)', margin: 0 }}
          >
            {t('title')}
          </h2>
          <button
            type="button"
            aria-label="关闭设置"
            onClick={onClose}
            style={{
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'transparent',
              border: 'none',
              borderRadius: '6px',
              color: 'var(--fg-muted)',
              cursor: 'pointer',
              fontSize: '18px',
              lineHeight: 1,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--bg-surface-sunken)'
              e.currentTarget.style.color = 'var(--fg-default)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.color = 'var(--fg-muted)'
            }}
          >
            ✕
          </button>
        </div>

        {/* 内容区 */}
        <div className="flex flex-col" style={{ padding: '20px', gap: '28px', flex: 1 }}>

          {/* 主题选择 */}
          <section>
            <h3
              style={{
                fontSize: '13px',
                fontWeight: 600,
                color: 'var(--fg-muted)',
                marginBottom: '10px',
                letterSpacing: '0.04em',
              }}
            >
              {t('theme')}
            </h3>
            <div className="flex" style={{ gap: '8px' }}>
              {THEME_OPTIONS.map(({ value, label }) => {
                const active = theme === value
                return (
                  <button
                    key={value}
                    type="button"
                    data-testid={`settings-theme-${value}`}
                    onClick={() => setTheme(value)}
                    style={{
                      flex: 1,
                      padding: '8px 0',
                      fontSize: '13px',
                      fontWeight: active ? 700 : 500,
                      borderRadius: '8px',
                      border: `1px solid ${active ? 'var(--accent-default)' : 'var(--border-default)'}`,
                      background: active ? 'var(--accent-muted)' : 'transparent',
                      color: active ? 'var(--accent-default)' : 'var(--fg-muted)',
                      cursor: 'pointer',
                      transition: 'all 150ms ease',
                    }}
                    onMouseEnter={(e) => {
                      if (!active) {
                        e.currentTarget.style.background = 'var(--bg-surface-sunken)'
                        e.currentTarget.style.color = 'var(--fg-default)'
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!active) {
                        e.currentTarget.style.background = 'transparent'
                        e.currentTarget.style.color = 'var(--fg-muted)'
                      }
                    }}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          </section>

          {/* 动效强度 */}
          <section>
            <h3
              style={{
                fontSize: '13px',
                fontWeight: 600,
                color: 'var(--fg-muted)',
                marginBottom: '10px',
                letterSpacing: '0.04em',
              }}
            >
              {t('motionScale')}
            </h3>
            <input
              type="range"
              min="0"
              max="2"
              step="1"
              value={motionIndex}
              onChange={handleMotionChange}
              aria-label={t('motionScale')}
              data-testid="settings-motion-slider"
              style={{ width: '100%', accentColor: 'var(--accent-default)', cursor: 'pointer' }}
            />
            <div
              className="flex justify-between"
              style={{ marginTop: '6px' }}
            >
              {MOTION_LABELS.map((label, i) => (
                <span
                  key={i}
                  style={{
                    fontSize: '12px',
                    color: motionIndex === i ? 'var(--accent-default)' : 'var(--fg-subtle)',
                    fontWeight: motionIndex === i ? 600 : 400,
                  }}
                >
                  {label}
                </span>
              ))}
            </div>
          </section>

          {/* 其余配置项：即将推出占位 */}
          {['语言偏好', '字幕设置', '播放器默认'].map((name) => (
            <section key={name}>
              <h3
                style={{
                  fontSize: '13px',
                  fontWeight: 600,
                  color: 'var(--fg-muted)',
                  marginBottom: '8px',
                  letterSpacing: '0.04em',
                }}
              >
                {name}
              </h3>
              <div
                style={{
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1px dashed var(--border-default)',
                  fontSize: '12px',
                  color: 'var(--fg-subtle)',
                  textAlign: 'center',
                }}
              >
                {t('comingSoon')}
              </div>
            </section>
          ))}

        </div>
      </div>
    </>
  )
}
