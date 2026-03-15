/**
 * TEMPLATE: React 组件
 * 使用方法：复制此文件，替换 [ComponentName] 和 [component-name]，填充 TODO 部分
 * 删除所有注释后提交
 */

'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'

// TODO: 替换为实际 Props 定义
interface [ComponentName]Props {
  // 必填 props
  id: string
  // 可选 props（给默认值）
  className?: string
  onAction?: (id: string) => void
}

// TODO: 替换为实际数据类型（若需要从 API 获取）
// import type { VideoType } from '@/types/video.types'

export function [ComponentName]({ id, className, onAction }: [ComponentName]Props) {
  const t = useTranslations('[component-name]')  // TODO: 替换翻译命名空间

  // TODO: 只保留需要的 state，删除不用的
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // TODO: 替换为实际事件处理
  const handleAction = async () => {
    try {
      setIsLoading(true)
      setError(null)
      onAction?.(id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setIsLoading(false)
    }
  }

  // 错误状态（根据需要保留或删除）
  if (error) {
    return (
      <div className={cn('text-[var(--muted)] text-sm', className)}>
        {error}
      </div>
    )
  }

  return (
    <div
      className={cn(
        // 基础样式（使用 CSS 变量，不硬编码颜色）
        'bg-[var(--bg2)] border border-[var(--border)] rounded-lg',
        // 交互状态
        'hover:border-[var(--accent)] transition-colors',
        // 外部 className 覆盖
        className
      )}
    >
      {/* TODO: 替换为实际内容 */}
      <button
        onClick={handleAction}
        disabled={isLoading}
        className="text-[var(--text)] text-sm"
      >
        {isLoading ? t('loading') : t('action')}
      </button>
    </div>
  )
}
