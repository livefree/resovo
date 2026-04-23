'use client'

import { cn } from '@/lib/utils'

/**
 * VideoCardPlaceholder — 视频卡片占位符（UI-REBUILD-01）
 *
 * 用于首页等区块在数据不足或加载中时填充空卡位，保证布局节奏稳定。
 *
 * 设计原则：
 *   - **极低调**：`bg-surface-sunken` 浅灰背景 + 极弱边框 + 微透明 "···" 居中
 *   - 不展示任何文字 / 图标 / 加载动画（避免视觉干扰和"数据空"暗示）
 *   - 纯 CSS + tokens，不消费数据源
 *   - 仅 2 种 aspect：
 *     - `portrait`（2:3）—— 默认，首页 FeaturedRow 小卡 / TopTenRow / 分类热门 row 通用
 *     - `big`（4:5）—— FeaturedRow 左侧大卡专用
 *   - 不支持 wide（16:9）：按用户 2026-04-23 决策"全竖版降低复杂度"
 *
 * 占位可访问性：aria-hidden，避免屏幕阅读器读出"空卡"干扰导航
 */

export type VideoCardPlaceholderAspect = 'portrait' | 'big'

export interface VideoCardPlaceholderProps {
  readonly aspect?: VideoCardPlaceholderAspect
  readonly className?: string
  readonly 'data-testid'?: string
}

const ASPECT_RATIO: Record<VideoCardPlaceholderAspect, string> = {
  portrait: '2 / 3',
  big:      '4 / 5',
}

export function VideoCardPlaceholder({
  aspect = 'portrait',
  className,
  'data-testid': testId,
}: VideoCardPlaceholderProps) {
  return (
    <div
      data-testid={testId ?? 'video-card-placeholder'}
      data-aspect={aspect}
      aria-hidden="true"
      className={cn(
        'relative w-full rounded-lg overflow-hidden flex items-center justify-center',
        className,
      )}
      style={{
        aspectRatio: ASPECT_RATIO[aspect],
        background: 'var(--bg-surface-sunken)',
        border: '1px solid var(--border-subtle)',
      }}
    >
      <span
        aria-hidden="true"
        style={{
          color: 'var(--fg-subtle)',
          opacity: 0.35,
          fontSize: '1.5rem',
          letterSpacing: '0.3em',
          fontWeight: 300,
          userSelect: 'none',
          lineHeight: 1,
          // 轻微向上偏移，视觉上居中（"···" 字符本身低于文字基线中心）
          transform: 'translateY(-0.1em)',
        }}
      >
        ···
      </span>
    </div>
  )
}
