'use client'

import { cn } from '@/lib/utils'

export interface SourceItem {
  src: string
  type: string
  /** 主题标签（CHG-353 / Layer C / applyThemeLabels 输出 themeLabel）*/
  label?: string
  /** 画质档位（CHG-353 / 主题模式下渲染为 "themeLabel · quality"）*/
  quality?: string | null
  /** dead 标记（CHG-353 / 渲染置灰）*/
  isDead?: boolean
  /** pending 标记（CHG-353 / 渲染"检测中"提示 / arch-reviewer CHG-352 I3 advisory）*/
  isPending?: boolean
}

interface SourceBarProps {
  sources: SourceItem[]
  activeIndex: number
  onSourceChange: (index: number) => void
  className?: string
}

export function SourceBar({ sources, activeIndex, onSourceChange, className }: SourceBarProps) {
  // 边界：0 条不渲染（设计稿 §Layer C 极端情况）
  if (sources.length === 0) return null

  // 边界：1 条不显示标签栏（仅画质 / 用户无需选择 / 设计稿 §Layer C）
  // 仍保留 SourceBar 包装，方便上游 hasSources 判定一致；返回 null 改由 caller 控制更佳
  // 此处保留渲染，但 1 条时 label 简化为画质（主题标签无意义）
  const isSingle = sources.length === 1

  return (
    <div className={cn('p-2', className)} data-testid="source-bar">
      <div
        className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4 gap-1.5"
        data-testid="source-grid"
      >
        {sources.map((src, i) => {
          const labelText = isSingle
            ? (src.quality ?? src.label ?? '播放')
            : src.label ?? `线路${i + 1}`
          // 主题模式下显示 "themeLabel · quality"（quality 可选）
          const displayText = !isSingle && src.quality
            ? `${labelText} · ${src.quality}`
            : labelText
          const isActive = i === activeIndex
          const isDead = src.isDead === true

          // 颜色：active > dead > 默认；dead 灰色 + 50% 透明（不可硬编码 / 用 CSS 变量）
          const buttonStyle: React.CSSProperties = isActive
            ? { background: 'var(--accent-default)', color: 'var(--accent-fg)' }
            : isDead
              ? { background: 'var(--bg-surface-sunken)', color: 'var(--fg-muted)', opacity: 0.5 }
              : { background: 'var(--bg-surface)', color: 'var(--fg-default)' }

          const title = isDead
            ? `${displayText}（线路失效）`
            : src.isPending
              ? `${displayText}（检测中）`
              : displayText

          return (
            <button
              key={i}
              type="button"
              onClick={() => onSourceChange(i)}
              className={cn(
                'py-2 text-center text-sm rounded transition-colors',
                isActive ? 'font-bold shadow-sm' : 'hover:bg-[var(--bg-surface-sunken)]',
              )}
              style={buttonStyle}
              data-testid={`source-btn-${i}`}
              data-dead={isDead || undefined}
              data-pending={src.isPending || undefined}
              title={title}
            >
              {displayText}
              {src.isPending && (
                <span
                  className="ml-1 text-xs"
                  style={{ color: 'var(--fg-muted)' }}
                  aria-label="检测中"
                >
                  …
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
