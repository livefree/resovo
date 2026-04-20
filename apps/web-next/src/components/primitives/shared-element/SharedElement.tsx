'use client'

import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import type { SharedElementProps, SharedElementRef } from './types'
import { useSharedElementRegistry } from './registry'

export const SharedElement = forwardRef<SharedElementRef, SharedElementProps>(
  ({ id, role = 'auto', as = 'div', priority = 0, className, style, children }, ref) => {
    const Tag = as as React.ElementType
    const elRef = useRef<HTMLElement>(null)
    const { register } = useSharedElementRegistry()

    useEffect(() => {
      if (!elRef.current) return
      const unregister = register(id, elRef.current, role)
      return unregister
    }, [id, role, register])

    useImperativeHandle(
      ref,
      () => ({
        getRect: () => elRef.current?.getBoundingClientRect() ?? null,
        getElement: () => elRef.current,
      }),
      [],
    )

    // TODO: 方案 M5 页面重制阶段实装 FLIP 数学（依赖真实视觉锚点：列表卡片 → 详情页 poster）
    // - 在 PageTransitionController 触发前，从 registry 取 old rect
    // - commit 后测量 new rect，用 Web Animations API 做 transform 插值
    // - 预留 view-transition-name 自定义属性，Chrome 原生可直接接管
    const props = {
      ref: elRef as React.RefObject<HTMLElement>,
      'data-shared-element-id': id,
      'data-shared-element-role': role,
      'data-shared-element-priority': priority,
      className,
      style,
    }

    return <Tag {...props}>{children}</Tag>
  },
)
SharedElement.displayName = 'SharedElement'
