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
    it('不设置 box-shadow', () => {
      const { container } = render(<StackedPosterFrame {...defaultProps} stackLevel={0} />)
      const wrapper = container.firstChild as HTMLElement
      expect(wrapper.style.boxShadow).toBeFalsy()
    })

    it('无额外阴影 DOM 节点（no-extra-DOM 合约）', () => {
      const { container } = render(<StackedPosterFrame {...defaultProps} stackLevel={0} />)
      // wrapper + img inside SafeImage = 2 nodes max; no aria-hidden shadow divs
      const ariaHidden = container.querySelectorAll('[aria-hidden]')
      expect(ariaHidden.length).toBe(0)
    })

    it('渲染主图', () => {
      render(<StackedPosterFrame {...defaultProps} stackLevel={0} />)
      expect(screen.getByTestId('poster-img')).toBeTruthy()
    })
  })

  describe('stackLevel=1（双层 box-shadow）', () => {
    it('设置 box-shadow（包含两层）', () => {
      const { container } = render(<StackedPosterFrame {...defaultProps} stackLevel={1} />)
      const wrapper = container.firstChild as HTMLElement
      expect(wrapper.style.boxShadow).toBeTruthy()
      // Two shadow layers separated by comma
      expect(wrapper.style.boxShadow.split(',').length).toBe(2)
    })

    it('无额外 DOM 阴影节点', () => {
      const { container } = render(<StackedPosterFrame {...defaultProps} stackLevel={1} />)
      const ariaHidden = container.querySelectorAll('[aria-hidden]')
      expect(ariaHidden.length).toBe(0)
    })

    it('wrapper 有 overflow-hidden（主图圆角裁剪）', () => {
      const { container } = render(<StackedPosterFrame {...defaultProps} stackLevel={1} />)
      expect((container.firstChild as HTMLElement).className).toContain('overflow-hidden')
    })
  })

  describe('hover 交互', () => {
    it('mouseenter 后 30ms 触发 scale', async () => {
      vi.useFakeTimers()
      const { container } = render(<StackedPosterFrame {...defaultProps} stackLevel={0} />)
      const wrapper = container.firstChild as HTMLElement

      fireEvent.mouseEnter(wrapper)
      expect(screen.getByTestId('poster-img').className).not.toContain('scale-[1.03]')

      await act(async () => { vi.advanceTimersByTime(30) })
      expect(screen.getByTestId('poster-img').className).toContain('scale-[1.03]')

      vi.useRealTimers()
    })

    it('mouseleave 在 debounce 期内取消 hover', async () => {
      vi.useFakeTimers()
      const { container } = render(<StackedPosterFrame {...defaultProps} stackLevel={0} />)
      const wrapper = container.firstChild as HTMLElement

      fireEvent.mouseEnter(wrapper)
      fireEvent.mouseLeave(wrapper)
      await act(async () => { vi.advanceTimersByTime(30) })

      expect(screen.getByTestId('poster-img').className).not.toContain('scale-[1.03]')

      vi.useRealTimers()
    })

    it('mouseleave 立即清除 hover 状态', async () => {
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
  })

  describe('reduced-motion', () => {
    it('prefersReduced 时 wrapper transition 为 none', () => {
      // Override matchMedia to return prefers-reduced: true
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation((query: string) => ({
          matches: query === '(prefers-reduced-motion: reduce)',
          media: query,
          onchange: null,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        })),
      })

      const { container } = render(<StackedPosterFrame {...defaultProps} stackLevel={1} />)
      const wrapper = container.firstChild as HTMLElement
      expect(wrapper.style.transition).toBe('none')

      // Restore
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
  })

  describe('getStackLevel 映射', () => {
    it('series/anime → 1；movie/short/variety/documentary → 0', async () => {
      const { getStackLevel } = await import('@/lib/video-stack-level')
      expect(getStackLevel('series')).toBe(1)
      expect(getStackLevel('anime')).toBe(1)
      expect(getStackLevel('variety')).toBe(1)   // variety routes as /tvshow/ per ADR-048
      expect(getStackLevel('movie')).toBe(0)
      expect(getStackLevel('short')).toBe(0)
      expect(getStackLevel('documentary')).toBe(0)
    })
  })
})
