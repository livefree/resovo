import { FallbackCover, SafeImage } from '@/components/media'
import { BrandSwitcher } from '../tokens/_components/BrandSwitcher'
import type { VideoType } from '@resovo/types'

export const metadata = { title: 'FallbackCover / SafeImage Preview — Dev Only' }

// CDN-02 验证面：SafeImage 双模式对比
// 使用 placeholder 图片源（httpbin / picsum）避免依赖真实业务数据
const DEMO_SRC = 'https://picsum.photos/seed/resovo-cdn/640/360'
const DEMO_ALT = 'SafeImage 双模式演示图'

const ASPECTS = ['2:3', '16:9', '1:1', '5:6'] as const
type Aspect = typeof ASPECTS[number]

const VIDEO_TYPES: VideoType[] = ['movie', 'series', 'anime', 'variety', 'documentary']

const ASPECT_WIDTH: Record<Aspect, number> = {
  '2:3':  100,
  '16:9': 160,
  '1:1':  100,
  '5:6':  100,
}

const TYPE_TITLE: Record<string, string> = {
  movie:       '示例电影',
  series:      '示例剧集',
  anime:       '示例动漫',
  variety:     '示例综艺',
  documentary: '示例纪录片',
}

function ThemeSection({ dark }: { dark: boolean }) {
  return (
    <div
      data-theme={dark ? 'dark' : 'light'}
      className="flex-1 p-4 space-y-6 overflow-y-auto"
      style={{ background: 'var(--bg-canvas)' }}
    >
      <h2
        className="text-xs font-semibold uppercase tracking-widest"
        style={{ color: 'var(--fg-muted)' }}
      >
        {dark ? 'Dark Theme' : 'Light Theme'}
      </h2>
      {ASPECTS.map((aspect) => (
        <div key={aspect} className="space-y-2">
          <p className="text-xs font-medium" style={{ color: 'var(--fg-subtle)' }}>
            {aspect}
          </p>
          <div className="flex flex-wrap gap-3">
            {VIDEO_TYPES.map((type) => (
              <FallbackCover
                key={type}
                aspect={aspect}
                type={type}
                title={TYPE_TITLE[type]}
                seed={`${type}-${aspect}`}
                width={ASPECT_WIDTH[aspect]}
                data-testid={`fallback-${dark ? 'dark' : 'light'}-${aspect}-${type}`}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

export default function FallbackPreviewDevPage() {
  return (
    <div className="flex flex-col h-screen">
      <header
        className="flex items-center justify-between px-6 py-3 border-b shrink-0"
        style={{ borderColor: 'var(--border-default)', backgroundColor: 'var(--bg-surface)' }}
      >
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-semibold" style={{ color: 'var(--fg-muted)' }}>
            FallbackCover Preview
          </h1>
          <span
            className="text-xs px-1.5 py-0.5 rounded"
            style={{ backgroundColor: 'var(--state-warning-bg)', color: 'var(--state-warning-fg)' }}
          >
            DEV ONLY
          </span>
          <span className="text-xs" style={{ color: 'var(--fg-subtle)' }}>
            {ASPECTS.length} 比例 × {VIDEO_TYPES.length} 类型 × 2 主题 = {ASPECTS.length * VIDEO_TYPES.length * 2} 格
          </span>
        </div>
        <BrandSwitcher />
      </header>

      <div className="flex flex-1 overflow-hidden divide-x" style={{ borderColor: 'var(--border-default)' }}>
        <ThemeSection dark={false} />
        <ThemeSection dark={true} />
      </div>

      {/* CDN-02: SafeImage 双模式对比验证面 */}
      <section
        className="border-t p-6 space-y-4 shrink-0"
        style={{
          borderColor: 'var(--border-default)',
          background: 'var(--bg-surface)',
        }}
      >
        <div className="flex items-baseline gap-3">
          <h2 className="text-sm font-semibold" style={{ color: 'var(--fg-muted)' }}>
            SafeImage 双模式对比（CDN-02）
          </h2>
          <span className="text-xs" style={{ color: 'var(--fg-subtle)' }}>
            验证 CDN-01 custom loader 接入；src 会经过 IMAGE_LOADER env 切换
          </span>
        </div>
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-2">
            <p
              className="text-xs font-medium inline-block px-2 py-0.5 rounded"
              style={{ background: 'var(--bg-surface-raised)', color: 'var(--fg-subtle)' }}
            >
              {'mode="lazy"（默认 / IntersectionObserver + LazyImage）'}
            </p>
            <SafeImage
              mode="lazy"
              src={DEMO_SRC}
              alt={DEMO_ALT}
              width={320}
              height={180}
              aspect="16:9"
              priority
              data-testid="cdn02-demo-lazy"
            />
            <p className="text-xs" style={{ color: 'var(--fg-subtle)' }}>
              src 经 getLoader() 手动调用；走 &lt;img&gt; 原生标签
            </p>
          </div>
          <div className="space-y-2">
            <p
              className="text-xs font-medium inline-block px-2 py-0.5 rounded"
              style={{ background: 'var(--state-info-bg)', color: 'var(--state-info-fg)' }}
            >
              {'mode="next"（CDN-02 / next/image fill + 外层 aspect wrapper）'}
            </p>
            <SafeImage
              mode="next"
              src={DEMO_SRC}
              alt={DEMO_ALT}
              width={320}
              height={180}
              aspect="16:9"
              priority
              sizes="320px"
              data-testid="cdn02-demo-next"
            />
            <p className="text-xs" style={{ color: 'var(--fg-subtle)' }}>
              src 经 next.config.ts loaderFile 自动调用；走 next/image
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}
