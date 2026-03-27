import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { ResumePrompt, saveProgress } from '@/components/player/ResumePrompt'

describe('ResumePrompt', () => {
  const shortId = 'abcd1234'
  const episode = 1

  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('does not render when saved progress is too short', () => {
    saveProgress(shortId, episode, 18)
    render(
      <ResumePrompt
        shortId={shortId}
        episode={episode}
        onResume={vi.fn()}
        onRestart={vi.fn()}
      />
    )
    expect(screen.queryByTestId('resume-prompt')).toBeNull()
  })

  it('renders prompt and continues from saved time', () => {
    const onResume = vi.fn()
    saveProgress(shortId, episode, 132)
    render(
      <ResumePrompt
        shortId={shortId}
        episode={episode}
        onResume={onResume}
        onRestart={vi.fn()}
      />
    )

    expect(screen.getByTestId('resume-prompt')).toBeTruthy()
    fireEvent.click(screen.getByTestId('resume-continue-btn'))
    expect(onResume).toHaveBeenCalledWith(132)
  })

  it('can restart from beginning', () => {
    const onRestart = vi.fn()
    saveProgress(shortId, episode, 240)
    render(
      <ResumePrompt
        shortId={shortId}
        episode={episode}
        onResume={vi.fn()}
        onRestart={onRestart}
      />
    )

    fireEvent.click(screen.getByTestId('resume-restart-btn'))
    expect(onRestart).toHaveBeenCalledTimes(1)
  })
})
