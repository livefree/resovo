/**
 * imageHealthFilters.ts — Tab B 治理工作台 filter 翻译 + distinct 拉取（IMGH-P2-3B / SEQ-20260619-02）
 *
 * 纯 server-next 消费层（不改 admin-ui 公开 Props）：
 *   - buildMissingFilters：DataTable `query.filters`（FilterValue Map，key=filterFieldName）
 *     → 1D `ListMissingVideosParams` 服务端筛选入参。
 *   - imageHealthDistinctFetcher：DataTable `distinctFetcher` prop，按哨兵 table 复用
 *     GET /broken-domains 提供 brokenDomain enum 选项（绕开通用 `_dt/distinct` 白名单）。
 *
 * 偏离登记（卡 IMGH-P2-3B）：enum auto-filter 为多选（FilterValue.enum.value 恒数组），
 *   而 1D 服务端为单值 `z.enum`；3B 为 UI-only 卡不改 1D schema，故翻译取 `value[0]`
 *   （单 facet 语义：多选时仅首项生效）。
 */

import type { DistinctOption, FilterValue } from '@resovo/admin-ui'
import { getTopBrokenDomains, type ListMissingVideosParams } from '@/lib/image-health/api'

/** brokenDomain distinct 哨兵 table（列声明 filterDistinctTable 与 fetcher 分支须一致）。 */
export const IMAGE_HEALTH_DOMAIN_DISTINCT = 'image_health_broken_domains'

/** 单值 enum 取首项（多选 facet → 1D 单值；helper 收口 value[0] 取法）。 */
function firstEnum(v: FilterValue | undefined): string | undefined {
  return v?.kind === 'enum' && v.value.length > 0 ? v.value[0] : undefined
}

/**
 * filters Map（key=filterFieldName，见 data-table.tsx:444）→ 1D 服务端筛选入参。
 * 仅透传有值的 facet；空集合/空串忽略（保持分页 total 与无筛选一致语义）。
 */
export function buildMissingFilters(
  filters: ReadonlyMap<string, FilterValue>,
): Partial<ListMissingVideosParams> {
  const out: {
    -readonly [K in keyof Pick<
      ListMissingVideosParams,
      'search' | 'posterStatus' | 'posterSource' | 'eventType' | 'brokenDomain'
    >]?: ListMissingVideosParams[K]
  } = {}

  const search = filters.get('search')
  if (search?.kind === 'text') {
    const trimmed = search.value.trim()
    if (trimmed) out.search = trimmed
  }

  const posterStatus = firstEnum(filters.get('posterStatus'))
  if (posterStatus) out.posterStatus = posterStatus as ListMissingVideosParams['posterStatus']

  const posterSource = firstEnum(filters.get('posterSource'))
  if (posterSource) out.posterSource = posterSource as ListMissingVideosParams['posterSource']

  const eventType = firstEnum(filters.get('eventType'))
  if (eventType) out.eventType = eventType as ListMissingVideosParams['eventType']

  const brokenDomain = firstEnum(filters.get('brokenDomain'))
  if (brokenDomain) out.brokenDomain = brokenDomain

  return out
}

/**
 * DataTable distinctFetcher：brokenDomain 列经哨兵 table 复用 GET /broken-domains
 * （ADR-209 D-209-1：brokenDomain options 复用 getTopBrokenDomains，零新端点）。
 * q 客户端模糊过滤（域名集 ≤ 50，无需服务端 q）。其余 table 返回空（无消费）。
 */
export async function imageHealthDistinctFetcher(
  table: string,
  _field: string,
  q?: string,
  _signal?: AbortSignal,
): Promise<readonly DistinctOption[]> {
  if (table !== IMAGE_HEALTH_DOMAIN_DISTINCT) return []
  const domains = await getTopBrokenDomains(50)
  const options: readonly DistinctOption[] = domains.map((d) => ({
    value: d.domain,
    label: `${d.domain}（${d.eventCount}）`,
  }))
  if (!q) return options
  const needle = q.toLowerCase()
  return options.filter((o) => o.value.toLowerCase().includes(needle))
}
