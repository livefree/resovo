'use client'

import { useState } from 'react'

const COLORS = {
  gray: {
    0: 'oklch(100% 0 0)',
    50: 'oklch(98.5% 0.002 247)',
    100: 'oklch(96.8% 0.004 247)',
    200: 'oklch(92.9% 0.006 247)',
    300: 'oklch(86.9% 0.009 247)',
    400: 'oklch(70.8% 0.012 247)',
    500: 'oklch(55.4% 0.014 247)',
    600: 'oklch(43.9% 0.014 247)',
    700: 'oklch(32.8% 0.012 247)',
    800: 'oklch(23.0% 0.010 247)',
    900: 'oklch(16.5% 0.008 247)',
    950: 'oklch(11.2% 0.006 247)',
    1000: 'oklch(6.5% 0.004 247)',
  },
  accent: {
    100: 'oklch(92.0% 0.045 230)',
    300: 'oklch(78.0% 0.110 230)',
    500: 'oklch(64.5% 0.165 230)',
    700: 'oklch(52.0% 0.155 230)',
    900: 'oklch(38.0% 0.120 230)',
  },
}

const SPACE: Record<string, string> = {
  px: '1px',
  '0': '0',
  '0.5': '0.125rem',
  '1': '0.25rem',
  '2': '0.5rem',
  '3': '0.75rem',
  '4': '1rem',
  '6': '1.5rem',
  '8': '2rem',
  '12': '3rem',
  '16': '4rem',
}

const RADIUS: Record<string, string> = {
  none: '0',
  sm: '0.25rem',
  md: '0.5rem',
  lg: '0.75rem',
  xl: '1rem',
  full: '9999px',
}

const SHADOW: Record<string, string> = {
  none: 'none',
  sm: '0 1px 2px 0 rgb(0 0 0 / 0.45), 0 0 0 1px rgb(255 255 255 / 0.04)',
  md: '0 4px 6px -1px rgb(0 0 0 / 0.5), 0 2px 4px -2px rgb(0 0 0 / 0.3)',
  lg: '0 10px 15px -3px rgb(0 0 0 / 0.55), 0 4px 6px -4px rgb(0 0 0 / 0.35)',
  xl: '0 20px 25px -5px rgb(0 0 0 / 0.6), 0 8px 10px -6px rgb(0 0 0 / 0.4)',
}

const TYPOGRAPHY = {
  fontSize: {
    xs: '0.75rem',
    sm: '0.875rem',
    base: '1rem',
    lg: '1.125rem',
    xl: '1.25rem',
    '2xl': '1.5rem',
    '3xl': '1.875rem',
    '4xl': '2.25rem',
    '5xl': '3rem',
  },
  lineHeight: {
    tight: '1.15',
    snug: '1.3',
    normal: '1.5',
    relaxed: '1.65',
    loose: '1.85',
  },
  fontWeight: {
    light: '300',
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
}

const MOTION = {
  duration: {
    instant: '0ms',
    fast: '120ms',
    base: '200ms',
    slow: '320ms',
    slower: '480ms',
    slowest: '720ms',
  },
  easing: {
    linear: 'linear',
    'ease-in': 'cubic-bezier(0.4, 0, 1, 1)',
    'ease-out': 'cubic-bezier(0, 0, 0.2, 1)',
    'ease-in-out': 'cubic-bezier(0.4, 0, 0.2, 1)',
    spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  },
}

const Z_INDEX: Record<string, number> = {
  base: 0,
  dropdown: 1000,
  sticky: 1100,
  overlay: 1200,
  modal: 1300,
  popover: 1400,
  tooltip: 1500,
  toast: 1600,
  player: 1700,
}

function ColorSwatch({ name, value }: { name: string; value: string }) {
  return (
    <div className="flex items-center gap-2 py-0.5">
      <div
        className="w-5 h-5 rounded border shrink-0"
        style={{ backgroundColor: value, borderColor: 'var(--border-subtle)' }}
      />
      <span className="text-xs font-mono truncate" style={{ color: 'var(--fg-muted)' }}>
        {name}
      </span>
      <span className="text-xs font-mono ml-auto truncate" style={{ color: 'var(--fg-subtle)' }}>
        {value}
      </span>
    </div>
  )
}

function TokenRow({ name, value }: { name: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-0.5 gap-2">
      <span className="text-xs font-mono" style={{ color: 'var(--fg-muted)' }}>
        {name}
      </span>
      <span className="text-xs font-mono" style={{ color: 'var(--fg-subtle)' }}>
        {value}
      </span>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true)
  return (
    <div className="mb-4">
      <button
        onClick={() => setOpen((p) => !p)}
        className="w-full flex items-center gap-1 text-xs font-semibold mb-2 text-left"
        style={{ color: 'var(--fg-default)' }}
      >
        <span>{open ? '▾' : '▸'}</span>
        {title}
      </button>
      {open && <div>{children}</div>}
    </div>
  )
}

export function PrimitivePanel() {
  return (
    <div>
      <Section title="Colors">
        {Object.entries(COLORS).map(([scale, steps]) => (
          <div key={scale} className="mb-2">
            <p className="text-xs font-medium mb-1 capitalize" style={{ color: 'var(--fg-subtle)' }}>
              {scale}
            </p>
            {Object.entries(steps).map(([step, value]) => (
              <ColorSwatch key={step} name={`${scale}.${step}`} value={value} />
            ))}
          </div>
        ))}
      </Section>

      <Section title="Space">
        {Object.entries(SPACE).map(([key, value]) => (
          <TokenRow key={key} name={`space.${key}`} value={value} />
        ))}
      </Section>

      <Section title="Radius">
        {Object.entries(RADIUS).map(([key, value]) => (
          <TokenRow key={key} name={`radius.${key}`} value={value} />
        ))}
      </Section>

      <Section title="Shadow">
        {Object.entries(SHADOW).map(([key, value]) => (
          <TokenRow key={key} name={`shadow.${key}`} value={value} />
        ))}
      </Section>

      <Section title="Typography">
        {Object.entries(TYPOGRAPHY).map(([group, values]) => (
          <div key={group} className="mb-2">
            <p className="text-xs font-medium mb-1" style={{ color: 'var(--fg-subtle)' }}>
              {group}
            </p>
            {Object.entries(values).map(([key, value]) => (
              <TokenRow key={key} name={`${group}.${key}`} value={value} />
            ))}
          </div>
        ))}
      </Section>

      <Section title="Motion">
        {Object.entries(MOTION).map(([group, values]) => (
          <div key={group} className="mb-2">
            <p className="text-xs font-medium mb-1" style={{ color: 'var(--fg-subtle)' }}>
              {group}
            </p>
            {Object.entries(values).map(([key, value]) => (
              <TokenRow key={key} name={`motion.${group}.${key}`} value={value} />
            ))}
          </div>
        ))}
      </Section>

      <Section title="Z-Index">
        {Object.entries(Z_INDEX).map(([key, value]) => (
          <TokenRow key={key} name={`zIndex.${key}`} value={String(value)} />
        ))}
      </Section>
    </div>
  )
}
