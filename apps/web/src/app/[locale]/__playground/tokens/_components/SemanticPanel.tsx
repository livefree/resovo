'use client'

import { useTheme } from '@/hooks/useTheme'
import type { bg, fg, border, accent, state, surface } from '@resovo/design-tokens'

type SemanticData = {
  bg: typeof bg
  fg: typeof fg
  border: typeof border
  accent: typeof accent
  state: typeof state
  surface: typeof surface
}

function SwatchRow({ label, value, cssVar }: { label: string; value: string; cssVar?: string }) {
  return (
    <div className="flex items-center gap-2 py-0.5">
      <div
        className="w-5 h-5 rounded border shrink-0"
        style={{
          backgroundColor: cssVar ? `var(${cssVar})` : value,
          borderColor: 'var(--border-subtle)',
        }}
      />
      <span className="text-xs font-mono truncate" style={{ color: 'var(--fg-muted)' }}>
        {label}
      </span>
      <span className="text-xs font-mono ml-auto shrink-0" style={{ color: 'var(--fg-subtle)' }}>
        {cssVar ?? value.slice(0, 28)}
      </span>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <h3 className="text-xs font-semibold mb-2" style={{ color: 'var(--fg-default)' }}>
        {title}
      </h3>
      {children}
    </div>
  )
}

export function SemanticPanel({ data }: { data: SemanticData }) {
  const { resolvedTheme } = useTheme()
  const t = resolvedTheme

  return (
    <div>
      <Section title="Background">
        {(Object.entries(data.bg[t]) as [string, string][]).map(([key, value]) => (
          <SwatchRow key={key} label={`bg.${key}`} value={value} cssVar={`--bg-${camel2kebab(key)}`} />
        ))}
      </Section>

      <Section title="Foreground">
        {(Object.entries(data.fg[t]) as [string, string][]).map(([key, value]) => (
          <div key={key} className="flex items-center justify-between py-0.5 gap-2">
            <span className="text-xs font-mono" style={{ color: `var(--fg-${camel2kebab(key)})` }}>
              fg.{key}
            </span>
            <span className="text-xs font-mono" style={{ color: 'var(--fg-subtle)' }}>
              {value.slice(0, 28)}
            </span>
          </div>
        ))}
      </Section>

      <Section title="Accent">
        {(Object.entries(data.accent[t]) as [string, string][]).map(([key, value]) => (
          <SwatchRow key={key} label={`accent.${key}`} value={value} cssVar={`--accent-${key}`} />
        ))}
      </Section>

      <Section title="Border">
        {(Object.entries(data.border[t]) as [string, string][]).map(([key, value]) => (
          <SwatchRow key={key} label={`border.${key}`} value={value} cssVar={`--border-${camel2kebab(key)}`} />
        ))}
      </Section>

      <Section title="State">
        {(Object.entries(data.state[t]) as [string, Record<string, string>][]).map(([kind, slots]) => (
          <div key={kind} className="mb-2">
            <p className="text-xs font-medium mb-1 capitalize" style={{ color: 'var(--fg-subtle)' }}>
              {kind}
            </p>
            {(Object.entries(slots) as [string, string][]).map(([slot, value]) => (
              <SwatchRow
                key={slot}
                label={`state.${kind}.${slot}`}
                value={value}
                cssVar={`--state-${kind}-${slot}`}
              />
            ))}
          </div>
        ))}
      </Section>

      <Section title="Surface">
        {(Object.entries(data.surface[t]) as [string, string][]).map(([key, value]) => (
          <SwatchRow key={key} label={`surface.${key}`} value={value} cssVar={`--surface-${camel2kebab(key)}`} />
        ))}
      </Section>

      <div
        className="mt-6 rounded p-4 border"
        style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-default)' }}
      >
        <p className="text-xs font-semibold mb-3" style={{ color: 'var(--fg-default)' }}>
          Live Preview
        </p>
        <div className="flex gap-2 flex-wrap">
          <button
            className="px-3 py-1.5 rounded text-xs font-medium"
            style={{ backgroundColor: 'var(--accent-default)', color: 'var(--accent-fg)' }}
          >
            Primary
          </button>
          <button
            className="px-3 py-1.5 rounded text-xs font-medium border"
            style={{
              backgroundColor: 'var(--bg-surface)',
              color: 'var(--fg-default)',
              borderColor: 'var(--border-default)',
            }}
          >
            Secondary
          </button>
          <button
            className="px-3 py-1.5 rounded text-xs font-medium"
            style={{ backgroundColor: 'var(--state-error-bg)', color: 'var(--state-error-fg)' }}
          >
            Destructive
          </button>
        </div>
        <input
          className="mt-3 w-full text-xs px-2 py-1.5 rounded border outline-none"
          placeholder="Input example..."
          style={{
            backgroundColor: 'var(--bg-canvas)',
            color: 'var(--fg-default)',
            borderColor: 'var(--border-default)',
          }}
        />
      </div>
    </div>
  )
}

function camel2kebab(s: string): string {
  return s.replace(/([A-Z])/g, '-$1').toLowerCase()
}
