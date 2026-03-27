import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Nav } from '@/components/layout/Nav'

const pushMock = vi.fn()

vi.mock('next/navigation', () => ({
  usePathname: () => '/en/browse',
  useRouter: () => ({ push: pushMock }),
  useSearchParams: () => ({
    get: (key: string) => {
      if (key === 'type') return 'movie'
      return null
    },
  }),
}))

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => {
    const dict: Record<string, string> = {
      'nav.home': 'Home',
      'nav.more': 'More',
      'nav.catMovie': 'Movie',
      'nav.catSeries': 'Series',
      'nav.catAnime': 'Anime',
      'nav.catAll': 'All',
      'nav.catVariety': 'Variety',
      'nav.search': 'Search',
      'nav.signIn': 'Sign In',
    }
    return dict[key] ?? key
  },
}))

vi.mock('@/stores/authStore', () => ({
  useAuthStore: () => ({ user: null, logout: vi.fn() }),
}))

vi.mock('@/components/ui/ThemeToggle', () => ({
  ThemeToggle: () => <button type="button" data-testid="theme-toggle">theme</button>,
}))

vi.mock('@/lib/api-client', () => ({
  apiClient: { post: vi.fn() },
}))

describe('Nav dropdown interactions (CHG-269)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('opens more menu on trigger click', async () => {
    render(<Nav />)
    fireEvent.click(screen.getByTestId('nav-more-trigger'))

    expect(screen.getByTestId('nav-more-menu')).toBeTruthy()
    expect(screen.getByTestId('nav-more-trigger').getAttribute('aria-expanded')).toBe('true')
  })

  it('closes more menu when clicking outside', async () => {
    render(<Nav />)
    fireEvent.click(screen.getByTestId('nav-more-trigger'))
    expect(screen.getByTestId('nav-more-menu')).toBeTruthy()

    fireEvent.mouseDown(document.body)

    await waitFor(() => {
      expect(screen.queryByTestId('nav-more-menu')).toBeNull()
      expect(screen.getByTestId('nav-more-trigger').getAttribute('aria-expanded')).toBe('false')
    })
  })

  it('closes more menu on Escape', async () => {
    render(<Nav />)
    fireEvent.click(screen.getByTestId('nav-more-trigger'))
    expect(screen.getByTestId('nav-more-menu')).toBeTruthy()

    fireEvent.keyDown(document, { key: 'Escape' })

    await waitFor(() => {
      expect(screen.queryByTestId('nav-more-menu')).toBeNull()
      expect(screen.getByTestId('nav-more-trigger').getAttribute('aria-expanded')).toBe('false')
    })
  })

  it('opens more menu with Enter key and focuses first item', async () => {
    render(<Nav />)

    const trigger = screen.getByTestId('nav-more-trigger')
    fireEvent.keyDown(trigger, { key: 'Enter' })

    await waitFor(() => {
      const firstItem = screen.getByTestId('nav-cat-all')
      expect(screen.getByTestId('nav-more-menu')).toBeTruthy()
      expect(document.activeElement).toBe(firstItem)
    })
  })
})
