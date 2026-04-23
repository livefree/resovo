import type { Config } from 'tailwindcss'
import { colors } from './src/primitives/color.js'
import { space } from './src/primitives/space.js'
import { radius } from './src/primitives/radius.js'
import { shadow } from './src/primitives/shadow.js'
import { typography } from './src/primitives/typography.js'
import { motion } from './src/primitives/motion.js'
import { zIndex } from './src/primitives/z-index.js'

function spaceVar(key: string): string {
  return `var(--space-${key.replace('.', '-')})`
}

const colorExtensions = {
  gray: Object.fromEntries(
    Object.keys(colors.gray).map((k) => [k, `var(--color-gray-${k})`]),
  ),
  accent: {
    ...Object.fromEntries(
      Object.keys(colors.accent).map((k) => [k, `var(--color-accent-${k})`]),
    ),
    DEFAULT: 'var(--accent-default)',
    hover: 'var(--accent-hover)',
    active: 'var(--accent-active)',
    muted: 'var(--accent-muted)',
    fg: 'var(--accent-fg)',
  },
  bg: {
    canvas: 'var(--bg-canvas)',
    surface: 'var(--bg-surface)',
    'surface-raised': 'var(--bg-surface-raised)',
    'surface-sunken': 'var(--bg-surface-sunken)',
    overlay: 'var(--bg-overlay)',
  },
  fg: {
    DEFAULT: 'var(--fg-default)',
    muted: 'var(--fg-muted)',
    subtle: 'var(--fg-subtle)',
    'on-accent': 'var(--fg-on-accent)',
    disabled: 'var(--fg-disabled)',
  },
  border: {
    DEFAULT: 'var(--border-default)',
    strong: 'var(--border-strong)',
    subtle: 'var(--border-subtle)',
    focus: 'var(--border-focus)',
  },
  surface: {
    canvas: 'var(--surface-canvas)',
    surface: 'var(--surface-surface)',
    'surface-raised': 'var(--surface-surface-raised)',
    glass: 'var(--surface-glass)',
    scrim: 'var(--surface-scrim)',
  },
  state: {
    'success-bg': 'var(--state-success-bg)',
    'success-fg': 'var(--state-success-fg)',
    'success-border': 'var(--state-success-border)',
    'warning-bg': 'var(--state-warning-bg)',
    'warning-fg': 'var(--state-warning-fg)',
    'warning-border': 'var(--state-warning-border)',
    'error-bg': 'var(--state-error-bg)',
    'error-fg': 'var(--state-error-fg)',
    'error-border': 'var(--state-error-border)',
    'info-bg': 'var(--state-info-bg)',
    'info-fg': 'var(--state-info-fg)',
    'info-border': 'var(--state-info-border)',
  },
} as const

const designTokensPreset: Config = {
  theme: {
    extend: {
      colors: colorExtensions,
      spacing: Object.fromEntries(
        Object.keys(space).map((k) => [k, spaceVar(k)]),
      ),
      fontSize: Object.fromEntries(
        Object.entries(typography.fontSize).map(([k, v]) => [k, v]),
      ),
      fontFamily: {
        sans: typography.fontFamily.sans.split(',').map((s) => s.trim()),
        mono: typography.fontFamily.mono.split(',').map((s) => s.trim()),
      },
      borderRadius: Object.fromEntries(
        Object.entries(radius).map(([k, v]) => [k, v]),
      ),
      boxShadow: Object.fromEntries(
        Object.entries(shadow).map(([k, v]) => [k, v]),
      ),
      zIndex: Object.fromEntries(
        Object.entries(zIndex).map(([k, v]) => [k, String(v)]),
      ),
      transitionDuration: Object.fromEntries(
        Object.entries(motion.duration).map(([k, v]) => [k, v]),
      ),
      transitionTimingFunction: Object.fromEntries(
        Object.entries(motion.easing).map(([k, v]) => [k, v]),
      ),
      maxWidth: {
        shell:   'var(--layout-shell-max)',    // 1440px — Header / Footer / Shell 容器
        page:    'var(--layout-page-max)',     // 1280px — Browse / Search / 标准内容页
        feature: 'var(--layout-feature-max)', // 1200px — Home / Detail / Feature 型页面
        wide:    'var(--layout-wide-max)',     // 1600px — Watch 顶部播放器区
      },
    },
  },
}

export default designTokensPreset
