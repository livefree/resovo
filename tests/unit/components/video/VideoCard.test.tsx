import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { VideoCard } from '@/components/video/VideoCard'
import type { VideoCard as VideoCardType } from '@/types'

vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={props.src as string} alt={props.alt as string} />
  ),
}))

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode; [k: string]: unknown }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}))

function makeVideo(overrides?: Partial<VideoCardType>): VideoCardType {
  return {
    id: 'v1',
    shortId: 'ab12cd34',
    slug: 'demo-title',
    title: '演示视频',
    titleEn: null,
    coverUrl: 'https://cdn.example.com/demo.jpg',
    type: 'movie',
    rating: 8.3,
    year: 2025,
    status: 'completed',
    episodeCount: 12,
    sourceCount: 2,
    ...overrides,
  }
}

describe('VideoCard', () => {
  it('uses slug path for detail and watch links', () => {
    render(<VideoCard video={makeVideo()} />)
    const detailLink = screen.getByLabelText('演示视频') as HTMLAnchorElement
    const playLink = screen.getByLabelText('Play Now') as HTMLAnchorElement

    expect(detailLink.getAttribute('href')).toBe('/movie/demo-title-ab12cd34')
    expect(playLink.getAttribute('href')).toBe('/watch/demo-title-ab12cd34?ep=1')
  })

  it('falls back to shortId path when slug is null', () => {
    render(<VideoCard video={makeVideo({ slug: null })} />)
    const detailLink = screen.getByLabelText('演示视频') as HTMLAnchorElement
    const playLink = screen.getByLabelText('Play Now') as HTMLAnchorElement

    expect(detailLink.getAttribute('href')).toBe('/movie/ab12cd34')
    expect(playLink.getAttribute('href')).toBe('/watch/ab12cd34?ep=1')
  })

  it('renders year and episode count text for series-style data', () => {
    render(<VideoCard video={makeVideo({ type: 'series', episodeCount: 24, rating: null })} />)
    expect(screen.getByText('2025 · 24集')).toBeTruthy()
  })
})
