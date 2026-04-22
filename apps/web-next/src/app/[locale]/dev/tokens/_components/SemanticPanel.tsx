'use client'

import { useEffect, useState } from 'react'

const CSS_VAR_GROUPS = {
  Background: [
    '--bg-canvas',
    '--bg-surface',
    '--bg-surface-raised',
    '--bg-surface-sunken',
    '--bg-overlay',
  ],
  Foreground: [
    '--fg-default',
    '--fg-muted',
    '--fg-subtle',
    '--fg-on-accent',
    '--fg-disabled',
  ],
  Border: [
    '--border-default',
    '--border-strong',
    '--border-subtle',
    '--border-focus',
  ],
  Accent: [
    '--accent-default',
    '--accent-hover',
    '--accent-active',
    '--accent-muted',
    '--accent-fg',
  ],
  Surface: [
    '--surface-canvas',
    '--surface-surface',
    '--surface-surface-raised',
    '--surface-glass',
    '--surface-scrim',
  ],
  'State — Success': ['--state-success-bg', '--state-success-fg', '--state-success-border'],
  'State — Warning': ['--state-warning-bg', '--state-warning-fg', '--state-warning-border'],
  'State — Error': ['--state-error-bg', '--state-error-fg', '--state-error-border'],
  'State — Info': ['--state-info-bg', '--state-info-fg', '--state-info-border'],
}

function useCssVar(varName: string): string {
  const [value, setValue] = useState('')

  useEffect(() => {
    const v = getComputedStyle(document.documentElement).getPropertyValue(varName).trim()
    setValue(v)
  }, [varName])

  return value
}

function SwatchRow({ cssVar }: { cssVar: string }) {
  const value = useCssVar(cssVar)
  return (
    <div className="flex items-center gap-2 py-0.5">
      <div
        className="w-5 h-5 rounded border shrink-0"
        style={{ backgroundColor: `var(${cssVar})`, borderColor: 'var(--border-subtle)' }}
      />
      <span className="text-xs font-mono truncate" style={{ color: 'var(--fg-muted)' }}>
        {cssVar}
      </span>
      <span className="text-xs font-mono ml-auto shrink-0 max-w-[140px] truncate" style={{ color: 'var(--fg-subtle)' }}>
        {value || '…'}
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

export function SemanticPanel() {
  return (
    <div>
      {Object.entries(CSS_VAR_GROUPS).map(([group, vars]) => (
        <Section key={group} title={group}>
          {vars.map((v) => (
            <SwatchRow key={v} cssVar={v} />
          ))}
        </Section>
      ))}

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
