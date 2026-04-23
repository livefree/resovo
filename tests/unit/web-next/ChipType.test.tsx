import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ChipType } from '@/components/primitives/chip-type'
import type { VideoType } from '@resovo/types'

// mock next-intl（key 即 label，便于断言）
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

const ALL_TYPES: VideoType[] = [
  'movie',
  'series',
  'anime',
  'variety',
  'documentary',
  'short',
  'sports',
  'music',
  'news',
  'kids',
  'other',
]

describe('ChipType — 11 种 VideoType 全覆盖', () => {
  for (const t of ALL_TYPES) {
    it(`type=${t} 渲染对应 label + data-chip-type + tokens 引用`, () => {
      const { container } = render(<ChipType type={t} />)
      // label = i18n key（mock 透传）
      expect(screen.getByText(t)).toBeTruthy()
      // data-chip-type attribute
      const el = container.querySelector<HTMLElement>(`[data-chip-type="${t}"]`)
      expect(el).not.toBeNull()
      // 内联 style 引用对应 token 变量
      expect(el!.style.background).toContain(`--tag-chip-${t}-bg`)
      expect(el!.style.color).toContain(`--tag-chip-${t}-fg`)
    })
  }
})

describe('ChipType — size 变体', () => {
  it('默认 size=sm', () => {
    const { container } = render(<ChipType type="movie" />)
    const el = container.querySelector<HTMLElement>('[data-chip-type="movie"]')
    expect(el!.className).toContain('text-[11px]')
  })

  it('size=md 放大字号与 padding', () => {
    const { container } = render(<ChipType type="movie" size="md" />)
    const el = container.querySelector<HTMLElement>('[data-chip-type="movie"]')
    expect(el!.className).toContain('text-[12px]')
    expect(el!.className).toContain('px-2.5')
  })
})

describe('ChipType — 未知 type fallback', () => {
  it('非法 type 字符串降级到 other（防 VideoType 扩展早于 tokens 跟进）', () => {
    // @ts-expect-error intentionally passing invalid type
    const { container } = render(<ChipType type="invalid-type" />)
    const el = container.querySelector<HTMLElement>('[data-chip-type="other"]')
    expect(el).not.toBeNull()
    expect(el!.style.background).toContain('--tag-chip-other-bg')
  })
})

describe('ChipType — data-testid', () => {
  it('未传 data-testid 时使用默认 chip-type-{type}', () => {
    render(<ChipType type="anime" />)
    expect(screen.getByTestId('chip-type-anime')).toBeTruthy()
  })

  it('传 data-testid 时用外部值', () => {
    render(<ChipType type="movie" data-testid="my-chip" />)
    expect(screen.getByTestId('my-chip')).toBeTruthy()
  })
})

describe('ChipType — 可扩展性', () => {
  it('className 追加外部类名', () => {
    const { container } = render(<ChipType type="series" className="custom-class" />)
    const el = container.querySelector<HTMLElement>('[data-chip-type="series"]')
    expect(el!.className).toContain('custom-class')
  })

  it('基础 className 仍保留（font-semibold / rounded-md 等）', () => {
    const { container } = render(<ChipType type="series" className="custom-class" />)
    const el = container.querySelector<HTMLElement>('[data-chip-type="series"]')
    expect(el!.className).toContain('font-semibold')
    expect(el!.className).toContain('rounded-md')
  })
})
