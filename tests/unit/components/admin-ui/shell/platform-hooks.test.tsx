/**
 * platform.ts hooks 单测（CHG-SN-2-04 fix · hydration-safe）
 *
 * 覆盖：usePlatform / useFormatShortcut 的 SSR + 客户端两种 hydration 路径
 *   - SSR + 首渲染：返 SSR 默认（isMac=false / 'Ctrl+K'），与 IS_MAC 顶层常量一致 → 不触发 React mismatch
 *   - 客户端 mount 后 useEffect 检测 navigator → setState 触发普通 rerender，更新为真实平台值
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, act, cleanup } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import {
  usePlatform,
  useFormatShortcut,
} from '../../../../../packages/admin-ui/src/shell/platform'

afterEach(() => {
  cleanup()
})

describe('usePlatform — Mac 平台模拟', () => {
  let originalPlatform: PropertyDescriptor | undefined

  beforeEach(() => {
    originalPlatform = Object.getOwnPropertyDescriptor(navigator, 'platform')
    Object.defineProperty(navigator, 'platform', {
      value: 'MacIntel',
      configurable: true,
    })
  })

  afterEach(() => {
    if (originalPlatform) {
      Object.defineProperty(navigator, 'platform', originalPlatform)
    }
  })

  function Probe() {
    const { isMac, modKeyLabel } = usePlatform()
    return (
      <>
        <span data-testid="isMac">{String(isMac)}</span>
        <span data-testid="modKeyLabel">{modKeyLabel}</span>
      </>
    )
  }

  it('客户端 mount 后 isMac=true / modKeyLabel="⌘"（navigator.platform=MacIntel）', () => {
    render(<Probe />)
    expect(screen.getByTestId('isMac').textContent).toBe('true')
    expect(screen.getByTestId('modKeyLabel').textContent).toBe('⌘')
  })
})

describe('usePlatform — 非 Mac 平台模拟', () => {
  let originalPlatform: PropertyDescriptor | undefined

  beforeEach(() => {
    originalPlatform = Object.getOwnPropertyDescriptor(navigator, 'platform')
    Object.defineProperty(navigator, 'platform', {
      value: 'Linux x86_64',
      configurable: true,
    })
  })

  afterEach(() => {
    if (originalPlatform) {
      Object.defineProperty(navigator, 'platform', originalPlatform)
    }
  })

  function Probe() {
    const { isMac, modKeyLabel } = usePlatform()
    return (
      <>
        <span data-testid="isMac">{String(isMac)}</span>
        <span data-testid="modKeyLabel">{modKeyLabel}</span>
      </>
    )
  }

  it('客户端 mount 后 isMac=false / modKeyLabel="Ctrl"（navigator.platform=Linux）', () => {
    render(<Probe />)
    expect(screen.getByTestId('isMac').textContent).toBe('false')
    expect(screen.getByTestId('modKeyLabel').textContent).toBe('Ctrl')
  })
})

describe('useFormatShortcut — Mac 平台 hydration-safe', () => {
  let originalPlatform: PropertyDescriptor | undefined

  beforeEach(() => {
    originalPlatform = Object.getOwnPropertyDescriptor(navigator, 'platform')
    Object.defineProperty(navigator, 'platform', {
      value: 'MacIntel',
      configurable: true,
    })
  })

  afterEach(() => {
    if (originalPlatform) {
      Object.defineProperty(navigator, 'platform', originalPlatform)
    }
  })

  function Probe({ spec }: { readonly spec: string }) {
    const label = useFormatShortcut(spec)
    return <span data-testid="label">{label}</span>
  }

  it('Mac 客户端 mount 后输出 "⌘K"', () => {
    render(<Probe spec="mod+k" />)
    expect(screen.getByTestId('label').textContent).toBe('⌘K')
  })
})

describe('useFormatShortcut — SSR 默认（hydration-safe baseline）', () => {
  function Probe({ spec }: { readonly spec: string }) {
    const label = useFormatShortcut(spec)
    return <span data-testid="label">{label}</span>
  }

  it('SSR renderToString 输出 "Ctrl+K"（永远 SSR 默认 = 顶层 IS_MAC=false）', () => {
    const html = renderToString(<Probe spec="mod+k" />)
    expect(html).toContain('Ctrl+K')
    expect(html).not.toContain('⌘')
  })

  it('SSR renderToString 不抛错', () => {
    expect(() => renderToString(<Probe spec="mod+," />)).not.toThrow()
  })
})
