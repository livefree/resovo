import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { StackedPosterFrame } from '@/components/primitives/media/StackedPosterFrame'

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
})

// SafeImage renders an img; mock minimally so we control the output
vi.mock('@/components/media', () => ({
  SafeImage: ({ alt, imgClassName }: { alt: string; imgClassName?: string }) => (
    <img alt={alt} className={imgClassName} data-testid="poster-img" />
  ),
}))

vi.mock('@/lib/image/image-loader', () => ({
  getLoader: () => (src: string) => src,
}))

const defaultProps = {
  src: 'https://cdn.example.com/cover.jpg',
  alt: '测试视频',
  width: 200,
  height: 300,
  aspect: '2:3' as const,
  stackLevel: 0 as const,
}

describe('StackedPosterFrame', () => {
  describe('stackLevel=0（单层）', () => {
    it('不渲染阴影层', () => {
      const { container } = render(<StackedPosterFrame {...defaultProps} stackLevel={0} />)
      const ariaHidden = container.querySelectorAll('[aria-hidden="true"]')
      expect(ariaHidden.length).toBe(0)
    })

    it('渲染主图', () => {
      render(<StackedPosterFrame {...defaultProps} stackLevel={0} />)
      expect(screen.getByTestId('poster-img')).toBeTruthy()
    })
  })

  describe('stackLevel=1（双层）', () => {
    it('渲染两个 aria-hidden 阴影层', () => {
      const { container } = render(<StackedPosterFrame {...defaultProps} stackLevel={1} />)
      const layers = container.querySelectorAll('[aria-hidden="true"]')
      expect(layers.length).toBe(2)
    })

    it('阴影层有 pointer-events-none', () => {
      const { container } = render(<StackedPosterFrame {...defaultProps} stackLevel={1} />)
      const layers = container.querySelectorAll('[aria-hidden="true"]')
      for (const layer of layers) {
        expect(layer.className).toContain('pointer-events-none')
      }
    })

    it('主图有 overflow-hidden 容器（确保圆角裁剪）', () => {
      const { container } = render(<StackedPosterFrame {...defaultProps} stackLevel={1} />)
      const imgWrapper = container.querySelector('.overflow-hidden')
      expect(imgWrapper).toBeTruthy()
    })
  })

  describe('hover 交互', () => {
    it('mouseenter 后 30ms 触发 isHovered（scale 类应用）', async () => {
      vi.useFakeTimers()
      const { container } = render(<StackedPosterFrame {...defaultProps} stackLevel={0} />)
      const wrapper = container.firstChild as HTMLElement

      fireEvent.mouseEnter(wrapper)
      // 未到 30ms，img 无 scale-[1.03]
      expect(screen.getByTestId('poster-img').className).not.toContain('scale-[1.03]')

      await act(async () => { vi.advanceTimersByTime(30) })
      expect(screen.getByTestId('poster-img').className).toContain('scale-[1.03]')

      vi.useRealTimers()
    })

    it('mouseleave 立即清除 hover', async () => {
      vi.useFakeTimers()
      const { container } = render(<StackedPosterFrame {...defaultProps} stackLevel={0} />)
      const wrapper = container.firstChild as HTMLElement

      fireEvent.mouseEnter(wrapper)
      await act(async () => { vi.advanceTimersByTime(30) })
      expect(screen.getByTestId('poster-img').className).toContain('scale-[1.03]')

      fireEvent.mouseLeave(wrapper)
      expect(screen.getByTestId('poster-img').className).not.toContain('scale-[1.03]')

      vi.useRealTimers()
    })

    it('mouseleave 在 debounce 内不触发 hover', async () => {
      vi.useFakeTimers()
      const { container } = render(<StackedPosterFrame {...defaultProps} stackLevel={0} />)
      const wrapper = container.firstChild as HTMLElement

      fireEvent.mouseEnter(wrapper)
      // leave before 30ms fires
      fireEvent.mouseLeave(wrapper)
      await act(async () => { vi.advanceTimersByTime(30) })

      expect(screen.getByTestId('poster-img').className).not.toContain('scale-[1.03]')

      vi.useRealTimers()
    })
  })

  describe('getStackLevel 映射', () => {
    it('series → stackLevel=1 应显示两个阴影层（集成验证）', async () => {
      const { getStackLevel } = await import('@/lib/video-stack-level')
      expect(getStackLevel('series')).toBe(1)
      expect(getStackLevel('anime')).toBe(1)
      expect(getStackLevel('movie')).toBe(0)
      expect(getStackLevel('short')).toBe(0)
    })
  })
})
