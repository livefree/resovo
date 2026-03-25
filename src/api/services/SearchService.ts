/**
 * SearchService.ts — 搜索业务逻辑
 * ADR-004: 只调用 Elasticsearch，禁止查询 PostgreSQL
 * director/actor/writer 用 .keyword 精确匹配
 */

import type { Client } from '@elastic/elasticsearch'
import type { SearchResult, SearchSuggestion, VideoCard, Pagination } from '@/types'
import { ES_INDEX } from '@/api/lib/elasticsearch'

// ── 内部 ES 查询类型（用 unknown 避免 ES SDK 复杂 overload）─────

type EsFilter = Record<string, unknown>
type EsBody = Record<string, unknown>

function makeSearchParams(index: string, body: EsBody): Parameters<Client['search']>[0] {
  return { index, ...body } as Parameters<Client['search']>[0]
}

// ── SearchService ────────────────────────────────────────────────

export interface SearchFilters {
  q?: string
  type?: string
  genre?: string
  year?: number
  ratingMin?: number
  lang?: string
  country?: string
  status?: 'ongoing' | 'completed'
  director?: string
  actor?: string
  writer?: string
  sort?: 'relevance' | 'rating' | 'latest'
  page: number
  limit: number
}

export class SearchService {
  constructor(private es: Client) {}

  async search(filters: SearchFilters): Promise<{
    data: SearchResult[]
    pagination: Pagination
  }> {
    const must: EsFilter[] = []
    const filter: EsFilter[] = [{ term: { is_published: true } }, { term: { content_rating: 'general' } }]

    // 全文搜索
    if (filters.q) {
      must.push({
        multi_match: {
          query: filters.q,
          fields: ['title^3', 'title.pinyin', 'title_en^2', 'description'],
          type: 'best_fields',
          fuzziness: 'AUTO',
        },
      })
    }

    // 精确过滤
    if (filters.type) filter.push({ term: { type: filters.type } })
    if (filters.genre) filter.push({ term: { genre: filters.genre } })
    if (filters.year) filter.push({ term: { year: filters.year } })
    if (filters.lang) filter.push({ term: { subtitle_langs: filters.lang } })
    if (filters.ratingMin !== undefined) {
      filter.push({ range: { rating: { gte: filters.ratingMin } } })
    }

    // 额外过滤：国家/状态
    if (filters.country) filter.push({ term: { country: filters.country } })
    if (filters.status) filter.push({ term: { status: filters.status } })

    // ADR-004: director/actor/writer 用 .keyword 精确匹配
    if (filters.director) filter.push({ term: { 'director.keyword': filters.director } })
    if (filters.actor) filter.push({ term: { 'cast.keyword': filters.actor } })
    if (filters.writer) filter.push({ term: { 'writers.keyword': filters.writer } })

    const query: EsFilter =
      must.length > 0 ? { bool: { must, filter } } : { bool: { filter } }

    const sortMap: Record<string, unknown[]> = {
      relevance: [{ _score: { order: 'desc' } }, { updated_at: { order: 'desc' } }],
      rating: [{ rating: { order: 'desc', missing: '_last' } }, { _score: { order: 'desc' } }],
      latest: [{ created_at: { order: 'desc' } }],
    }
    const sort = sortMap[filters.sort ?? 'relevance']
    const from = (filters.page - 1) * filters.limit

    const body: EsBody = {
      query,
      sort,
      from,
      size: filters.limit,
      highlight: {
        fields: {
          title: { pre_tags: ['<em>'], post_tags: ['</em>'] },
          title_en: { pre_tags: ['<em>'], post_tags: ['</em>'] },
          description: {
            pre_tags: ['<em>'],
            post_tags: ['</em>'],
            fragment_size: 200,
            number_of_fragments: 1,
          },
        },
      },
    }

    const response = await this.es.search(makeSearchParams(ES_INDEX, body))

    const hits = response.hits.hits
    const total =
      typeof response.hits.total === 'number'
        ? response.hits.total
        : (response.hits.total?.value ?? 0)

    const data: SearchResult[] = hits.map((hit) => {
      const src = hit._source as Record<string, unknown>
      const card: VideoCard = {
        id: src.id as string,
        shortId: src.short_id as string,
        slug: (src.slug as string) ?? null,
        title: src.title as string,
        titleEn: (src.title_en as string) ?? null,
        coverUrl: (src.cover_url as string) ?? null,
        type: src.type as VideoCard['type'],
        rating: (src.rating as number) ?? null,
        year: (src.year as number) ?? null,
        status: src.status as VideoCard['status'],
        episodeCount: src.episode_count as number,
        sourceCount: 0,
      }
      const hl = (hit.highlight ?? {}) as Record<string, string[] | undefined>
      return {
        ...card,
        highlight: {
          title: hl.title?.[0],
          titleEn: hl.title_en?.[0],
          description: hl.description?.[0],
        },
      }
    })

    return {
      data,
      pagination: {
        total,
        page: filters.page,
        limit: filters.limit,
        hasNext: filters.page * filters.limit < total,
      },
    }
  }

  async suggest(q: string, limit = 6): Promise<SearchSuggestion[]> {
    const suggestions: SearchSuggestion[] = []

    // 视频标题前缀联想
    const titleBody: EsBody = {
      query: {
        bool: {
          must: [
            {
              multi_match: {
                query: q,
                fields: ['title', 'title.pinyin', 'title_en'],
                type: 'phrase_prefix',
              },
            },
          ],
          filter: [{ term: { is_published: true } }, { term: { content_rating: 'general' } }],
        },
      },
      _source: ['title', 'title_en'],
      size: Math.ceil(limit / 2),
    }

    const titleRes = await this.es.search(makeSearchParams(ES_INDEX, titleBody))
    titleRes.hits.hits.forEach((hit) => {
      const src = hit._source as { title: string; title_en?: string }
      suggestions.push({ type: 'video', text: src.title })
    })

    // 人名聚合联想（正则包含匹配）
    const peopleBody: EsBody = {
      query: { bool: { filter: [{ term: { is_published: true } }, { term: { content_rating: 'general' } }] } },
      aggs: {
        directors: { terms: { field: 'director.keyword', include: `.*${q}.*`, size: 2 } },
        cast: { terms: { field: 'cast.keyword', include: `.*${q}.*`, size: 2 } },
        writers: { terms: { field: 'writers.keyword', include: `.*${q}.*`, size: 2 } },
      },
      size: 0,
    }

    const peopleRes = await this.es.search(makeSearchParams(ES_INDEX, peopleBody))
    const aggs = peopleRes.aggregations as Record<
      string,
      { buckets: Array<{ key: string }> }
    >
    aggs.directors?.buckets.forEach((b) => suggestions.push({ type: 'director', text: b.key }))
    aggs.cast?.buckets.forEach((b) => suggestions.push({ type: 'actor', text: b.key }))
    aggs.writers?.buckets.forEach((b) => suggestions.push({ type: 'writer', text: b.key }))

    return suggestions.slice(0, limit)
  }
}
