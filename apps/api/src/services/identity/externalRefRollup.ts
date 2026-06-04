/**
 * externalRefRollup.ts — video_external_refs → catalog_external_refs 确定性上卷规则
 * （ADR-177 D-177-4 / CHG-VIR-12-E / Phase 5e）
 *
 * 纯函数：以「某 catalog × 某 provider 的全部 video 级 primary 观测」为输入，按 D-177-4
 * 四行规则表确定性推导 catalog 级产出。**R3 保守底线**：exact 仅 manual_confirmed 一致
 * 触发；任何冲突（confirmed 互斥 / confirmed 与 auto 指向不同 ID / 多 auto 互斥）只产生
 * candidate，不自动 exact、不靠唯一索引兜底（跨 catalog exact 冲突由写原语
 * `resolveAndWriteExactRef` 索引① 预检降级，不在本函数职责）。
 *
 * Phase 5e 输入域 = bangumi / douban（external_kind='subject' 精确级，D-177-11）；
 * imdb / tmdb 的 show/parent 上卷路径留富集实装卡（写入时判定 kind，R6）。
 *
 * rollup_rule 取值（YY-B 溯源，写入 catalog_external_refs.rollup_rule）：
 *   confirmed-consensus   多/单 video manual_confirmed primary 同一 ID → exact
 *   auto-consensus        仅 auto_matched primary 同一 ID → candidate（待人工升 exact）
 *   conflict              primary 观测指向不同 ID → 各记 candidate（归并信号）
 */

/** 上卷输入：单条 video 级 primary 观测（is_primary=true AND status∈confirmed/auto） */
export interface VideoRefObservation {
  readonly videoId: string
  readonly externalId: string
  readonly matchStatus: 'manual_confirmed' | 'auto_matched'
}

export interface RollupDecision {
  readonly externalId: string
  readonly relation: 'exact' | 'candidate'
  readonly rollupRule: 'confirmed-consensus' | 'auto-consensus' | 'conflict'
}

/**
 * D-177-4 规则表（同 catalog × 同 provider）：
 * | confirmed IDs | auto IDs            | 产出 |
 * | 1 个          | ⊆ confirmed 或 空   | exact(confirmed)〔行1/行4〕 |
 * | 1 个          | 含他值              | 全部 candidate〔行3 冲突〕 |
 * | ≥2 个         | —                   | 全部 candidate〔行3 冲突〕 |
 * | 0 个          | 1 个                | candidate(auto)〔行2 保守〕 |
 * | 0 个          | ≥2 个               | 全部 candidate〔行3 冲突〕 |
 */
export function rollupCatalogProviderRefs(
  observations: readonly VideoRefObservation[]
): RollupDecision[] {
  if (observations.length === 0) return []

  const confirmedIds = new Set(
    observations.filter((o) => o.matchStatus === 'manual_confirmed').map((o) => o.externalId)
  )
  const autoIds = new Set(
    observations.filter((o) => o.matchStatus === 'auto_matched').map((o) => o.externalId)
  )
  const allIds = [...new Set(observations.map((o) => o.externalId))].sort()

  if (confirmedIds.size === 1) {
    const confirmedId = [...confirmedIds][0]!
    const autoHasOther = [...autoIds].some((id) => id !== confirmedId)
    if (!autoHasOther) {
      // 行1/行4：manual_confirmed 一致（auto 无异议）→ exact（R3 唯一 exact 通道）
      return [{ externalId: confirmedId, relation: 'exact', rollupRule: 'confirmed-consensus' }]
    }
    // 行3：confirmed 与 auto 指向不同 ID → 冲突，全部 candidate 交人工
    return allIds.map((externalId) => ({
      externalId, relation: 'candidate' as const, rollupRule: 'conflict' as const,
    }))
  }

  if (confirmedIds.size >= 2) {
    // 行3：多 confirmed 互斥（人工确认彼此矛盾）→ 全部 candidate
    return allIds.map((externalId) => ({
      externalId, relation: 'candidate' as const, rollupRule: 'conflict' as const,
    }))
  }

  // confirmedIds.size === 0
  if (autoIds.size === 1) {
    // 行2：仅 auto 一致 → candidate（保守，待人工确认升 exact）
    return [{ externalId: [...autoIds][0]!, relation: 'candidate', rollupRule: 'auto-consensus' }]
  }
  // 行3：多 auto 互斥 → 全部 candidate
  return allIds.map((externalId) => ({
    externalId, relation: 'candidate' as const, rollupRule: 'conflict' as const,
  }))
}
