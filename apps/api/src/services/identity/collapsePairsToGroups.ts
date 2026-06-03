/**
 * collapsePairsToGroups.ts — pending pair → connected components 页内折叠（CHG-VIR-9-D / D-105a-18）
 *
 * 设计 §4.3「pair -> group：UI 聚合时按 connected components 折叠展示」。
 * group_key 列恒 null（pairScoringPersist 不写），折叠唯一依据 = pair 边的 union-find。
 *
 * 约束（arch-reviewer 裁定 / agentId ad5a4777ebc076355）：
 * - 纯函数，无 DB；query（listPendingCandidatePairs / ORDER BY / LIMIT-OFFSET）逐字不变；
 * - 折叠仅在**当前页内**进行——同一连通分量跨页时拆成多行（跨页不折叠），属与 legacy
 *   Service-sort 同源的 pre-existing 分页近似局限，已在 ADR-105a AMENDMENT 显式登记；
 * - cluster key = 分量内全部 video_id 升序 join('|')（成员集合幂等，与 union 顺序无关，
 *   供 React rowKey + expandedKeys；N=2 退化为旧 `${left}|${right}` 排序后特例）。
 */

import type { PendingCandidatePairRow } from '@/api/db/queries/identity-candidate'

/** 一个连通分量：成员 video（升序去重）+ 组成它的 pending pair 行（保持入参相对序 = 高分优先） */
export interface PairCluster {
  /** 分量内全部 video_id（升序去重，clusterKey 的物化基础） */
  readonly videoIds: readonly string[]
  /** 升序 videoIds join('|')，幂等稳定 */
  readonly clusterKey: string
  /** 组成分量的 pair 行（按入参顺序，入参已 ORDER BY identity_score DESC） */
  readonly pairs: readonly PendingCandidatePairRow[]
}

/** union-find（路径压缩 + 按秩合并省略——页内规模 ≤ limit≤100，朴素压缩足够） */
function findRoot(parent: Map<string, string>, x: string): string {
  let root = x
  while (parent.get(root) !== root) root = parent.get(root)!
  // 路径压缩
  let cur = x
  while (cur !== root) {
    const next = parent.get(cur)!
    parent.set(cur, root)
    cur = next
  }
  return root
}

/**
 * 页内折叠：pair 边 union-find → 连通分量。
 * 返回顺序 = 各分量**最高分 pair**在入参中的首现序（入参已按 identity_score DESC，
 * 折叠后行序仍保持高分分量优先，排序语义与折叠前一致）。
 */
export function collapsePairs(pairs: readonly PendingCandidatePairRow[]): PairCluster[] {
  const parent = new Map<string, string>()
  const ensure = (id: string) => {
    if (!parent.has(id)) parent.set(id, id)
  }

  for (const p of pairs) {
    ensure(p.left_video_id)
    ensure(p.right_video_id)
    const rl = findRoot(parent, p.left_video_id)
    const rr = findRoot(parent, p.right_video_id)
    if (rl !== rr) parent.set(rl, rr)
  }

  // root → 分量聚合（Map 迭代序 = 插入序 = 首现序）
  const byRoot = new Map<string, { videoIds: Set<string>; pairs: PendingCandidatePairRow[] }>()
  for (const p of pairs) {
    const root = findRoot(parent, p.left_video_id)
    let cluster = byRoot.get(root)
    if (!cluster) {
      cluster = { videoIds: new Set(), pairs: [] }
      byRoot.set(root, cluster)
    }
    cluster.videoIds.add(p.left_video_id)
    cluster.videoIds.add(p.right_video_id)
    cluster.pairs.push(p)
  }

  return [...byRoot.values()].map(({ videoIds, pairs: clusterPairs }) => {
    const sorted = [...videoIds].sort()
    return { videoIds: sorted, clusterKey: sorted.join('|'), pairs: clusterPairs }
  })
}
