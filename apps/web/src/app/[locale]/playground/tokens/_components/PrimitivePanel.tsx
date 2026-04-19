'use client'

import { useState } from 'react'
import type { colors, space, radius, shadow, typography, motion, zIndex } from '@resovo/design-tokens'

type PrimitiveData = {
  colors: typeof colors
  space: typeof space
  radius: typeof radius
  shadow: typeof shadow
  typography: typeof typography
  motion: typeof motion
  zIndex: typeof zIndex
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

export function PrimitivePanel({ data }: { data: PrimitiveData }) {
  return (
    <div>
      <Section title="Colors">
        {(Object.entries(data.colors) as [string, Record<string, string>][]).map(([scale, steps]) => (
          <div key={scale} className="mb-2">
            <p className="text-xs font-medium mb-1 capitalize" style={{ color: 'var(--fg-subtle)' }}>
              {scale}
            </p>
            {(Object.entries(steps) as [string, string][]).map(([step, value]) => (
              <ColorSwatch key={step} name={`${scale}.${step}`} value={value} />
            ))}
          </div>
        ))}
      </Section>

      <Section title="Space">
        {(Object.entries(data.space) as [string, string][]).map(([key, value]) => (
          <TokenRow key={key} name={`space.${key}`} value={value} />
        ))}
      </Section>

      <Section title="Radius">
        {(Object.entries(data.radius) as [string, string][]).map(([key, value]) => (
          <TokenRow key={key} name={`radius.${key}`} value={value} />
        ))}
      </Section>

      <Section title="Shadow">
        {(Object.entries(data.shadow) as [string, string][]).map(([key, value]) => (
          <TokenRow key={key} name={`shadow.${key}`} value={value} />
        ))}
      </Section>

      <Section title="Typography">
        {(Object.entries(data.typography) as [string, Record<string, string>][]).map(([group, values]) => (
          <div key={group} className="mb-2">
            <p className="text-xs font-medium mb-1" style={{ color: 'var(--fg-subtle)' }}>
              {group}
            </p>
            {(Object.entries(values) as [string, string][]).map(([key, value]) => (
              <TokenRow key={key} name={`${group}.${key}`} value={value} />
            ))}
          </div>
        ))}
      </Section>

      <Section title="Motion">
        {(Object.entries(data.motion) as [string, Record<string, string>][]).map(([group, values]) => (
          <div key={group} className="mb-2">
            <p className="text-xs font-medium mb-1" style={{ color: 'var(--fg-subtle)' }}>
              {group}
            </p>
            {(Object.entries(values) as [string, string][]).map(([key, value]) => (
              <TokenRow key={key} name={`motion.${group}.${key}`} value={value} />
            ))}
          </div>
        ))}
      </Section>

      <Section title="Z-Index">
        {(Object.entries(data.zIndex) as [string, number][]).map(([key, value]) => (
          <TokenRow key={key} name={`zIndex.${key}`} value={String(value)} />
        ))}
      </Section>
    </div>
  )
}
