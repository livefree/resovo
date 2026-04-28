/**
 * toast-store 单测（CHG-SN-2-03）
 *
 * 覆盖：push 返回 toastId / dismiss / dismissAll / FIFO 溢出 / effectiveDuration
 * 计算（默认 4000ms / danger 永驻 / 显式 durationMs 覆盖）/ setMaxQueue 同步
 */
import { describe, it, expect, beforeEach } from 'vitest'
import {
  createToastStore,
  DEFAULT_DURATION_MS,
  DEFAULT_MAX_QUEUE,
} from '../../../../../packages/admin-ui/src/shell/toast-store'

describe('toast-store — push / dismiss / dismissAll', () => {
  it('push 返回 toastId 字符串且每次唯一', () => {
    const store = createToastStore()
    const id1 = store.getState().push({ title: 'a', level: 'info' })
    const id2 = store.getState().push({ title: 'b', level: 'info' })
    expect(typeof id1).toBe('string')
    expect(typeof id2).toBe('string')
    expect(id1).not.toBe(id2)
    expect(store.getState().queue).toHaveLength(2)
  })

  it('dismiss 按 id 移除单条；不影响其他', () => {
    const store = createToastStore()
    const id1 = store.getState().push({ title: 'a', level: 'info' })
    store.getState().push({ title: 'b', level: 'info' })
    store.getState().dismiss(id1)
    expect(store.getState().queue).toHaveLength(1)
    expect(store.getState().queue[0]?.title).toBe('b')
  })

  it('dismissAll 清空队列', () => {
    const store = createToastStore()
    store.getState().push({ title: 'a', level: 'info' })
    store.getState().push({ title: 'b', level: 'warn' })
    store.getState().dismissAll()
    expect(store.getState().queue).toHaveLength(0)
  })
})

describe('toast-store — FIFO 溢出', () => {
  it('queue 超过 maxQueue 时移除最早项（FIFO）', () => {
    const store = createToastStore()
    store.getState().setMaxQueue(3)
    const id1 = store.getState().push({ title: 't1', level: 'info' })
    store.getState().push({ title: 't2', level: 'info' })
    store.getState().push({ title: 't3', level: 'info' })
    store.getState().push({ title: 't4', level: 'info' })
    const titles = store.getState().queue.map((t) => t.title)
    expect(titles).toEqual(['t2', 't3', 't4'])
    expect(store.getState().queue.find((t) => t.id === id1)).toBeUndefined()
  })

  it('setMaxQueue 缩小时立即裁剪现有 queue', () => {
    const store = createToastStore()
    store.getState().push({ title: 't1', level: 'info' })
    store.getState().push({ title: 't2', level: 'info' })
    store.getState().push({ title: 't3', level: 'info' })
    store.getState().setMaxQueue(2)
    expect(store.getState().queue).toHaveLength(2)
    expect(store.getState().queue.map((t) => t.title)).toEqual(['t2', 't3'])
  })
})

describe('toast-store — effectiveDuration 解析（ADR-103a §4.1.7 默认规则）', () => {
  it('显式 durationMs 优先（含 0 永驻）', () => {
    const store = createToastStore()
    store.getState().push({ title: 'a', level: 'info', durationMs: 1500 })
    store.getState().push({ title: 'b', level: 'danger', durationMs: 2000 })
    store.getState().push({ title: 'c', level: 'info', durationMs: 0 })
    const durations = store.getState().queue.map((t) => t.effectiveDuration)
    expect(durations).toEqual([1500, 2000, 0])
  })

  it('未指定 durationMs + level=danger → 0（永驻不自动消失）', () => {
    const store = createToastStore()
    store.getState().push({ title: 'a', level: 'danger' })
    expect(store.getState().queue[0]?.effectiveDuration).toBe(0)
  })

  it('未指定 durationMs + 其他 level → DEFAULT_DURATION_MS', () => {
    const store = createToastStore()
    store.getState().push({ title: 'a', level: 'info' })
    store.getState().push({ title: 'b', level: 'success' })
    store.getState().push({ title: 'c', level: 'warn' })
    expect(store.getState().queue[0]?.effectiveDuration).toBe(DEFAULT_DURATION_MS)
    expect(store.getState().queue[1]?.effectiveDuration).toBe(DEFAULT_DURATION_MS)
    expect(store.getState().queue[2]?.effectiveDuration).toBe(DEFAULT_DURATION_MS)
  })
})

describe('toast-store — 默认值不变量', () => {
  it('DEFAULT_DURATION_MS = 4000 / DEFAULT_MAX_QUEUE = 5（与 ADR-103a §4.1.7 默认值锁定）', () => {
    expect(DEFAULT_DURATION_MS).toBe(4000)
    expect(DEFAULT_MAX_QUEUE).toBe(5)
  })

  it('新 store 默认 maxQueue = DEFAULT_MAX_QUEUE', () => {
    const store = createToastStore()
    expect(store.getState().maxQueue).toBe(DEFAULT_MAX_QUEUE)
  })
})

describe('toast-store — action 字段保留（ToastViewport 渲染依赖）', () => {
  it('action 在 push 后存于 ToastItem（含 label + onClick）', () => {
    const store = createToastStore()
    const onClick = () => {}
    store.getState().push({
      title: 'a',
      level: 'info',
      action: { label: '查看', onClick },
    })
    const item = store.getState().queue[0]
    expect(item?.action?.label).toBe('查看')
    expect(item?.action?.onClick).toBe(onClick)
  })
})

describe('toast-store — 单例 toastStore 模块顶层零副作用（SSR 安全）', () => {
  // 复用 ESM 单例：跨 describe 测试 toastStore 当前 queue 状态需先清理
  beforeEach(async () => {
    const { toastStore } = await import('../../../../../packages/admin-ui/src/shell/toast-store')
    toastStore.getState().dismissAll()
    toastStore.getState().setMaxQueue(DEFAULT_MAX_QUEUE)
  })

  it('toastStore 单例 import 后 queue 为 empty 且 maxQueue 默认值', async () => {
    const { toastStore } = await import('../../../../../packages/admin-ui/src/shell/toast-store')
    expect(toastStore.getState().queue).toHaveLength(0)
    expect(toastStore.getState().maxQueue).toBe(DEFAULT_MAX_QUEUE)
  })
})
