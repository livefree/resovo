/**
 * version-diff.ts — 版本快照间 section 粒度 diff（CHG-HOME-AUDIT-ROLLBACK / ADR-185 D-185-4.2）
 *
 * **diff 计算归消费端**：服务端不存 diff 不算 diff（与 D-185-1.4 排除 diff-patch
 * 同理由），版本详情端点 #6 即数据源。纯函数（单测覆盖）。
 *
 * 比较口径（卡 24 沉淀对账）：剥离 createdAt/updatedAt 行元数据——版本快照
 * 时间戳已 ms 截断保证文本稳定，但发布重写仍恒刷新 updatedAt；内容身份 = id。
 */

import { HOME_SECTION_KEYS } from '@resovo/types'
import type { HomePageConfig, HomeSectionKey } from './types'

export interface SectionDiff {
  readonly section: HomeSectionKey
  /** 新增条目数（to 有 from 无，按 id） */
  readonly added: number
  /** 移除条目数（from 有 to 无） */
  readonly removed: number
  /** 同 id 内容变化数（剥离时间戳后字段不等） */
  readonly changed: number
  /** 区块 settings 是否变化 */
  readonly settingsChanged: boolean
}

type Entry = Record<string, unknown> & { id?: string; createdAt?: string; updatedAt?: string }

function normalize(entry: Entry): string {
  const { createdAt: _c, updatedAt: _u, ...rest } = entry
  // 平铺 stringify 即稳定：两侧均出自 pg jsonb（键序 canonical 归一），
  // 不用 replacer 数组——其作用于所有嵌套层级会丢非顶层键（title/metadata）
  return JSON.stringify(rest)
}

function diffEntries(from: readonly Entry[], to: readonly Entry[]): { added: number; removed: number; changed: number } {
  const fromById = new Map(from.filter((e) => e.id).map((e) => [e.id!, e]))
  const toById = new Map(to.filter((e) => e.id).map((e) => [e.id!, e]))
  let added = 0
  let removed = 0
  let changed = 0
  for (const [id, entry] of toById) {
    const prev = fromById.get(id)
    if (!prev) added += 1
    else if (normalize(prev) !== normalize(entry)) changed += 1
  }
  for (const id of fromById.keys()) {
    if (!toById.has(id)) removed += 1
  }
  // 缺 id 条目（理论上版本快照恒携 id）按在场计数兜底
  added += to.filter((e) => !e.id).length
  removed += from.filter((e) => !e.id).length
  return { added, removed, changed }
}

/** 两版本整页 diff；仅返回有变化的 section（空数组 = 无差异） */
export function computeVersionDiff(from: HomePageConfig, to: HomePageConfig): SectionDiff[] {
  const result: SectionDiff[] = []
  for (const section of HOME_SECTION_KEYS) {
    const entriesDiff = section === 'banner'
      ? diffEntries(from.banners, to.banners)
      : diffEntries(
          from.modules.filter((m) => m.slot === section),
          to.modules.filter((m) => m.slot === section),
        )
    const fromSettings = from.settings.find((s) => s.section === section)
    const toSettings = to.settings.find((s) => s.section === section)
    const settingsChanged =
      normalize((fromSettings ?? {}) as Entry) !== normalize((toSettings ?? {}) as Entry)
    if (entriesDiff.added || entriesDiff.removed || entriesDiff.changed || settingsChanged) {
      result.push({ section, ...entriesDiff, settingsChanged })
    }
  }
  return result
}
