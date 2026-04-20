'use client'

interface ConfirmReplaceDialogProps {
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmReplaceDialog({ onConfirm, onCancel }: ConfirmReplaceDialogProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-replace-title"
      data-testid="player-confirm-replace"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'color-mix(in srgb, var(--bg-canvas) 60%, transparent)',
        backdropFilter: 'blur(4px)',
      }}
    >
      <div
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-default)',
          borderRadius: '0.75rem',
          padding: '1.5rem',
          maxWidth: '360px',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
          boxShadow: '0 8px 32px color-mix(in srgb, var(--bg-canvas) 0%, transparent)',
        }}
      >
        <h2
          id="confirm-replace-title"
          style={{ color: 'var(--fg-default)', fontSize: '1rem', fontWeight: 600, margin: 0 }}
        >
          替换当前播放？
        </h2>
        <p style={{ color: 'var(--fg-muted)', fontSize: '0.875rem', margin: 0 }}>
          你有一个正在播放的视频。是否切换到这部新视频？
        </p>
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
          <button
            type="button"
            data-testid="player-confirm-cancel"
            onClick={onCancel}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '0.375rem',
              border: '1px solid var(--border-default)',
              background: 'transparent',
              color: 'var(--fg-muted)',
              cursor: 'pointer',
              fontSize: '0.875rem',
            }}
          >
            继续原视频
          </button>
          <button
            type="button"
            data-testid="player-confirm-ok"
            onClick={onConfirm}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '0.375rem',
              border: 'none',
              background: 'var(--accent-default)',
              color: 'var(--accent-fg, white)',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: 600,
            }}
          >
            替换播放
          </button>
        </div>
      </div>
    </div>
  )
}
