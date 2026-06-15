/**
 * MetaSourceEvidence 单测（META-35）
 *
 * 覆盖 server-next 自建「来源证据」块（替代退役 ExternalMetaPanel ②③④）：
 * - hasMetaSourceEvidence 谓词（catalog / anime bangumi / anime 角色 relation 过滤 / 空态）
 * - 渲染：真源字段 / Bangumi 条目 / 角色·声优（主角+配角展示、客串降噪、CV 多值连接）
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import {
  MetaSourceEvidence,
  hasMetaSourceEvidence,
} from '../../../../../../apps/server-next/src/app/admin/videos/_client/_videoEdit/MetaSourceEvidence'
import type { BangumiEntrySummary, CatalogCharacterSummary } from '@resovo/types'

function bangumi(o: Partial<BangumiEntrySummary> = {}): BangumiEntrySummary {
  return {
    bangumiId: 1, titleCn: '某番', titleJp: 'ナニカ', year: 2020, rating: 7.8,
    summary: '简介文本', airDate: '2020-01-05', coverUrl: null, rank: 123, nsfw: false, ...o,
  }
}

function char(name: string, relation: string | null, actors: string[] = []): CatalogCharacterSummary {
  return { name, relation, imageUrl: null, actors: actors.map((n) => ({ name: n, imageUrl: null })) }
}

describe('hasMetaSourceEvidence', () => {
  it('catalog 评分 → true', () => {
    expect(hasMetaSourceEvidence({ type: 'movie', catalogFields: { rating: 8.1 } })).toBe(true)
  })
  it('catalog 原名 → true', () => {
    expect(hasMetaSourceEvidence({ type: 'movie', catalogFields: { titleOriginal: 'X' } })).toBe(true)
  })
  it('anime + bangumiInfo → true', () => {
    expect(hasMetaSourceEvidence({ type: 'anime', bangumiInfo: bangumi() })).toBe(true)
  })
  it('非 anime 的 bangumiInfo 不计入 → false', () => {
    expect(hasMetaSourceEvidence({ type: 'movie', bangumiInfo: bangumi() })).toBe(false)
  })
  it('anime + 仅客串角色（降噪过滤后空）→ false', () => {
    expect(hasMetaSourceEvidence({ type: 'anime', characters: [char('路人', '客串')] })).toBe(false)
  })
  it('anime + 主角 → true', () => {
    expect(hasMetaSourceEvidence({ type: 'anime', characters: [char('主役', '主角')] })).toBe(true)
  })
  it('全空 → false', () => {
    expect(hasMetaSourceEvidence({ type: 'movie' })).toBe(false)
  })
})

describe('MetaSourceEvidence 渲染', () => {
  it('空证据 → 渲染 null', () => {
    const { container } = render(<MetaSourceEvidence type="movie" />)
    expect(container.firstChild).toBeNull()
  })

  it('catalog 字段：原名 + 评分(人数) + 来源标注', () => {
    render(
      <MetaSourceEvidence
        type="movie"
        catalogFields={{ titleOriginal: '原始名', rating: 8.5, ratingVotes: 1200, metadataSource: 'tmdb' }}
      />,
    )
    expect(screen.getByText('原始名')).toBeTruthy()
    expect(screen.getByText('8.5 (1200 人)')).toBeTruthy()
    expect(screen.getByText('真源字段 · 来源 tmdb')).toBeTruthy()
  })

  it('anime Bangumi 条目块（日文原名 / 排名 / 评分）', () => {
    render(<MetaSourceEvidence type="anime" bangumiInfo={bangumi({ titleJp: 'ナニカ', rank: 42, rating: 7 })} />)
    expect(screen.getByText('Bangumi 条目')).toBeTruthy()
    expect(screen.getByText('ナニカ')).toBeTruthy()
    expect(screen.getByText('#42')).toBeTruthy()
  })

  it('角色区：主角/配角展示，客串过滤；CV 多值 / 连接', () => {
    render(
      <MetaSourceEvidence
        type="anime"
        characters={[
          char('甲角', '主角', ['声优甲', '声优乙']),
          char('乙角', '配角', ['声优丙']),
          char('丙角', '客串', ['声优丁']),
        ]}
      />,
    )
    expect(screen.getByText('角色 · 声优')).toBeTruthy()
    expect(screen.getByText('甲角')).toBeTruthy()
    expect(screen.getByText('乙角')).toBeTruthy()
    expect(screen.queryByText('丙角')).toBeNull()
    expect(screen.getByText('声优甲 / 声优乙')).toBeTruthy()
  })
})
