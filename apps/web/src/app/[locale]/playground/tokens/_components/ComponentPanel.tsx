'use client'

import { useState } from 'react'
import { useTheme } from '@/hooks/useTheme'
import type { button, card, input } from '@resovo/design-tokens'

type ComponentData = {
  button: typeof button
  card: typeof card
  input: typeof input
}

function CopyableToken({ name, value }: { name: string; value: string }) {
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    void navigator.clipboard.writeText(name).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  return (
    <button
      onClick={handleCopy}
      className="flex items-center justify-between w-full py-0.5 px-1 rounded text-left hover:opacity-80 transition-opacity"
      style={{ backgroundColor: copied ? 'var(--state-success-bg)' : undefined }}
      title="Click to copy token name"
    >
      <span className="text-xs font-mono" style={{ color: copied ? 'var(--state-success-fg)' : 'var(--fg-muted)' }}>
        {copied ? '✓ copied' : name}
      </span>
      <span className="text-xs font-mono ml-2 truncate max-w-[160px]" style={{ color: 'var(--fg-subtle)' }}>
        {value}
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

function flattenTokenPath(obj: unknown, prefix: string): Array<{ name: string; value: string }> {
  if (typeof obj === 'string') return [{ name: prefix, value: obj }]
  if (typeof obj !== 'object' || obj === null) return []
  return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) =>
    flattenTokenPath(v, prefix ? `${prefix}.${k}` : k)
  )
}

export function ComponentPanel({ data }: { data: ComponentData }) {
  const { resolvedTheme } = useTheme()
  const t = resolvedTheme

  const buttonTokens = flattenTokenPath(data.button[t], 'button')
  const cardTokens = flattenTokenPath(data.card[t], 'card')
  const inputTokens = flattenTokenPath(data.input[t], 'input')

  return (
    <div>
      <p className="text-xs mb-4" style={{ color: 'var(--fg-subtle)' }}>
        Click any token to copy its name
      </p>

      <Section title={`Button (${t})`}>
        {buttonTokens.map(({ name, value }) => (
          <CopyableToken key={name} name={name} value={value} />
        ))}
      </Section>

      <Section title={`Card (${t})`}>
        {cardTokens.map(({ name, value }) => (
          <CopyableToken key={name} name={name} value={value} />
        ))}
      </Section>

      <Section title={`Input (${t})`}>
        {inputTokens.map(({ name, value }) => (
          <CopyableToken key={name} name={name} value={value} />
        ))}
      </Section>

      <div
        className="mt-6 rounded p-4 border"
        style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-default)' }}
      >
        <p className="text-xs font-semibold mb-3" style={{ color: 'var(--fg-default)' }}>
          Component Preview
        </p>
        <div
          className="rounded p-4 border"
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderColor: 'var(--border-subtle)',
          }}
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
