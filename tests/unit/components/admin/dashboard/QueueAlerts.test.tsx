/**
 * tests/unit/components/admin/dashboard/QueueAlerts.test.tsx
 * CHG-25: QueueAlerts 有/无队列时渲染差异
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueueAlerts } from '@/components/admin/dashboard/QueueAlerts'

describe('QueueAlerts', () => {
  it('submissions=0 且 subtitles=0 时不渲染', () => {
    render(<QueueAlerts queues={{ submissions: 0, subtitles: 0 }} />)
    expect(screen.queryByTestId('queue-alerts')).toBeNull()
  })

  it('submissions > 0 时渲染警示横幅', () => {
    render(<QueueAlerts queues={{ submissions: 3, subtitles: 0 }} />)
    expect(screen.getByTestId('queue-alerts')).toBeTruthy()
    expect(screen.getByTestId('queue-alert-submissions')).toBeTruthy()
    expect(screen.getByTestId('queue-alert-submissions').textContent).toContain('3')
  })

  it('subtitles > 0 时渲染警示横幅', () => {
    render(<QueueAlerts queues={{ submissions: 0, subtitles: 5 }} />)
    expect(screen.getByTestId('queue-alerts')).toBeTruthy()
    expect(screen.getByTestId('queue-alert-subtitles')).toBeTruthy()
    expect(screen.getByTestId('queue-alert-subtitles').textContent).toContain('5')
  })

  it('两个队列均 > 0 时两行都渲染', () => {
    render(<QueueAlerts queues={{ submissions: 2, subtitles: 7 }} />)
    expect(screen.getByTestId('queue-alert-submissions')).toBeTruthy()
    expect(screen.getByTestId('queue-alert-subtitles')).toBeTruthy()
  })

  it('submissions 链接指向 /admin/submissions', () => {
    render(<QueueAlerts queues={{ submissions: 1, subtitles: 0 }} />)
    const link = screen.getByTestId('queue-alert-submissions-link') as HTMLAnchorElement
    expect(link.href).toContain('/admin/submissions')
  })

  it('subtitles 链接指向 /admin/subtitles', () => {
    render(<QueueAlerts queues={{ submissions: 0, subtitles: 1 }} />)
    const link = screen.getByTestId('queue-alert-subtitles-link') as HTMLAnchorElement
    expect(link.href).toContain('/admin/subtitles')
  })
})
