/**
 * VideoMergesService.split-helpers.ts — split 拆到已有/新建 video 组解析与校验
 * （ADR-105 AMENDMENT 2026-06-03 D-105-2/3/5 / CHG-VIR-11-B）
 *
 * 全部校验置 BEGIN 前（继承 ADR-105a D-105a-11 校验前置范式）：
 *   - targetVideoId 组：≠ 被拆 videoId（zod 不可表达，依赖 DB 外状态）/ 存在（404）/
 *     未软删（409）/ 冲突预检（D-105-3 同 R-105-1 范式，409）；不调 findOrCreate、
 *     不改已有 video 任何元数据（D-105-5 / R-105-S3）。
 *   - newVideoMeta 组：事务前逐组 findOrCreate catalog（CHG-VIR-PRE-1 范式，
 *     回滚至多留无害孤儿 catalog）。
 *
 * 独立 helper 文件：VideoMergesService.ts pre-existing 超 file-size budget，不再膨胀。
 */

import type { Pool } from 'pg'
import type { SplitGroup } from '@resovo/types'
import {
  fetchVideosByIds,
  detectSplitConflictsForTarget,
  type RawVideoRow,
} from '@/api/db/queries/video-merge-mutations'
import type { MediaCatalogService } from '@/api/services/MediaCatalogService'
import { AppError } from '@/api/lib/errors'
import { normalizeMergeKey } from '@/api/services/TitleNormalizer'

/** 解析后的拆分组：事务内按 kind 分支执行 */
export type ResolvedSplitGroup =
  | {
      readonly kind: 'create'
      readonly sourceIds: readonly string[]
      readonly catalogId: string
      readonly title: string
      readonly type: string
    }
  | {
      readonly kind: 'existing'
      readonly sourceIds: readonly string[]
      readonly targetVideoId: string
    }

/**
 * 校验 + 解析全部拆分组（BEGIN 前调用）。
 * zod 层已保证：每组 newVideoMeta xor targetVideoId 恰一 + 组间 targetVideoId 互不重复。
 */
export async function resolveSplitGroups(
  db: Pool,
  catalogSvc: MediaCatalogService,
  videoId: string,
  groups: readonly SplitGroup[],
): Promise<ResolvedSplitGroup[]> {
  // ── targetVideoId 组校验（D-105-2）────────────────────────────────
  const targetIds = groups
    .map((g) => g.targetVideoId)
    .filter((id): id is string => id !== undefined)

  if (targetIds.includes(videoId)) {
    throw new AppError('VALIDATION_ERROR', 'targetVideoId 不得等于被拆分的 videoId', 422)
  }

  // 旧请求体（全组 newVideoMeta）零额外查询（向后兼容 + 测试 mock 不脆弱）
  const targetById = targetIds.length > 0
    ? new Map((await fetchVideosByIds(db, targetIds)).map((v) => [v.id, v]))
    : new Map<string, RawVideoRow>()
  for (const targetId of targetIds) {
    const target = targetById.get(targetId)
    if (!target) {
      throw new AppError('NOT_FOUND', `拆分目标 video ${targetId} 不存在`, 404)
    }
    if (target.deleted_at !== null) {
      throw new AppError('STATE_CONFLICT', `拆分目标 video ${targetId} 已被合并/删除`, 409)
    }
  }

  // ── 冲突预检（D-105-3 / 同 R-105-1 范式，整体不执行）────────────────
  for (const group of groups) {
    if (group.targetVideoId === undefined) continue
    const conflicts = await detectSplitConflictsForTarget(db, [...group.sourceIds], group.targetVideoId)
    if (conflicts > 0) {
      throw new AppError(
        'STATE_CONFLICT',
        `转入组与目标视频存在重复 (episode_number, source_url) 组合 ${conflicts} 条，` +
          '请先在 /admin/sources 视图处理（保留其一删除其余）后再拆分',
        409,
      )
    }
  }

  // ── 解析（newVideoMeta 组事务前 findOrCreate catalog / CHG-VIR-PRE-1）──
  const resolved: ResolvedSplitGroup[] = []
  for (const group of groups) {
    if (group.targetVideoId !== undefined) {
      resolved.push({ kind: 'existing', sourceIds: group.sourceIds, targetVideoId: group.targetVideoId })
      continue
    }
    const meta = group.newVideoMeta!
    const catalog = await catalogSvc.findOrCreate({
      title: meta.title,
      titleNormalized: normalizeMergeKey(meta.title),
      year: meta.year ?? null,
      type: meta.type,
      metadataSource: 'manual',
    })
    resolved.push({
      kind: 'create',
      sourceIds: group.sourceIds,
      catalogId: catalog.id,
      title: meta.title,
      type: meta.type,
    })
  }
  return resolved
}
