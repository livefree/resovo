'use client'

import { useState } from 'react'

const COMPONENT_TOKENS: Record<string, string[]> = {
  Button: [
    '--accent-default',
    '--accent-hover',
    '--accent-active',
    '--accent-fg',
    '--accent-muted',
    '--border-focus',
  ],
  Card: [
    '--bg-surface',
    '--bg-surface-raised',
    '--border-default',
    '--border-subtle',
    '--fg-default',
    '--fg-muted',
  ],
  Input: [
    '--bg-canvas',
    '--bg-surface',
    '--border-default',
    '--border-focus',
    '--fg-default',
    '--fg-subtle',
    '--fg-disabled',
  ],
}

function CopyableToken({ cssVar }: { cssVar: string }) {
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    void navigator.clipboard.writeText(cssVar).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-2 w-full py-0.5 px-1 rounded text-left hover:opacity-80 transition-opacity"
      style={{ backgroundColor: copied ? 'var(--state-success-bg)' : undefined }}
      title="Click to copy"
    >
      <div
        className="w-4 h-4 rounded border shrink-0"
        style={{ backgroundColor: `var(${cssVar})`, borderColor: 'var(--border-subtle)' }}
      />
      <span className="text-xs font-mono" style={{ color: copied ? 'var(--state-success-fg)' : 'var(--fg-muted)' }}>
        {copied ? '✓ copied' : cssVar}
      </span>
    </button>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true)
  return (
    <div className="mb-5">
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

export function ComponentPanel() {
  return (
    <div>
      <p className="text-xs mb-4" style={{ color: 'var(--fg-subtle)' }}>
        Click any token to copy its CSS variable name
      </p>

      {Object.entries(COMPONENT_TOKENS).map(([component, vars]) => (
        <Section key={component} title={component}>
          {vars.map((v) => (
            <CopyableToken key={v} cssVar={v} />
          ))}
        </Section>
      ))}

      <div
        className="mt-6 rounded p-4 border"
        style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-default)' }}
      >
        <p className="text-xs font-semibold mb-3" style={{ color: 'var(--fg-default)' }}>
          Component Preview
        </p>
        <div
          className="rounded p-4 border"
          style={{ backgroundColor: 'var(--bg-surface-raised)', borderColor: 'var(--border-subtle)' }}
        >
          <p className="text-sm font-semibold mb-1" style={{ color: 'var(--fg-default)' }}>
            Card Title
          </p>
          <p className="text-xs" style={{ color: 'var(--fg-muted)' }}>
            Card body with semantic color tokens that update on theme switch.
          </p>
        </div>
      </div>
    </div>
  )
}
