/**
 * draft-mutations.ts — 草稿整页配置纯变异函数（CHG-HOME-DRAFT-PUBLISH-B / ADR-185 D-185-2.1）
 *
 * 画布操作 → HomePageConfig 不可变变换的逐操作映射（实施级推演归本卡）。
 * 全部纯函数（单测覆盖）；持久化由 use-home-draft PUT 承担。
 *
 * 身份约定：新建条目**即刻预生成 UUID**（crypto.randomUUID）——画布拖拽以
 * refId（行 id）为身份锚，缺 id 的草稿条目无法参与 reorder/move；publish 时
 * 该 UUID 直接成为正式行 id（卡 24 publishHomeConfig INSERT 保留 id）。
 */

import type {
  AutofillCandidate,
  HomeConfigBannerEntry,
  HomeConfigModuleEntry,
  HomeConfigSectionSettingsEntry,
  HomePageConfig,
  HomeSectionKey,
} from './types'

/** 按 refId 序重排区块（banner → banners.sortOrder；其余 → 该 slot modules.ordering） */
export function reorderSectionInConfig(
  config: HomePageConfig,
  section: HomeSectionKey,
  orderedRefIds: readonly string[],
): HomePageConfig {
  const orderOf = new Map(orderedRefIds.map((id, i) => [id, i]))
  if (section === 'banner') {
    return {
      ...config,
      banners: config.banners.map((b) =>
        b.id !== undefined && orderOf.has(b.id) ? { ...b, sortOrder: orderOf.get(b.id)! } : b,
      ),
    }
  }
  return {
    ...config,
    modules: config.modules.map((m) =>
      m.slot === section && m.id !== undefined && orderOf.has(m.id)
        ? { ...m, ordering: orderOf.get(m.id)! }
        : m,
    ),
  }
}

/**
 * 跨区块移动（方案 §5.3）：slot 迁移 + 目标区块按 orderedRefIds 重排——
 * 草稿内单次变换原子完成（替代发布态两步 PATCH+reorder 的非原子链）。
 */
export function moveModuleInConfig(
  config: HomePageConfig,
  refId: string,
  toSlot: HomeSectionKey,
  orderedTargetRefIds: readonly string[],
): HomePageConfig {
  const moved: HomePageConfig = {
    ...config,
    modules: config.modules.map((m) =>
      m.id === refId ? { ...m, slot: toSlot as HomeConfigModuleEntry['slot'] } : m,
    ),
  }
  return reorderSectionInConfig(moved, toSlot, orderedTargetRefIds)
}

/** 区块 settings 整行替换（id/updatedAt 保留——settings 身份键 = section） */
export function updateSettingsInConfig(
  config: HomePageConfig,
  section: HomeSectionKey,
  patch: Partial<Omit<HomeConfigSectionSettingsEntry, 'section' | 'id'>>,
): HomePageConfig {
  return {
    ...config,
    settings: config.settings.map((s) => (s.section === section ? { ...s, ...patch } : s)),
  }
}

function nextOrdering(config: HomePageConfig, slot: HomeSectionKey): number {
  const orderings = config.modules.filter((m) => m.slot === slot).map((m) => m.ordering)
  return orderings.length > 0 ? Math.max(...orderings) + 1 : 0
}

function pinnedVideoIds(config: HomePageConfig, slot: HomeSectionKey): Set<string> {
  return new Set(
    config.modules
      .filter((m) => m.slot === slot && m.contentRefType === 'video')
      .map((m) => m.contentRefId),
  )
}

/** pinned video 条目工厂（insertPinnedHomeModulesBatch 默认值同构，卡 24 对账） */
function makePinnedModule(slot: HomeSectionKey, videoId: string, ordering: number): HomeConfigModuleEntry {
  return {
    id: crypto.randomUUID(),
    slot: slot as HomeConfigModuleEntry['slot'],
    brandScope: 'all-brands',
    brandSlug: null,
    ordering,
    contentRefType: 'video',
    contentRefId: videoId,
    title: {},
    imageUrl: null,
    startAt: null,
    endAt: null,
    enabled: true,
    metadata: {},
  }
}

export interface AddVideosResult {
  config: HomePageConfig
  added: number
  /** 同 slot 已 pinned 的重复 videoId（跳过不追加） */
  skipped: readonly string[]
}

/** 批量添加视频为 pinned（空位添加 / 候选应用共用底座；slot 内去重跳过） */
export function addVideosToConfig(
  config: HomePageConfig,
  slot: HomeSectionKey,
  videoIds: readonly string[],
): AddVideosResult {
  const existing = pinnedVideoIds(config, slot)
  const skipped: string[] = []
  const fresh: string[] = []
  for (const id of videoIds) {
    if (existing.has(id) || fresh.includes(id)) skipped.push(id)
    else fresh.push(id)
  }
  let ordering = nextOrdering(config, slot)
  const entries = fresh.map((videoId) => makePinnedModule(slot, videoId, ordering++))
  return {
    config: { ...config, modules: [...config.modules, ...entries] },
    added: entries.length,
    skipped,
  }
}

export type ApplyCandidatesResult = AddVideosResult

/**
 * 候选应用 → 草稿 pinned（D-185-2.1：端点 #5 重校验语义挪 publish 时点整页执行；
 * 草稿内仅做 slot 去重——已 pinned 同 video 跳过）。banner 候选不走本路径
 * （编辑器预填，D-182-4.5 既有口径）。
 */
export function applyCandidatesToConfig(
  config: HomePageConfig,
  section: HomeSectionKey,
  candidates: readonly AutofillCandidate[],
): ApplyCandidatesResult {
  return addVideosToConfig(config, section, candidates.map((c) => c.videoId))
}

/** 画布 banner 创建（sortOrder = 草稿内 max+1；id 预生成） */
export function addBannerToConfig(
  config: HomePageConfig,
  input: Omit<HomeConfigBannerEntry, 'id' | 'sortOrder' | 'createdAt' | 'updatedAt'> & { sortOrder?: number },
): HomePageConfig {
  const maxSort = config.banners.reduce((max, b) => Math.max(max, b.sortOrder), -1)
  const entry: HomeConfigBannerEntry = {
    ...input,
    id: crypto.randomUUID(),
    sortOrder: input.sortOrder ?? maxSort + 1,
  }
  return { ...config, banners: [...config.banners, entry] }
}
