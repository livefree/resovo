/**
 * ToastViewport 渲染单测（CHG-SN-2-03）
 *
 * 覆盖：渲染 queue 各条 / 自动消失 timer / level='danger' 不自动消失 /
 * dismiss 按钮 / action 按钮触发回调 / position attribute / SSR 渲染 empty
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, act, cleanup } from '@testing-library/react'
import { useEffect } from 'react'
import {
  ToastViewport,
} from '../../../../../packages/admin-ui/src/shell/toast-viewport'
import {
  toastStore,
  DEFAULT_MAX_QUEUE,
} from '../../../../../packages/admin-ui/src/shell/toast-store'
import { useToast } from '../../../../../packages/admin-ui/src/shell/use-toast'

beforeEach(() => {
  vi.useFakeTimers()
  toastStore.getState().dismissAll()
  toastStore.getState().setMaxQueue(DEFAULT_MAX_QUEUE)
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('ToastViewport — 渲染', () => {
  it('mount 后队列为空 → 无 toast 卡渲染', () => {
    render(<ToastViewport />)
    expect(screen.queryAllByRole('status')).toHaveLength(0)
  })

  it('push 后 viewport 渲染对应 toast 卡（title + description）', () => {
    render(<ToastViewport />)
    act(() => {
      toastStore.getState().push({ title: '保存成功', description: 'video #42 已上线', level: 'success' })
    })
    expect(screen.getByText('保存成功')).toBeTruthy()
    expect(screen.getByText('video #42 已上线')).toBeTruthy()
  })

  it('position prop 写入 data-toast-viewport attribute', () => {
    const { container } = render(<ToastViewport position="top-left" />)
    const viewport = container.querySelector('[data-toast-viewport]')
    expect(viewport?.getAttribute('data-toast-viewport')).toBe('top-left')
  })

  it('position 默认值 = "bottom-right"（ADR-103a §4.1.7 契约不变量）', () => {
    const { container } = render(<ToastViewport />)
    const viewport = container.querySelector('[data-toast-viewport]')
    expect(viewport?.getAttribute('data-toast-viewport')).toBe('bottom-right')
  })

  it('level → data-toast-level attribute 透传', () => {
    render(<ToastViewport />)
    act(() => {
      toastStore.getState().push({ title: '错误', level: 'danger' })
    })
    const card = screen.getByRole('status')
    expect(card.getAttribute('data-toast-level')).toBe('danger')
  })
})

describe('ToastViewport — 自动消失 timer', () => {
  it('default duration (4000ms) 后自动 dismiss', () => {
    render(<ToastViewport />)
    act(() => {
      toastStore.getState().push({ title: 'a', level: 'info' })
    })
    expect(toastStore.getState().queue).toHaveLength(1)
    act(() => {
      vi.advanceTimersByTime(4000)
    })
    expect(toastStore.getState().queue).toHaveLength(0)
  })

  it('level=danger 不自动消失（effectiveDuration=0 → timer 不调度）', () => {
    render(<ToastViewport />)
    act(() => {
      toastStore.getState().push({ title: '错误', level: 'danger' })
    })
    act(() => {
      vi.advanceTimersByTime(60000)  // 60s 后仍存在
    })
    expect(toastStore.getState().queue).toHaveLength(1)
  })

  it('显式 durationMs 覆盖默认（1500ms 后消失）', () => {
    render(<ToastViewport />)
    act(() => {
      toastStore.getState().push({ title: 'a', level: 'info', durationMs: 1500 })
    })
    act(() => {
      vi.advanceTimersByTime(1499)
    })
    expect(toastStore.getState().queue).toHaveLength(1)
    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(toastStore.getState().queue).toHaveLength(0)
  })
})

describe('ToastViewport — dismiss 按钮 + action 按钮', () => {
  it('点击关闭按钮立即 dismiss 该条', () => {
    render(<ToastViewport />)
    act(() => {
      toastStore.getState().push({ title: 'a', level: 'info', durationMs: 0 })
    })
    const closeBtn = screen.getByRole('button', { name: '关闭通知' })
    act(() => {
      closeBtn.click()
    })
    expect(toastStore.getState().queue).toHaveLength(0)
  })

  it('点击 action 按钮触发回调 + dismiss', () => {
    const onClick = vi.fn()
    render(<ToastViewport />)
    act(() => {
      toastStore.getState().push({
        title: '保存失败',
        level: 'danger',
        action: { label: '重试', onClick },
      })
    })
    const actionBtn = screen.getByRole('button', { name: '重试' })
    act(() => {
      actionBtn.click()
    })
    expect(onClick).toHaveBeenCalledTimes(1)
    expect(toastStore.getState().queue).toHaveLength(0)
  })
})

describe('useToast — hook API', () => {
  it('useToast 返回稳定引用 { push, dismiss, dismissAll }', () => {
    let captured1: ReturnType<typeof useToast> | null = null
    let captured2: ReturnType<typeof useToast> | null = null
    function Probe() {
      const t1 = useToast()
      useEffect(() => {
        captured1 = t1
      }, [t1])
      const t2 = useToast()
      useEffect(() => {
        captured2 = t2
      }, [t2])
      return null
    }
    render(<Probe />)
    expect(captured1).not.toBeNull()
    expect(captured1).toBe(captured2)
  })

  it('useToast().push → ToastViewport 渲染该条', () => {
    function Probe() {
      const { push } = useToast()
      useEffect(() => {
        push({ title: 'hooked', level: 'info' })
      }, [push])
      return null
    }
    render(
      <>
        <ToastViewport />
        <Probe />
      </>,
    )
    expect(screen.getByText('hooked')).toBeTruthy()
  })
})

describe('ToastViewport — props.maxQueue 同步到 store', () => {
  it('mount 时 setMaxQueue(props.maxQueue) 生效', () => {
    render(<ToastViewport maxQueue={2} />)
    expect(toastStore.getState().maxQueue).toBe(2)
  })

  it('props.maxQueue 变更后下次 push 按新阈值 FIFO', () => {
    const { rerender } = render(<ToastViewport maxQueue={5} />)
    act(() => {
      toastStore.getState().push({ title: 't1', level: 'info', durationMs: 0 })
      toastStore.getState().push({ title: 't2', level: 'info', durationMs: 0 })
      toastStore.getState().push({ title: 't3', level: 'info', durationMs: 0 })
    })
    expect(toastStore.getState().queue).toHaveLength(3)
    rerender(<ToastViewport maxQueue={2} />)
    expect(toastStore.getState().queue).toHaveLength(2)
    expect(toastStore.getState().queue.map((t) => t.title)).toEqual(['t2', 't3'])
  })

  it('setMaxQueue(0) 边界：push 后立即清空（FIFO 极端 = 不持久任何条目）', () => {
    render(<ToastViewport maxQueue={0} />)
    expect(toastStore.getState().maxQueue).toBe(0)
    act(() => {
      toastStore.getState().push({ title: 't1', level: 'info', durationMs: 0 })
    })
    expect(toastStore.getState().queue).toHaveLength(0)
  })
})

describe('ToastViewport — 多 ViewPort 实例共享同一 store（ADR-103a §4.4-1 单例不变量）', () => {
  it('两个 ViewPort 同时 mount 时 push 一条 → 两个 viewport 都渲染该条', () => {
    render(
      <>
        <ToastViewport position="top-right" />
        <ToastViewport position="bottom-left" />
      </>,
    )
    act(() => {
      toastStore.getState().push({ title: 'shared', level: 'info', durationMs: 0 })
    })
    const cards = screen.getAllByText('shared')
    expect(cards).toHaveLength(2)
  })
})
