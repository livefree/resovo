import { colors, space, radius, shadow, typography, motion, zIndex } from '@resovo/design-tokens'
import { bg, fg, border, accent, state, surface } from '@resovo/design-tokens'
import { button, card, input } from '@resovo/design-tokens'
import { PrimitivePanel } from './_components/PrimitivePanel'
import { SemanticPanel } from './_components/SemanticPanel'
import { ComponentPanel } from './_components/ComponentPanel'
import { BrandSwitcher } from './_components/BrandSwitcher'

export const metadata = { title: 'Token Playground — Dev Only' }

export default function TokenPlaygroundPage() {
  const primitiveData = { colors, space, radius, shadow, typography, motion, zIndex }
  const semanticData = { bg, fg, border, accent, state, surface }
  const componentData = { button, card, input }

  return (
    <div className="flex flex-col h-screen">
      <header
        className="flex items-center justify-between px-6 py-3 border-b"
        style={{ borderColor: 'var(--border-default)', backgroundColor: 'var(--bg-surface)' }}
      >
        <h1 className="text-sm font-semibold" style={{ color: 'var(--fg-muted)' }}>
          Token Playground
          <span
            className="ml-2 text-xs px-1.5 py-0.5 rounded"
            style={{ backgroundColor: 'var(--state-warning-bg)', color: 'var(--state-warning-fg)' }}
          >
            DEV ONLY
          </span>
        </h1>
        <BrandSwitcher />
      </header>

      <div className="flex flex-1 overflow-hidden">
        <section className="w-1/3 overflow-y-auto border-r p-4" style={{ borderColor: 'var(--border-default)' }}>
          <h2 className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: 'var(--fg-muted)' }}>
            Primitive
          </h2>
          <PrimitivePanel data={primitiveData} />
        </section>

        <section className="w-1/3 overflow-y-auto border-r p-4" style={{ borderColor: 'var(--border-default)' }}>
          <h2 className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: 'var(--fg-muted)' }}>
            Semantic
          </h2>
          <SemanticPanel data={semanticData} />
        </section>

        <section className="w-1/3 overflow-y-auto p-4">
          <h2 className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: 'var(--fg-muted)' }}>
            Component
          </h2>
          <ComponentPanel data={componentData} />
        </section>
      </div>
    </div>
  )
}
