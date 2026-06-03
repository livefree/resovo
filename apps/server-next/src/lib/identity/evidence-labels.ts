/**
 * identity/evidence-labels.ts — EvidenceType → 中文标签映射（UI「为何可合并 / 为何拦截」）
 *
 * 真源沉淀（CHG-VIR-9-C）：原定义在 merge/_client/EvidencePanel.tsx（CHG-VIR-7），
 * TabSimilar 拦截原因 chips 加入消费后跨页面共享 → 提升到 lib/identity 中性层。
 * 枚举值与 @resovo/types EvidenceType 一一对应（exhaustive Record，缺项 typecheck 拦截）。
 */

import type { EvidenceType } from '@resovo/types'

export const EVIDENCE_LABELS: Record<EvidenceType, string> = {
  external_exact_id_match: '外部 exact ID 命中',
  external_alias_match: '外部别名命中',
  same_site_canonical_id: '同源站 canonical ID 一致',
  source_fingerprint_high_overlap: '源站指纹高重叠',
  core_title_key_equal: '核心标题一致',
  year_equal_or_off_by_one: '年份一致或差 1',
  type_compatible: '类型兼容',
  episode_structure_close: '集数结构接近',
  metadata_close: '元数据接近',
  external_id_conflict: '外部 ID 冲突',
  season_mismatch: '季号不一致',
  year_far_no_exact: '年份相差大且无 exact',
  type_incompatible: '类型不兼容',
  episode_pattern_conflict: '集数模式冲突',
  ordinal_conflict: '序号/部数冲突',
  release_marker_mismatch: '发布形态不一致（剧场版/OVA/SP）',
  release_marker_weak_signal: '发布形态弱信号（一方含剧场版/OVA/SP）',
}
