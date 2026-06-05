/**
 * groupFilters.ts — 候选组级筛选/搜索谓词（ADR-105a AMENDMENT 2026-06-05 D-105a-19 / CHG-VIR-16-TBL-BE）
 *
 * identity（全量折叠后组级精确）与 legacy（降级路径页内近似，已登记）双路径共用同一纯函数，
 * 保证双路径筛选语义一致（AMENDMENT 登记口径）。纯函数无 DB。
 */

import { normalizeMergeKey } from '../TitleNormalizer'

/** 谓词输入（双路径各自组装的结构性最小形态） */
export interface GroupFilterInput {
  /** 组相似度（identity = min over pair identity_score；legacy = identity.identityScore） */
  readonly identityScore: number
  /** 折叠后成员数（legacy = group.videos.length） */
  readonly videoCount: number
  /** 成员标题集（q 激活时消费；title 原始 + titleNormalized catalog 级归一〔评审 Y-1〕） */
  readonly titles?: readonly { readonly title: string; readonly titleNormalized: string }[]
}

/** 筛选参数（ListCandidatesParams 子集，zod 已校验区间合法） */
export interface GroupFilterParams {
  readonly identityScoreMin?: number
  readonly identityScoreMax?: number
  readonly videoCountMin?: number
  readonly videoCountMax?: number
  readonly q?: string
}

/**
 * q 双口径匹配（评审 Y-2）：原始 title lower-case contains 为主；
 * normalizeMergeKey(q) contains title_normalized 为辅召回（normalized 列剥标点/符号
 * 〔词间空格折叠保留，ADR-174 R1〕，含标点的 raw q 直接 contains 会漏检；
 * normalize 后为空串则跳过辅口径防全命中）。
 */
export function titleMatchesQuery(q: string, title: string, titleNormalized: string): boolean {
  const lowered = q.toLowerCase()
  if (title.toLowerCase().includes(lowered)) return true
  const normalized = normalizeMergeKey(q)
  return normalized.length > 0 && titleNormalized.includes(normalized)
}

/** 组级谓词：区间筛选 AND q 任一成员标题命中（参数缺省 = 不约束该维度）。 */
export function groupMatchesFilters(input: GroupFilterInput, params: GroupFilterParams): boolean {
  if (params.identityScoreMin !== undefined && input.identityScore < params.identityScoreMin) return false
  if (params.identityScoreMax !== undefined && input.identityScore > params.identityScoreMax) return false
  if (params.videoCountMin !== undefined && input.videoCount < params.videoCountMin) return false
  if (params.videoCountMax !== undefined && input.videoCount > params.videoCountMax) return false
  const { q } = params
  if (q !== undefined) {
    const titles = input.titles ?? []
    if (!titles.some((t) => titleMatchesQuery(q, t.title, t.titleNormalized))) return false
  }
  return true
}

// ── D-105a-19 stage 4：identity 路径组级排序（轻列阶段，分页切片前） ──────────

/** 轻元数据结构性形态（fetchVideoMetaLight 行的子集；queries 层类型不上提 Service 共享层） */
export interface GroupMetaLight {
  readonly id: string
  readonly title: string
  readonly title_normalized: string
  readonly year: number | null
}

/** 排序/筛选共用的折叠分量条目（Service 层组装） */
export interface IdentityClusterEntry {
  readonly clusterKey: string
  readonly videoIds: readonly string[]
  /** min over pair identity_score（aggregateGroup D-105a-15 同口径） */
  readonly identityScore: number
  readonly videoCount: number
}

/** q 谓词输入的成员标题集（metaMap 缺行防御性跳过——软删竞态等） */
export function clusterTitles(
  videoIds: readonly string[],
  metaMap: ReadonlyMap<string, GroupMetaLight>,
): { title: string; titleNormalized: string }[] {
  const titles: { title: string; titleNormalized: string }[] = []
  for (const id of videoIds) {
    const m = metaMap.get(id)
    if (m) titles.push({ title: m.title, titleNormalized: m.title_normalized })
  }
  return titles
}

/** 组代表元数据 = 升序 videoIds 中首个有 meta 的成员（与 buildGroupFromCluster `videos[0]` 口径一致） */
function representativeMeta(
  videoIds: readonly string[],
  metaMap: ReadonlyMap<string, GroupMetaLight> | undefined,
): GroupMetaLight | undefined {
  if (!metaMap) return undefined
  for (const id of videoIds) {
    const m = metaMap.get(id)
    if (m) return m
  }
  return undefined
}

/**
 * 组级排序（in-place）：identity 路径白名单 identityScore / videoCount / titleNormalized / year；
 * 缺省与白名单外字段（score = legacyScore 轻列不可得）→ identityScore DESC（与 9-D 前
 * 「identity 忽略 sortField 恒按 identity_score DESC」语义衔接）。tiebreaker clusterKey ASC（分页幂等）。
 * 评审 Y-3：组分 = min over pairs（最弱链接主导组序），与折叠前「最高分 pair 首现序」同向非逐行等价。
 */
export function sortIdentityClusterEntries<T extends IdentityClusterEntry>(
  entries: T[],
  sortField: string | undefined,
  sortDir: 'asc' | 'desc' | undefined,
  metaMap: ReadonlyMap<string, GroupMetaLight> | undefined,
): void {
  const field = sortField === 'videoCount' || sortField === 'titleNormalized' || sortField === 'year' || sortField === 'identityScore'
    ? sortField
    : 'identityScore'
  const dirSign = (sortDir ?? 'desc') === 'asc' ? 1 : -1
  entries.sort((a, b) => {
    let cmp: number
    switch (field) {
      case 'videoCount':
        cmp = a.videoCount - b.videoCount
        break
      case 'titleNormalized':
        cmp = (representativeMeta(a.videoIds, metaMap)?.title_normalized ?? '')
          .localeCompare(representativeMeta(b.videoIds, metaMap)?.title_normalized ?? '')
        break
      case 'year':
        cmp = (representativeMeta(a.videoIds, metaMap)?.year ?? 0)
          - (representativeMeta(b.videoIds, metaMap)?.year ?? 0)
        break
      default:
        cmp = a.identityScore - b.identityScore
    }
    if (cmp !== 0) return cmp * dirSign
    return a.clusterKey.localeCompare(b.clusterKey)
  })
}
