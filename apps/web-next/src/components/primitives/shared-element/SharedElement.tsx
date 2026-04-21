'use client'

import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import type { SharedElementProps, SharedElementRef, SharedElementComponent } from './types'
import { useSharedElementRegistry, captureSnapshot } from './registry'
import { useFLIP } from '@/hooks/useFLIP'

// ── shared registration hook ──────────────────────────────────────────────────

function useRegistration(
  id: string,
  role: SharedElementProps['role'],
  elRef: React.RefObject<HTMLElement | null>,
  onBeforeUnregister?: (id: string) => void,
) {
  const reg = useSharedElementRegistry()   // reads from context — honours provider opt-out
  useEffect(() => {
    if (!elRef.current) return
    const unregister = reg.register(id, elRef.current, role)
    return () => {
      onBeforeUnregister?.(id)
      unregister()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, role, reg])
}

function makeImperativeHandle(elRef: React.RefObject<HTMLElement | null>): SharedElementRef {
  return {
    getRect: () => elRef.current?.getBoundingClientRect() ?? null,
    getElement: () => elRef.current,
  }
}

// ── base component (generic, no FLIP direction) ───────────────────────────────

export const SharedElement = forwardRef<SharedElementRef, SharedElementProps>(
  function SharedElement(
    { id, role = 'auto', as = 'div', priority = 0, className, style, children },
    ref,
  ) {
    const Tag = as as React.ElementType
    const elRef = useRef<HTMLElement | null>(null)

    useRegistration(id, role, elRef)
    useImperativeHandle(ref, () => makeImperativeHandle(elRef), [])

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

// ── Source sub-component ──────────────────────────────────────────────────────
// Marks the FLIP origin. Captures snapshot on unmount as best-effort fallback;
// primary capture path is SharedElementLink.onPointerDown.

const Source = forwardRef<SharedElementRef, SharedElementProps>(
  function SharedElementSource(
    { id, role = 'auto', as = 'div', priority = 0, className, style, children },
    ref,
  ) {
    const Tag = as as React.ElementType
    const elRef = useRef<HTMLElement | null>(null)

    useRegistration(id, role, elRef, (capturedId) => {
      // best-effort snapshot on unmount (race with detach; primary path is SharedElementLink)
      const el = elRef.current
      if (el?.isConnected) captureSnapshot(capturedId)
    })
    useImperativeHandle(ref, () => makeImperativeHandle(elRef), [])

    return (
      <Tag
        ref={elRef as React.RefObject<HTMLElement>}
        data-shared-element-id={id}
        data-shared-element-role="source"
        data-shared-element-priority={priority}
        className={className}
        style={style}
      >
        {children}
      </Tag>
    )
  },
)
Source.displayName = 'SharedElement.Source'

// ── Target sub-component ──────────────────────────────────────────────────────
// Marks the FLIP destination. Runs useFLIP on mount, animating from the
// snapshot captured by the matching Source (or SharedElementLink).

const Target = forwardRef<SharedElementRef, SharedElementProps>(
  function SharedElementTarget(
    { id, role = 'auto', as = 'div', priority = 0, className, style, children },
    ref,
  ) {
    const Tag = as as React.ElementType
    const elRef = useRef<HTMLElement | null>(null)

    useRegistration(id, role, elRef)
    useFLIP(id, elRef)
    useImperativeHandle(ref, () => makeImperativeHandle(elRef), [])

    return (
      <Tag
        ref={elRef as React.RefObject<HTMLElement>}
        data-shared-element-id={id}
        data-shared-element-role="target"
        data-shared-element-priority={priority}
        className={className}
        style={style}
      >
        {children}
      </Tag>
    )
  },
)
Target.displayName = 'SharedElement.Target'

// ── re-export with Source/Target attached ─────────────────────────────────────

// Re-assign as SharedElementComponent so TypeScript knows about .Source / .Target
;(SharedElement as SharedElementComponent).Source = Source
;(SharedElement as SharedElementComponent).Target = Target
