export default function NextPlaceholderPage() {
  return (
    <section
      data-testid="next-placeholder-root"
      className="min-h-screen p-8"
      style={{ backgroundColor: 'var(--bg-canvas)', color: 'var(--fg-default)' }}
    >
      <div
        className="max-w-2xl mx-auto rounded-xl border p-8"
        style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-default)' }}
      >
        <h1 className="text-2xl font-bold mb-2" style={{ color: 'var(--fg-default)' }}>
          apps/web-next ✓
        </h1>
        <p className="text-sm mb-6" style={{ color: 'var(--fg-muted)' }}>
          Next.js App Router scaffold — RW-SETUP-01 验收页
        </p>

        <div className="grid grid-cols-2 gap-3">
          {TOKEN_SWATCHES.map(({ label, cssVar }) => (
            <div
              key={cssVar}
              className="flex items-center gap-3 rounded-lg p-3 border"
              style={{ borderColor: 'var(--border-subtle)' }}
            >
              <div
                className="w-8 h-8 rounded border shrink-0"
                style={{ backgroundColor: `var(${cssVar})`, borderColor: 'var(--border-default)' }}
              />
              <div>
                <p className="text-xs font-semibold" style={{ color: 'var(--fg-default)' }}>
                  {label}
                </p>
                <p className="text-xs font-mono" style={{ color: 'var(--fg-subtle)' }}>
                  {cssVar}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 flex gap-3">
          <button
            className="px-4 py-2 rounded text-sm font-medium"
            style={{ backgroundColor: 'var(--accent-default)', color: 'var(--accent-fg)' }}
          >
            Primary
          </button>
          <button
            className="px-4 py-2 rounded text-sm font-medium border"
            style={{
              backgroundColor: 'var(--bg-surface)',
              color: 'var(--fg-default)',
              borderColor: 'var(--border-default)',
            }}
          >
            Secondary
          </button>
        </div>
      </div>
    </section>
  )
}

const TOKEN_SWATCHES = [
  { label: 'bg-canvas', cssVar: '--bg-canvas' },
  { label: 'bg-surface', cssVar: '--bg-surface' },
  { label: 'fg-default', cssVar: '--fg-default' },
  { label: 'fg-muted', cssVar: '--fg-muted' },
  { label: 'accent-default', cssVar: '--accent-default' },
  { label: 'accent-muted', cssVar: '--accent-muted' },
  { label: 'border-default', cssVar: '--border-default' },
  { label: 'state-success-bg', cssVar: '--state-success-bg' },
]
