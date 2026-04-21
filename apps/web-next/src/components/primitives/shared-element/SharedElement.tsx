'use client'

import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import type { SharedElementProps, SharedElementRef } from './types'
import { registry } from './registry'
import { useFLIP } from '@/hooks/useFLIP'

export const SharedElement = forwardRef<SharedElementRef, SharedElementProps>(
  function SharedElement(
    { id, role = 'auto', as = 'div', priority = 0, className, style, children },
    ref,
  ) {
    const Tag = as as React.ElementType
    const elRef = useRef<HTMLElement | null>(null)

    useEffect(() => {
      if (!elRef.current) return
      return registry.register(id, elRef.current, role)
    }, [id, role])

    useFLIP(id, elRef)

    useImperativeHandle(
      ref,
      () => ({
        getRect: () => elRef.current?.getBoundingClientRect() ?? null,
        getElement: () => elRef.current,
      }),
      [],
    )

    return (
      <Tag
        ref={elRef as React.RefObject<HTMLElement>}
        data-shared-element-id={id}
        data-shared-element-role={role}
        data-shared-element-priority={priority}
        className={className}
        style={style}
      >
        {children}
      </Tag>
    )
  },
)
SharedElement.displayName = 'SharedElement'
