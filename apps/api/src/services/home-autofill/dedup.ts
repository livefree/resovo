/**
 * dedup.ts — 跨区块去重纯函数（ADR-183 D-183-6：聚合层唯一权威）
 *
 * 单一实现（D-183-6.2）：HomeCurationService 整页输出（preview / 前台）按
 * HOME_SECTION_KEYS 渲染序先到先得；`allow_duplicates = true` 的 section 豁免
 * （既不写入占用集、也不受占用集约束——与 Phase 1 buildPreview 初版语义逐字一致）。
 * **快照阶段禁止调用**（D-183-6.1：快照不做跨区块去重，消除时序漂移解释失真）；
 * 未来若快照需预估占用（性能优化），必须复用本实现且标注非权威。
 */

/** 区块产出后登记占用（allowDuplicates 区块豁免：不写入占用集） */
export function occupyVideoIds(
  occupied: Set<string>,
  videoIds: Iterable<string | null | undefined>,
  allowDuplicates: boolean,
): void {
  if (allowDuplicates) return
  for (const id of videoIds) {
    if (id) occupied.add(id)
  }
}

/** 自动补位是否因跨区块占用跳过（allowDuplicates 区块豁免：不受占用集约束） */
export function isOccupied(
  occupied: ReadonlySet<string>,
  videoId: string,
  allowDuplicates: boolean,
): boolean {
  return !allowDuplicates && occupied.has(videoId)
}
