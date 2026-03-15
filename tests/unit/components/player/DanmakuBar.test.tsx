/**
 * tests/unit/components/player/DanmakuBar.test.tsx
 * PLAYER-07: DanmakuBar 开关状态、颜色切换
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DanmakuBar, hexToInt } from '@/components/player/DanmakuBar'

// CCL 不支持 JSDOM，mock 掉 require
vi.mock('comment-core-library/dist/CommentCoreLibrary', () => ({}))

describe('DanmakuBar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('渲染弹幕条', () => {
    render(<DanmakuBar />)
    expect(screen.getByTestId('danmaku-bar')).toBeTruthy()
  })

  it('初始状态弹幕开关为开启（aria-pressed=true）', () => {
    render(<DanmakuBar />)
    const toggle = screen.getByTestId('danmaku-toggle')
    expect(toggle.getAttribute('aria-pressed')).toBe('true')
  })

  it('点击弹幕开关可关闭（aria-pressed=false）', () => {
    render(<DanmakuBar />)
    const toggle = screen.getByTestId('danmaku-toggle')
    fireEvent.click(toggle)
    expect(toggle.getAttribute('aria-pressed')).toBe('false')
  })

  it('再次点击弹幕开关可重新开启', () => {
    render(<DanmakuBar />)
    const toggle = screen.getByTestId('danmaku-toggle')
    fireEvent.click(toggle)
    fireEvent.click(toggle)
    expect(toggle.getAttribute('aria-pressed')).toBe('true')
  })

  it('渲染透明度和字号滑条', () => {
    render(<DanmakuBar />)
    expect(screen.getByTestId('danmaku-opacity-slider')).toBeTruthy()
    expect(screen.getByTestId('danmaku-fontsize-slider')).toBeTruthy()
  })

  it('渲染 6 个预设颜色按钮', () => {
    render(<DanmakuBar />)
    const picker = screen.getByTestId('danmaku-color-picker')
    const colorBtns = picker.querySelectorAll('button')
    expect(colorBtns).toHaveLength(6)
  })

  it('初始颜色为白色（#ffffff，aria-pressed=true）', () => {
    render(<DanmakuBar />)
    const whiteBtn = screen.getByTestId('danmaku-color-ffffff')
    expect(whiteBtn.getAttribute('aria-pressed')).toBe('true')
  })

  it('点击红色按钮切换颜色（#ff6b6b aria-pressed 变为 true）', () => {
    render(<DanmakuBar />)
    const redBtn = screen.getByTestId('danmaku-color-ff6b6b')
    fireEvent.click(redBtn)
    expect(redBtn.getAttribute('aria-pressed')).toBe('true')
    // 白色按钮不再选中
    const whiteBtn = screen.getByTestId('danmaku-color-ffffff')
    expect(whiteBtn.getAttribute('aria-pressed')).toBe('false')
  })

  it('点击不同颜色按钮只有一个 aria-pressed=true', () => {
    render(<DanmakuBar />)
    const colors = ['ff6b6b', 'ffd93d', '6bcb77', '4d96ff', 'c77dff']
    for (const c of colors) {
      fireEvent.click(screen.getByTestId(`danmaku-color-${c}`))
      expect(screen.getByTestId(`danmaku-color-${c}`).getAttribute('aria-pressed')).toBe('true')
      expect(screen.getByTestId('danmaku-color-ffffff').getAttribute('aria-pressed')).toBe('false')
    }
  })

  it('未登录时输入框 disabled', () => {
    render(<DanmakuBar isLoggedIn={false} />)
    const input = screen.getByTestId('danmaku-input') as HTMLInputElement
    expect(input.disabled).toBe(true)
  })

  it('已登录时输入框不 disabled', () => {
    render(<DanmakuBar isLoggedIn={true} />)
    const input = screen.getByTestId('danmaku-input') as HTMLInputElement
    expect(input.disabled).toBe(false)
  })

  it('未登录时发送按钮 disabled', () => {
    render(<DanmakuBar isLoggedIn={false} />)
    const btn = screen.getByTestId('danmaku-send-btn') as HTMLButtonElement
    expect(btn.disabled).toBe(true)
  })

  it('已登录但输入框为空时发送按钮 disabled', () => {
    render(<DanmakuBar isLoggedIn={true} />)
    const btn = screen.getByTestId('danmaku-send-btn') as HTMLButtonElement
    expect(btn.disabled).toBe(true)
  })

  it('已登录且有输入内容时发送按钮可用', () => {
    render(<DanmakuBar isLoggedIn={true} />)
    fireEvent.change(screen.getByTestId('danmaku-input'), { target: { value: '测试弹幕' } })
    const btn = screen.getByTestId('danmaku-send-btn') as HTMLButtonElement
    expect(btn.disabled).toBe(false)
  })

  it('点击发送后输入框清空', () => {
    render(<DanmakuBar isLoggedIn={true} />)
    const input = screen.getByTestId('danmaku-input') as HTMLInputElement
    fireEvent.change(input, { target: { value: '测试弹幕' } })
    fireEvent.click(screen.getByTestId('danmaku-send-btn'))
    expect(input.value).toBe('')
  })

  it('Enter 键发送弹幕后输入框清空', () => {
    render(<DanmakuBar isLoggedIn={true} />)
    const input = screen.getByTestId('danmaku-input') as HTMLInputElement
    fireEvent.change(input, { target: { value: '回车弹幕' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(input.value).toBe('')
  })

  it('未登录时 placeholder 为登录提示', () => {
    render(<DanmakuBar isLoggedIn={false} />)
    const input = screen.getByTestId('danmaku-input') as HTMLInputElement
    expect(input.placeholder).toContain('登录')
  })

  it('已登录时 placeholder 为发弹幕提示', () => {
    render(<DanmakuBar isLoggedIn={true} />)
    const input = screen.getByTestId('danmaku-input') as HTMLInputElement
    expect(input.placeholder).toContain('弹幕')
  })
})

describe('hexToInt', () => {
  it('#ffffff → 16777215', () => {
    expect(hexToInt('#ffffff')).toBe(0xffffff)
  })

  it('#ff0000 → 16711680', () => {
    expect(hexToInt('#ff0000')).toBe(0xff0000)
  })

  it('#0000ff → 255', () => {
    expect(hexToInt('#0000ff')).toBe(0x0000ff)
  })

  it('#6bcb77 → 正确 RGB 整数', () => {
    expect(hexToInt('#6bcb77')).toBe((0x6b << 16) | (0xcb << 8) | 0x77)
  })
})
