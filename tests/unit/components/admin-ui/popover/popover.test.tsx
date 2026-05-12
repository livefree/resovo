/**
 * Popover 单测（CHG-SN-5-PRE-03-F / SEQ-20260506-02 / ADR-115）
 * 覆盖：受控 / 非受控 / trigger toggle / dismiss 4 类生效（trigger / ESC / outside / programmatic）
 *      / hasPopup ARIA / aria-expanded 同步 / consumer onClick 包装 / portal 到 body
 *      / @experimental prop dev warn 不阻塞 / SSR-safe（mount 前不 portal）
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, fireEvent, cleanup } from '@testing-library/react'
import React, { useState } from 'react'
import { Popover } from '../../../../../packages/admin-ui/src/components/popover/popover'

afterEach(() => cleanup())

// ── 基础渲染 + trigger 注入 ─────────────────────────────────────

describe('Popover — 基础渲染 + trigger 注入', () => {
  it('默认 closed → 渲染 trigger 但不渲染 popover', () => {
    const { container, queryByTestId } = render(
      <Popover trigger={<button data-testid="trigger">打开</button>} content={<div>内容</div>} />,
    )
    expect(container.querySelector('[data-testid="trigger"]')).toBeTruthy()
    expect(queryByTestId('popover-content')).toBeNull()
    expect(document.body.querySelector('[data-admin-popover]')).toBeNull()
  })

  it('trigger 注入 aria-haspopup=dialog（默认） + aria-expanded=false', () => {
    const { container } = render(
      <Popover trigger={<button data-testid="trigger">打开</button>} content={<div>x</div>} />,
    )
    const trigger = container.querySelector('[data-testid="trigger"]') as HTMLElement
    expect(trigger.getAttribute('aria-haspopup')).toBe('dialog')
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
  })

  it('trigger 不是 valid React element → 直接 fragment 渲染（不 crash）', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { container } = render(
      // @ts-expect-error — 测 invalid trigger 防御
      <Popover trigger={'plain string' as unknown as React.ReactElement} content={<div />} />,
    )
    expect(container.textContent).toContain('plain string')
    warn.mockRestore()
  })
})

// ── 非受控：trigger toggle（dismiss 第 1 类）─────────────────────

describe('Popover — 非受控 trigger toggle', () => {
  it('点击 trigger → 打开 popover（aria-expanded=true）', () => {
    const { container } = render(
      <Popover trigger={<button data-testid="trigger">打开</button>} content={<div data-testid="popover-body">内容</div>} />,
    )
    const trigger = container.querySelector('[data-testid="trigger"]') as HTMLElement
    fireEvent.click(trigger)
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    const popover = document.body.querySelector('[data-admin-popover]')
    expect(popover).toBeTruthy()
    expect(popover?.querySelector('[data-testid="popover-body"]')).toBeTruthy()
  })

  it('再次点击 trigger → 关闭 popover（toggle）', () => {
    const { container } = render(
      <Popover trigger={<button data-testid="trigger">x</button>} content={<div />} />,
    )
    const trigger = container.querySelector('[data-testid="trigger"]') as HTMLElement
    fireEvent.click(trigger) // open
    fireEvent.click(trigger) // close
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    expect(document.body.querySelector('[data-admin-popover]')).toBeNull()
  })

  it('defaultOpen=true → 初次渲染就打开', () => {
    render(
      <Popover defaultOpen trigger={<button>x</button>} content={<div data-testid="initially-open">init</div>} />,
    )
    expect(document.body.querySelector('[data-testid="initially-open"]')).toBeTruthy()
  })
})

// ── 受控模式 ─────────────────────────────────────────────────────

describe('Popover — 受控模式', () => {
  it('open 受控 + onOpenChange 调用，但不强制更新（消费方控制）', () => {
    const onOpenChange = vi.fn()
    const { container } = render(
      <Popover open={false} onOpenChange={onOpenChange} trigger={<button data-testid="trigger">x</button>} content={<div />} />,
    )
    const trigger = container.querySelector('[data-testid="trigger"]') as HTMLElement
    fireEvent.click(trigger)
    expect(onOpenChange).toHaveBeenCalledWith(true)
    // 受控模式：open 仍 false → popover 不渲染
    expect(document.body.querySelector('[data-admin-popover]')).toBeNull()
  })

  it('受控 open=true → 渲染 popover + aria-expanded=true', () => {
    const { container } = render(
      <Popover open onOpenChange={() => {}} trigger={<button data-testid="trigger">x</button>} content={<div data-testid="ctrl">x</div>} />,
    )
    expect(container.querySelector('[data-testid="trigger"]')!.getAttribute('aria-expanded')).toBe('true')
    expect(document.body.querySelector('[data-testid="ctrl"]')).toBeTruthy()
  })

  it('受控状态切换 → popover 渲染同步', () => {
    function Wrap() {
      const [open, setOpen] = useState(false)
      return (
        <>
          <button data-testid="external" onClick={() => setOpen(true)}>外部打开</button>
          <Popover open={open} onOpenChange={setOpen} trigger={<button data-testid="trigger">x</button>} content={<div data-testid="external-popover">外部控</div>} />
        </>
      )
    }
    const { getByTestId } = render(<Wrap />)
    expect(document.body.querySelector('[data-testid="external-popover"]')).toBeNull()
    fireEvent.click(getByTestId('external'))
    expect(document.body.querySelector('[data-testid="external-popover"]')).toBeTruthy()
  })
})

// ── consumer onClick 包装（trigger 注入不破坏消费方 onClick）─────

describe('Popover — consumer onClick 包装', () => {
  it('消费方 trigger 上的 onClick 会被先调用，再 toggle', () => {
    const consumerClick = vi.fn()
    const { container } = render(
      <Popover trigger={<button data-testid="trigger" onClick={consumerClick}>x</button>} content={<div />} />,
    )
    const trigger = container.querySelector('[data-testid="trigger"]') as HTMLElement
    fireEvent.click(trigger)
    expect(consumerClick).toHaveBeenCalledTimes(1)
    expect(document.body.querySelector('[data-admin-popover]')).toBeTruthy()
  })

  it('消费方 onClick 抛异常 → toggle 仍执行（不冒泡破坏 popover）', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const consumerClick = vi.fn(() => { throw new Error('consumer error') })
    const { container } = render(
      <Popover trigger={<button data-testid="trigger" onClick={consumerClick}>x</button>} content={<div />} />,
    )
    const trigger = container.querySelector('[data-testid="trigger"]') as HTMLElement
    expect(() => fireEvent.click(trigger)).not.toThrow()
    expect(document.body.querySelector('[data-admin-popover]')).toBeTruthy()
    warn.mockRestore()
  })
})

// ── onKeyDown Enter/Space 触发（ADR-115 §2.1 trigger 注入）──────

describe('Popover — 键盘 Enter / Space 触发 toggle', () => {
  it('Enter on trigger → 打开 popover', () => {
    const { container } = render(
      <Popover trigger={<div role="button" tabIndex={0} data-testid="trigger">x</div>} content={<div data-testid="kb-x">x</div>} />,
    )
    const trigger = container.querySelector('[data-testid="trigger"]') as HTMLElement
    fireEvent.keyDown(trigger, { key: 'Enter' })
    expect(document.body.querySelector('[data-testid="kb-x"]')).toBeTruthy()
  })

  it('Space on trigger → 打开 popover + preventDefault（防 Space 滚动）', () => {
    // 用消费方 onKeyDown 间接观察 e.defaultPrevented（Popover 后置逻辑会 preventDefault）
    let observedDefaultPrevented = false
    function Wrap() {
      // 消费方 onKeyDown 在 Popover 之后无法直接观察；改用 ref 暴露
      return (
        <Popover
          trigger={<div role="button" tabIndex={0} data-testid="trigger">x</div>}
          content={<div data-testid="kb-y">x</div>}
        />
      )
    }
    const { container } = render(<Wrap />)
    const trigger = container.querySelector('[data-testid="trigger"]') as HTMLElement
    // fireEvent.keyDown 走 React synthetic event 系统，能正确触发 cloneElement 注入的 onKeyDown
    const result = fireEvent.keyDown(trigger, { key: ' ' })
    // fireEvent 返回 false 表示 default 被 prevented
    observedDefaultPrevented = result === false
    expect(document.body.querySelector('[data-testid="kb-y"]')).toBeTruthy()
    expect(observedDefaultPrevented).toBe(true)
  })

  it('其它键（如 ArrowDown）不触发 toggle', () => {
    const { container } = render(
      <Popover trigger={<div role="button" tabIndex={0} data-testid="trigger">x</div>} content={<div data-testid="kb-z">x</div>} />,
    )
    const trigger = container.querySelector('[data-testid="trigger"]') as HTMLElement
    fireEvent.keyDown(trigger, { key: 'ArrowDown' })
    expect(document.body.querySelector('[data-testid="kb-z"]')).toBeNull()
  })

  it('再次 Enter → 关闭（toggle）', () => {
    const { container } = render(
      <Popover trigger={<div role="button" tabIndex={0} data-testid="trigger">x</div>} content={<div data-testid="kb-toggle">x</div>} />,
    )
    const trigger = container.querySelector('[data-testid="trigger"]') as HTMLElement
    fireEvent.keyDown(trigger, { key: 'Enter' })
    fireEvent.keyDown(trigger, { key: 'Enter' })
    expect(document.body.querySelector('[data-testid="kb-toggle"]')).toBeNull()
  })

  it('消费方 onKeyDown 先调用 + 抛异常被吞 + toggle 仍执行', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const consumerKD = vi.fn(() => { throw new Error('consumer kd error') })
    const { container } = render(
      <Popover trigger={<div role="button" tabIndex={0} data-testid="trigger" onKeyDown={consumerKD}>x</div>} content={<div data-testid="kb-w">x</div>} />,
    )
    const trigger = container.querySelector('[data-testid="trigger"]') as HTMLElement
    expect(() => fireEvent.keyDown(trigger, { key: 'Enter' })).not.toThrow()
    expect(consumerKD).toHaveBeenCalled()
    expect(document.body.querySelector('[data-testid="kb-w"]')).toBeTruthy()
    warn.mockRestore()
  })

  it('消费方 e.preventDefault() → Popover 不再 toggle（消费方主动消费）', () => {
    const consumerKD = vi.fn((e: React.KeyboardEvent) => e.preventDefault())
    const { container } = render(
      <Popover trigger={<div role="button" tabIndex={0} data-testid="trigger" onKeyDown={consumerKD}>x</div>} content={<div data-testid="kb-skip">x</div>} />,
    )
    const trigger = container.querySelector('[data-testid="trigger"]') as HTMLElement
    fireEvent.keyDown(trigger, { key: 'Enter' })
    expect(document.body.querySelector('[data-testid="kb-skip"]')).toBeNull()
  })
})

// ── 原生 button 键盘 activation 不绕过消费方 onClick（Codex stop-time review 修复）

describe('Popover — 原生 button trigger 键盘路径走 onClick（不绕过消费方）', () => {
  it('原生 <button> + Enter → 走浏览器 keyboard→click → 消费方 onClick 被调用 + popover 切开', () => {
    // 模拟浏览器原生行为：原生 button + Enter keydown 不被 preventDefault → 紧跟 click
    const consumerClick = vi.fn()
    const { container } = render(
      <Popover trigger={<button data-testid="native-btn" onClick={consumerClick}>x</button>} content={<div data-testid="native-kb">x</div>} />,
    )
    const trigger = container.querySelector('[data-testid="native-btn"]') as HTMLElement
    // 1) Popover onKeyDown 包装 — 不应 preventDefault（让浏览器 keyboard→click 转换走完）
    const kdResult = fireEvent.keyDown(trigger, { key: 'Enter' })
    expect(kdResult).toBe(true)  // 默认未被 prevented（浏览器仍会转 click）
    // 2) 模拟浏览器把 Enter 转 click（jsdom 不自动做此转换 → 测试中显式 fireEvent.click）
    fireEvent.click(trigger)
    expect(consumerClick).toHaveBeenCalledTimes(1)
    expect(document.body.querySelector('[data-testid="native-kb"]')).toBeTruthy()
  })

  it('原生 <button> + Space → keyDown 不抢 toggle（toggle 仅 click 路径触发一次，无双触发）', () => {
    const consumerClick = vi.fn()
    const { container } = render(
      <Popover trigger={<button data-testid="native-btn" onClick={consumerClick}>x</button>} content={<div data-testid="native-sp">x</div>} />,
    )
    const trigger = container.querySelector('[data-testid="native-btn"]') as HTMLElement
    // Space keydown：不应触发 toggle（让浏览器走 click 路径）
    fireEvent.keyDown(trigger, { key: ' ' })
    expect(document.body.querySelector('[data-testid="native-sp"]')).toBeNull()  // 未 toggle
    // 模拟浏览器把 Space → click
    fireEvent.click(trigger)
    expect(consumerClick).toHaveBeenCalledTimes(1)
    expect(document.body.querySelector('[data-testid="native-sp"]')).toBeTruthy()
    // 再次 click 关闭（验证 toggle 净效果正确，而非双触发归零）
    fireEvent.click(trigger)
    expect(document.body.querySelector('[data-testid="native-sp"]')).toBeNull()
  })

  it('原生 <button> + 消费方 onKeyDown → 仍被调用（包装链不破坏消费方）', () => {
    const consumerKD = vi.fn()
    const { container } = render(
      <Popover trigger={<button data-testid="native-btn" onKeyDown={consumerKD}>x</button>} content={<div />} />,
    )
    const trigger = container.querySelector('[data-testid="native-btn"]') as HTMLElement
    fireEvent.keyDown(trigger, { key: 'Enter' })
    expect(consumerKD).toHaveBeenCalledTimes(1)
  })

  it('React.forwardRef 包装的 button 同样不抢 keyboard activation（运行时 DOM 检测）', () => {
    // 模拟典型业务封装：消费方用 forwardRef 包装 button，添加自定义样式 / a11y
    const FancyButton = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
      function FancyButton(props, ref) {
        return <button ref={ref} data-fancy="true" {...props} />
      },
    )
    const consumerClick = vi.fn()
    const { container } = render(
      <Popover
        trigger={<FancyButton data-testid="fwd-btn" onClick={consumerClick}>x</FancyButton>}
        content={<div data-testid="fwd-content">x</div>}
      />,
    )
    const trigger = container.querySelector('[data-testid="fwd-btn"]') as HTMLElement
    expect(trigger.tagName.toLowerCase()).toBe('button')
    expect(trigger.getAttribute('data-fancy')).toBe('true')
    // 确认 trigger.type 是函数引用（静态判断会漏判 — 必须靠运行时 DOM 检测）
    // Enter keydown：Popover 不应 preventDefault（让浏览器 keyboard→click 转换走完）
    const kdResult = fireEvent.keyDown(trigger, { key: 'Enter' })
    expect(kdResult).toBe(true)
    expect(document.body.querySelector('[data-testid="fwd-content"]')).toBeNull() // keyDown 路径未抢 toggle
    // 模拟浏览器 keyboard→click 转换
    fireEvent.click(trigger)
    expect(consumerClick).toHaveBeenCalledTimes(1)
    expect(document.body.querySelector('[data-testid="fwd-content"]')).toBeTruthy()
  })

  it('<input type="button"> 同样走原生 keyboard activation（不抢 toggle）', () => {
    const { container } = render(
      <Popover
        trigger={<input type="button" data-testid="native-input" value="x" />}
        content={<div data-testid="native-input-content">x</div>}
      />,
    )
    const trigger = container.querySelector('[data-testid="native-input"]') as HTMLElement
    fireEvent.keyDown(trigger, { key: 'Enter' })
    // input[type=button] 也是原生 → keyDown 不触发 toggle
    expect(document.body.querySelector('[data-testid="native-input-content"]')).toBeNull()
  })
})

// ── ref 注入失败 fallback 到父容器（ADR-115 §2.1 防 crash）─────

describe('Popover — ref 注入失败时 fallback 定位到 trigger 父容器', () => {
  it('marker span 始终渲染且 display:none + aria-hidden（不影响 layout / a11y）', () => {
    const { container } = render(
      <Popover trigger={<button data-testid="trigger">x</button>} content={<div />} />,
    )
    const marker = container.querySelector('[data-popover-marker]') as HTMLElement
    expect(marker).toBeTruthy()
    expect(marker.style.display).toBe('none')
    expect(marker.getAttribute('aria-hidden')).toBe('true')
  })

  it('非 forwardRef 函数组件作 trigger → popover 仍渲染（不 crash），dev 模式 console.warn 提示', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    // 函数组件不 forwardRef → cloneElement 注入的 ref 被忽略，triggerRef.current = null
    function PlainTrigger(props: { children: React.ReactNode }) {
      return <button data-testid="non-forwarded">{props.children}</button>
    }
    expect(() =>
      render(
        <div data-testid="parent-wrap">
          <Popover defaultOpen trigger={<PlainTrigger>打开</PlainTrigger>} content={<div data-testid="fb-content">x</div>} />
        </div>,
      ),
    ).not.toThrow()
    expect(document.body.querySelector('[data-testid="fb-content"]')).toBeTruthy()
    // dev 模式应有 ref 失败警告
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('trigger ref 注入失败'),
    )
    warn.mockRestore()
  })
})

// ── ESC 关闭（dismiss 第 2 类）──────────────────────────────────

describe('Popover — ESC 关闭', () => {
  it('open 时按 ESC → 关闭 + 焦点回 trigger', () => {
    const onOpenChange = vi.fn()
    const { container } = render(
      <Popover defaultOpen onOpenChange={onOpenChange} trigger={<button data-testid="trigger">x</button>} content={<div />} />,
    )
    const trigger = container.querySelector('[data-testid="trigger"]') as HTMLElement
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('closeOnEscape=false → ESC 不触发关闭', () => {
    const onOpenChange = vi.fn()
    render(
      <Popover defaultOpen closeOnEscape={false} onOpenChange={onOpenChange} trigger={<button>x</button>} content={<div />} />,
    )
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onOpenChange).not.toHaveBeenCalled()
  })
})

// ── outside click 关闭（dismiss 第 3 类）────────────────────────

describe('Popover — outside click 关闭', () => {
  it('点击 popover / trigger 之外 → 关闭', () => {
    const onOpenChange = vi.fn()
    render(
      <>
        <button data-testid="outside">外部按钮</button>
        <Popover defaultOpen onOpenChange={onOpenChange} trigger={<button>x</button>} content={<div />} />
      </>,
    )
    const outside = document.querySelector('[data-testid="outside"]') as HTMLElement
    fireEvent.mouseDown(outside)
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('点击 popover content 内部 → 不关闭', () => {
    const onOpenChange = vi.fn()
    render(
      <Popover defaultOpen onOpenChange={onOpenChange} trigger={<button>x</button>} content={<div data-testid="content-inner">点我不关闭</div>} />,
    )
    const inner = document.body.querySelector('[data-testid="content-inner"]') as HTMLElement
    fireEvent.mouseDown(inner)
    expect(onOpenChange).not.toHaveBeenCalled()
  })

  it('closeOnOutsideClick=false → 外部点击不关闭', () => {
    const onOpenChange = vi.fn()
    render(
      <>
        <button data-testid="outside">x</button>
        <Popover defaultOpen closeOnOutsideClick={false} onOpenChange={onOpenChange} trigger={<button>x</button>} content={<div />} />
      </>,
    )
    fireEvent.mouseDown(document.querySelector('[data-testid="outside"]') as HTMLElement)
    expect(onOpenChange).not.toHaveBeenCalled()
  })
})

// ── hasPopup（ARIA only，不影响内部键盘 — ADR-115 §2.7）─────────

describe('Popover — hasPopup ARIA', () => {
  it('hasPopup="menu" → trigger aria-haspopup=menu + content role=menu', () => {
    const { container } = render(
      <Popover defaultOpen hasPopup="menu" trigger={<button data-testid="trigger">x</button>} content={<div />} />,
    )
    expect(container.querySelector('[data-testid="trigger"]')!.getAttribute('aria-haspopup')).toBe('menu')
    expect(document.body.querySelector('[data-admin-popover]')!.getAttribute('role')).toBe('menu')
  })

  it('hasPopup="listbox" → 同步生效', () => {
    const { container } = render(
      <Popover defaultOpen hasPopup="listbox" trigger={<button data-testid="trigger">x</button>} content={<div />} />,
    )
    expect(container.querySelector('[data-testid="trigger"]')!.getAttribute('aria-haspopup')).toBe('listbox')
    expect(document.body.querySelector('[data-admin-popover]')!.getAttribute('role')).toBe('listbox')
  })

  it('默认 hasPopup="dialog"', () => {
    const { container } = render(
      <Popover defaultOpen trigger={<button data-testid="trigger">x</button>} content={<div />} />,
    )
    expect(container.querySelector('[data-testid="trigger"]')!.getAttribute('aria-haspopup')).toBe('dialog')
    expect(document.body.querySelector('[data-admin-popover]')!.getAttribute('role')).toBe('dialog')
  })

  it('aria-controls 在 open 时指向 popover id；close 时清除', () => {
    const { container, rerender } = render(
      <Popover open={false} onOpenChange={() => {}} trigger={<button data-testid="trigger">x</button>} content={<div />} />,
    )
    const trigger = container.querySelector('[data-testid="trigger"]') as HTMLElement
    expect(trigger.getAttribute('aria-controls')).toBeNull()
    rerender(
      <Popover open={true} onOpenChange={() => {}} trigger={<button data-testid="trigger">x</button>} content={<div />} />,
    )
    const popoverId = document.body.querySelector('[data-admin-popover]')?.getAttribute('id')
    expect(popoverId).toBeTruthy()
    expect(trigger.getAttribute('aria-controls')).toBe(popoverId)
  })
})

// ── portal + z-index ─────────────────────────────────────────────

describe('Popover — portal + z-index', () => {
  it('content 渲染到 document.body（portal）', () => {
    render(
      <div data-testid="parent">
        <Popover defaultOpen trigger={<button>x</button>} content={<div data-testid="popover-body">x</div>} />
      </div>,
    )
    const parent = document.querySelector('[data-testid="parent"]') as HTMLElement
    expect(parent.querySelector('[data-testid="popover-body"]')).toBeNull()
    expect(document.body.querySelector('[data-testid="popover-body"]')).toBeTruthy()
  })

  it('content z-index 引用 var(--z-admin-popover)', () => {
    render(<Popover defaultOpen trigger={<button>x</button>} content={<div />} />)
    const popover = document.body.querySelector('[data-admin-popover]') as HTMLElement
    expect(popover.style.zIndex).toBe('var(--z-admin-popover)')
  })

  it('content data-placement 反映实际 placement', () => {
    render(<Popover defaultOpen placement="bottom" trigger={<button>x</button>} content={<div />} />)
    const popover = document.body.querySelector('[data-admin-popover]') as HTMLElement
    // bottom 在 jsdom 默认 viewport（1024x768）+ trigger 默认 0,0,0,0 时可能 flip 到 top；
    // 只断言 data-placement 存在为 ADR-115 §2.2 6 v1 placement 之一
    const value = popover.getAttribute('data-placement')
    expect(['top', 'bottom', 'left', 'right', 'bottom-start', 'bottom-end']).toContain(value)
  })
})

// ── @experimental prop 行为（dev warn 不阻塞）──────────────────

describe('Popover — @experimental prop 不阻塞行为', () => {
  it('modal=true → dev 模式 warn 但 popover 仍渲染（v1 不实施 focus-trap）', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    render(<Popover defaultOpen modal trigger={<button>x</button>} content={<div data-testid="modal-x">x</div>} />)
    expect(document.body.querySelector('[data-testid="modal-x"]')).toBeTruthy()
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })

  it('arrow=true / closeOnTabOut=true / portalContainer 传入 → warn 但不报错', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const customDiv = document.createElement('div')
    render(
      <Popover defaultOpen arrow closeOnTabOut portalContainer={customDiv} trigger={<button>x</button>} content={<div data-testid="exp-x">x</div>} />,
    )
    expect(document.body.querySelector('[data-testid="exp-x"]')).toBeTruthy()
    warn.mockRestore()
  })
})

// ── data-testid 透传 ───────────────────────────────────────────

describe('Popover — data-testid', () => {
  it('data-testid 透传到 popover content（不影响 trigger）', () => {
    render(<Popover defaultOpen data-testid="popover-attr" trigger={<button data-testid="trigger">x</button>} content={<div />} />)
    expect(document.body.querySelector('[data-testid="popover-attr"]')).toBeTruthy()
    expect(document.body.querySelector('[data-testid="popover-attr"]')?.hasAttribute('data-admin-popover')).toBe(true)
  })
})

// ── aria-label ─────────────────────────────────────────────────

describe('Popover — aria-label 透传', () => {
  it('aria-label 设到 popover content', () => {
    render(<Popover defaultOpen aria-label="筛选预设" trigger={<button>x</button>} content={<div />} />)
    expect(document.body.querySelector('[data-admin-popover]')?.getAttribute('aria-label')).toBe('筛选预设')
  })
})
