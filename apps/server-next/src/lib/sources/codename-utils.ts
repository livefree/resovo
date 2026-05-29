/**
 * codename-utils.ts — Layer B codename 字库状态计算 + 后缀建议算法
 *
 * 用途（CHG-SN-9-CODENAME-MATRIX / Wave 3 验收期补丁）：
 *   - 字库预览表：52 基础名 + 状态色（available / occupied / cooling）+ 占用方信息
 *   - CodenameMatrixPicker：点击行 codename → 弹层显示矩阵 → 选择后立即 upsert
 *   - 后缀建议：同一基础名被多线路占用时建议 "泰山-2" / "泰山-3" 等扩容变种
 *
 * 设计：
 *   - 完全前端纯函数 / 无网络依赖 / 消费 listAllSourceLines() 既有数据
 *   - 解析 codename 格式：`基础名` 或 `基础名-N`（N 为正整数）
 *   - 90 天冷却期判定与后端 SourcesMatrixService.getCodenamePool 算法等价
 *
 * 真源：
 *   - MOUNTAIN_CODENAMES（packages/types/src/route-codenames.ts）
 *   - SourceLineRow（packages/types/src/sources-matrix.types.ts）
 *   - ADR-164 D-164-10 + D-164-11
 */

import { MOUNTAIN_CODENAMES, type SourceLineRow } from '@resovo/types'

const COOLING_MS = 90 * 24 * 60 * 60 * 1000

/** codename 单元状态 */
export type CodenameSlotStatus = 'available' | 'occupied' | 'cooling'

/** 单个 codename slot 的视图状态（基础名或后缀变种） */
export interface CodenameSlot {
  /** 完整 codename 值（如 "泰山" 或 "泰山-2"） */
  readonly value: string
  /** 基础名（如 "泰山"） */
  readonly base: string
  /** 后缀编号（NULL = 无后缀 / 1 = "-1" 等） */
  readonly suffix: number | null
  /** 状态 */
  readonly status: CodenameSlotStatus
  /** occupied 时的占用方信息 */
  readonly assignedTo?: {
    readonly sourceSiteKey: string
    readonly sourceName: string
    readonly displayName: string
  }
  /** cooling 时的剩余冷却天数（向上取整） */
  readonly coolingDaysLeft?: number
  /** cooling 时的退役时间戳（ISO） */
  readonly retiredAt?: string
}

/** 单个基础山名的视图（含已派生的后缀变种） */
export interface MountainSlot {
  /** 基础名 */
  readonly base: string
  /** 该基础名下所有已分配 / 冷却中的 slot（基础 + 后缀变种 / 按 suffix asc 排序） */
  readonly slots: readonly CodenameSlot[]
  /** 是否有任意 available slot（含建议后缀） */
  readonly hasAvailable: boolean
  /** 建议的下一个可用后缀 slot（用户点 "已被占用" 基础名时一键扩容） */
  readonly suggestedNext: CodenameSlot
}

const SUFFIX_REGEX = /^(.+?)-(\d+)$/

/** 拆 codename 为基础名 + 后缀 */
export function parseCodename(codename: string): { base: string; suffix: number | null } {
  const m = codename.match(SUFFIX_REGEX)
  if (m) {
    const suffix = parseInt(m[2], 10)
    if (Number.isFinite(suffix) && suffix >= 1) {
      return { base: m[1], suffix }
    }
  }
  return { base: codename, suffix: null }
}

/** 拼回 codename（suffix=null → 基础名 / 否则 "基础名-N"） */
export function joinCodename(base: string, suffix: number | null): string {
  return suffix === null ? base : `${base}-${suffix}`
}

/**
 * 从 SourceLineRow[] 计算每个山名的字库矩阵视图。
 *
 * @param rows 全线路视图（已含 codename / retiredAt / assignedAt / displayName 等字段）
 * @param now 当前时间戳（默认 Date.now() / 测试可注入）
 * @returns 52 项 MountainSlot 数组（按 MOUNTAIN_CODENAMES 顺序）
 */
