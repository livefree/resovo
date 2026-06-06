/**
 * recalculate.ts — 单 section 候选重算编排（ADR-183 D-183-3.4）
 *
 * worker 只委托本 Service（identityCandidateWorker 范式）：按 section 分派候选源
 * → 写快照（同事务清理保留 10，queries 层）。full_auto section 不写任何运营表
 * （ADR-181 D-181-4.3 自动候选不落 home_modules；前台/preview 由聚合层读快照拼装）。
 * 重算 ≠ 生效（方案 §7.3.4）。快照属系统产物不计 admin audit（方案 §11.2）。
 */

import type { Pool } from 'pg'
import type { AutofillCandidate, ContentGap, HomeSectionKey } from '@resovo/types'
import { findHomeSectionSettings } from '@/api/db/queries/home-section-settings'
import { insertHomeAutofillSnapshot } from '@/api/db/queries/home-autofill-snapshots'
import { POLICY_VERSION } from './policy'
import { generateDoubanSectionCandidates } from './douban'
import { generateBangumiSectionCandidates } from './bangumi'
import { generateTrendingSectionCandidates } from './trending'

export interface RecalculateResult {
  section: HomeSectionKey
  /** 'written' = 快照已落库；'skipped' = 无候选语义（manual_only / type_shortcuts / settings 缺行） */
  outcome: 'written' | 'skipped'
  skipReason?: 'settings_missing' | 'manual_only' | 'no_candidate_source'
  snapshotId?: string
  candidateCount?: number
  gapCount?: number
}

/** section → 候选源分派（D-183-4：hot_* 双外源 / featured·top10·banner 站内信号） */
async function generateForSection(
  db: Pool,
  section: HomeSectionKey,
): Promise<{ candidates: AutofillCandidate[]; gaps: ContentGap[] } | null> {
  switch (section) {
    case 'hot_movies':
    case 'hot_series':
      return generateDoubanSectionCandidates(db, section)
    case 'hot_anime':
      return generateBangumiSectionCandidates(db)
    case 'featured':
    case 'top10':
    case 'banner':
      return generateTrendingSectionCandidates(db, section)
    case 'type_shortcuts':
      // 类型入口无视频候选概念（content_ref_type=video_type）——不写空快照污染 #2 摘要
      return null
  }
}

/**
 * 执行单 section 重算（worker job 主体）。
 * manual_only 防御性跳过（scheduler 不入队、端点 #7 422 拦截；此处兜底防直接 enqueue）。
 */
export async function recalculateSectionSnapshot(
  db: Pool,
  section: HomeSectionKey,
  trigger: 'scheduled' | 'manual',
): Promise<RecalculateResult> {
  const settings = await findHomeSectionSettings(db, section)
  if (!settings) return { section, outcome: 'skipped', skipReason: 'settings_missing' }
  if (settings.autofillMode === 'manual_only') {
    return { section, outcome: 'skipped', skipReason: 'manual_only' }
  }

  const generated = await generateForSection(db, section)
  if (!generated) return { section, outcome: 'skipped', skipReason: 'no_candidate_source' }

  const snapshot = await insertHomeAutofillSnapshot(db, {
    section,
    trigger,
    policyVersion: POLICY_VERSION,
    // 审计回溯链：重算时刻的 settings 全行（方案 §11.2）
    settingsSnapshot: settings as unknown as Record<string, unknown>,
    candidates: generated.candidates,
    gaps: generated.gaps,
  })

  return {
    section,
    outcome: 'written',
    snapshotId: snapshot.id,
    candidateCount: generated.candidates.length,
    gapCount: generated.gaps.length,
  }
}
