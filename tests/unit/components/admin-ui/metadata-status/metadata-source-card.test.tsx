/**
 * metadata-source-card.test.tsx — MetadataSourceCard href 来源（CHG-TMDB-HREF-KIND）
 *
 * Codex stop-time review：tmdb 绝不在卡内自建外链（SOURCE_HREF_BUILDERS.tmdb 默认 /movie 会重现
 * 命名空间跳错 D-172-AMD2-C）。tmdb href 必须由面板按 tmdbHrefKind 显式传；未传则无链接。
 */

import React from 'react'
import { afterEach, describe, it, expect } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { MetadataSourceCard } from '../../../../../packages/admin-ui/src/components/metadata-status/metadata-source-card'
import { makeProviderStatus } from './_fixtures'

afterEach(() => cleanup())

function cardLink(container: HTMLElement): HTMLAnchorElement | null {
  return container.querySelector('[data-metadata-source-card] a') as HTMLAnchorElement | null
}

describe('MetadataSourceCard — tmdb 外链不在卡内默认 /movie', () => {
  const tmdbStatus = makeProviderStatus('tmdb', { state: 'applied', externalId: '323486' })

  it('tmdb 未传 href → 不渲染链接（绝不退回 /movie）', () => {
    const { container } = render(<MetadataSourceCard status={tmdbStatus} />)
    expect(cardLink(container)).toBeNull()
  })

  it('tmdb 传入 /tv href → 用传入值（剧集正确）', () => {
    const { container } = render(
      <MetadataSourceCard status={tmdbStatus} href="https://www.themoviedb.org/tv/323486" />,
    )
    expect(cardLink(container)?.getAttribute('href')).toBe('https://www.themoviedb.org/tv/323486')
  })

  it('非 tmdb（douban）未传 href → 仍回退自建（向后兼容）', () => {
    const douban = makeProviderStatus('douban', { state: 'applied', externalId: '12345' })
    const { container } = render(<MetadataSourceCard status={douban} />)
    expect(cardLink(container)?.getAttribute('href')).toBe('https://movie.douban.com/subject/12345/')
  })
})