export function buildCodenameMatrix(
  rows: ReadonlyArray<SourceLineRow>,
  now: number = Date.now(),
): MountainSlot[] {
  // 按基础名分组 codename 已使用情况
  // Map<base, Map<suffix|null, { row, status }>>
  const byBase = new Map<string, Map<number | null, { row: SourceLineRow; status: CodenameSlotStatus; coolingDaysLeft?: number; retiredAt?: string }>>()

  for (const row of rows) {
    if (row.codename === null) continue
    const { base, suffix } = parseCodename(row.codename)

    let status: CodenameSlotStatus
    let coolingDaysLeft: number | undefined
    let retiredAt: string | undefined
    if (row.retiredAt === null) {
      status = 'occupied'
    } else {
      const retiredTs = Date.parse(row.retiredAt)
      const elapsed = now - retiredTs
      if (Number.isFinite(retiredTs) && elapsed < COOLING_MS) {
        status = 'cooling'
        coolingDaysLeft = Math.ceil((COOLING_MS - elapsed) / (24 * 60 * 60 * 1000))
        retiredAt = row.retiredAt
      } else {
        // 退役 ≥ 90 天 / 已可复用 / 视为 available（不进 byBase）
        continue
      }
    }

    let bucket = byBase.get(base)
    if (!bucket) {
      bucket = new Map()
      byBase.set(base, bucket)
    }
    bucket.set(suffix, { row, status, coolingDaysLeft, retiredAt })
  }

  // 对每个基础名计算 slots 视图 + 后缀建议
  return MOUNTAIN_CODENAMES.map((base): MountainSlot => {
    const bucket = byBase.get(base) ?? new Map()
    const slots: CodenameSlot[] = []

    // 基础 slot（suffix=null）
    const baseEntry = bucket.get(null)
    if (baseEntry) {
      slots.push({
        value: base,
        base,
        suffix: null,
        status: baseEntry.status,
        assignedTo: baseEntry.status === 'occupied'
          ? {
              sourceSiteKey: baseEntry.row.sourceSiteKey,
              sourceName: baseEntry.row.sourceName,
              displayName: baseEntry.row.displayName,
            }
          : undefined,
        coolingDaysLeft: baseEntry.coolingDaysLeft,
        retiredAt: baseEntry.retiredAt,
      })
    } else {
      slots.push({ value: base, base, suffix: null, status: 'available' })
    }

    // 已分配 / 冷却的后缀变种（按 suffix asc）
    const suffixes = [...bucket.keys()].filter((k): k is number => typeof k === 'number').sort((a, b) => a - b)
    for (const suffix of suffixes) {
      const entry = bucket.get(suffix)!
      slots.push({
        value: joinCodename(base, suffix),
        base,
        suffix,
        status: entry.status,
        assignedTo: entry.status === 'occupied'
          ? {
              sourceSiteKey: entry.row.sourceSiteKey,
              sourceName: entry.row.sourceName,
              displayName: entry.row.displayName,
            }
          : undefined,
        coolingDaysLeft: entry.coolingDaysLeft,
        retiredAt: entry.retiredAt,
      })
    }

    // 建议下一个可用后缀（base 被占 + 所有 -N 都被占时 / 算法：从 1 开始递增找第一个空缺）
    let nextSuffix: number | null = null
    const baseTaken = bucket.has(null)
    if (baseTaken) {
      let candidate = 1
      while (bucket.has(candidate)) candidate += 1
      nextSuffix = candidate
    }
    const suggestedNext: CodenameSlot = nextSuffix === null
      ? slots[0]  // base 可用 → 建议 = base 本身
      : {
          value: joinCodename(base, nextSuffix),
          base,
          suffix: nextSuffix,
          status: 'available',
        }

    const hasAvailable = slots.some((s) => s.status === 'available') || nextSuffix !== null

    // 把建议的下一个后缀也加入 slots（除非已在 slots 中）
    if (nextSuffix !== null && !slots.some((s) => s.suffix === nextSuffix)) {
      slots.push(suggestedNext)
    }

    return {
      base,
      slots,
      hasAvailable,
      suggestedNext,
    }
  })
}

/** 字库总览统计（顶部 KPI 卡使用） */
export interface CodenameMatrixStats {
  readonly mountainTotal: number       // 52
  readonly mountainAvailable: number   // 基础名 available 的山数
  readonly slotsOccupied: number       // 所有 occupied slot 计数
  readonly slotsCooling: number        // 所有 cooling slot 计数
}

export function computeMatrixStats(matrix: ReadonlyArray<MountainSlot>): CodenameMatrixStats {
  let slotsOccupied = 0
  let slotsCooling = 0
  let mountainAvailable = 0
  for (const m of matrix) {
    if (m.slots[0]?.status === 'available') mountainAvailable += 1
    for (const s of m.slots) {
      if (s.status === 'occupied') slotsOccupied += 1
      if (s.status === 'cooling') slotsCooling += 1
    }
  }
  return {
    mountainTotal: matrix.length,
    mountainAvailable,
    slotsOccupied,
    slotsCooling,
  }
}
