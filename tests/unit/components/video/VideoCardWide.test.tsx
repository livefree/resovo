import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { VideoCardWide } from '@/components/video/VideoCardWide'
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
    id: 'v2',
    shortId: 'ef56gh78',
    slug: 'wide-title',
    title: '横版演示',
    titleEn: null,
    coverUrl: 'https://cdn.example.com/wide.jpg',
    type: 'series',
    rating: 7.9,
    year: 2024,
    status: 'ongoing',
    episodeCount: 16,
    sourceCount: 3,
    ...overrides,
  }
}

describe('VideoCardWide', () => {
  it('uses slug path for detail and watch links', () => {
    render(<VideoCardWide video={makeVideo()} />)
    const detailLink = screen.getByLabelText('横版演示') as HTMLAnchorElement
    const playLink = screen.getByLabelText('Play Now') as HTMLAnchorElement

    expect(detailLink.getAttribute('href')).toBe('/series/wide-title-ef56gh78')
    expect(playLink.getAttribute('href')).toBe('/watch/wide-title-ef56gh78?ep=1')
  })

  it('falls back to shortId path when slug is null', () => {
    render(<VideoCardWide video={makeVideo({ slug: null })} />)
    const detailLink = screen.getByLabelText('横版演示') as HTMLAnchorElement
    const playLink = screen.getByLabelText('Play Now') as HTMLAnchorElement

    expect(detailLink.getAttribute('href')).toBe('/series/ef56gh78')
    expect(playLink.getAttribute('href')).toBe('/watch/ef56gh78?ep=1')
  })

  it('renders status and episode summary text', () => {
    render(<VideoCardWide video={makeVideo()} />)
    expect(screen.getByText('连载中')).toBeTruthy()
    expect(screen.getByText('2024 · 全 16 集')).toBeTruthy()
  })
})
