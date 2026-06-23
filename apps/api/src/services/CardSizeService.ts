/**
 * CardSizeService.ts — 前台卡片尺寸体系后台读写 Service（ADR-215 D-215-1/2，仿 HomeCurationService）
 *
 * 端点真源：ADR-215 端点契约表
 *   - GET /admin/card-sizes          → listCardSizes（2 档全量，枚举序）
 *   - PUT /admin/card-sizes/:sizeClass → updateCardSize（全替换该档可编辑投影 + audit card_size.update）
 *
 * 校验双层（D-214-10）：DB CHECK（migration 124+125）+ 本文件 zod min/max。
 * 统一 body schema（Amendment A1 D-214-A1-1/5）：单位统一为卡宽 → 全档同构 { cardWidthPx [120,400], gapPx }，
 *   .strict() 令未知字段（含本轮不暴露编辑的 desktopColumns 护栏）→ 422（严格 body 守卫）。
 */

import { z } from 'zod'
import type { Pool } from 'pg'
import type { Redis } from 'ioredis'
import {
  CARD_SIZE_CLASSES,
  type CardSizeClass,
  type CardSizeSettings,
  type UpdateCardSizeSettingsInput,
} from '@resovo/types'
import {
  listCardSizeSettings,
  findCardSizeSettings,
  updateCardSizeSettings,
} from '@/api/db/queries/card-size-settings'
import { AuditLogService } from '@/api/services/AuditLogService'
import { baseLogger } from '@/api/lib/logger'

/** 公开读缓存 key（ADR-215 D-215-6；3 档配置整份缓存，del-on-write 主 + TTL 兜底辅） */
const PUBLIC_CACHE_KEY = 'card-sizes:v1'
/** TTL 兜底秒数（del 失效为主、TTL 自愈为辅；与 HomeService shelf/top10 同口径 60s） */
const PUBLIC_CACHE_TTL = 60

// ── zod schemas（D-214-10 双层校验下层；route 经 Service 单点消费）────────────

export const CardSizeClassParamSchema = z.enum(
  CARD_SIZE_CLASSES as [CardSizeClass, ...CardSizeClass[]],
)

const GapSchema = z.number().int().min(0).max(64)

/**
 * PUT body：统一可编辑投影 = { cardWidthPx, gapPx }（D-215-2 + Amendment A1 D-214-A1-1/5）。
 * 单位统一为卡宽后 standard（size-driven）/ scroll（横滚）body 同构；范围 [120,400] 镜像 migration 125
 * size_unit_check + DB CHECK 双层（D-214-10）。.strict() → 未知字段（含本轮不暴露编辑的 desktopColumns
 * 列数护栏，D-214-A1-4）→ 422。
 */
export const CardSizeBodySchema = z.object({
  cardWidthPx: z.number().int().min(120).max(400),
  gapPx: GapSchema,
}).strict()

export type CardSizeBody = z.infer<typeof CardSizeBodySchema>

/** 据 sizeClass 取 body schema（A1 单位统一为卡宽 → 全档同构；保留派发签名兼容 route/未来扩展） */
export function bodySchemaFor(_sizeClass: CardSizeClass): typeof CardSizeBodySchema {
  return CardSizeBodySchema
}

// ── Service ───────────────────────────────────────────────────────────────────

export class CardSizeService {
  private readonly auditSvc: AuditLogService

  constructor(
    private readonly db: Pool,
    private readonly redis: Redis,
  ) {
    this.auditSvc = new AuditLogService(db)
  }

  /** admin GET：2 档全量，按 CardSizeClass 枚举序（DB 返字典序 → Service 重排，仿 listSectionSummaries）。直读 DB 不走缓存——后台要实时。 */
  async listCardSizes(): Promise<CardSizeSettings[]> {
    const rows = await listCardSizeSettings(this.db)
    const bySize = new Map(rows.map((r) => [r.sizeClass, r]))
    return CARD_SIZE_CLASSES
      .map((c) => bySize.get(c))
      .filter((r): r is CardSizeSettings => r !== undefined)
  }

  /**
   * 公开读穿缓存（GET /card-sizes，无鉴权；ADR-215 D-215-6）。
   * hit → JSON.parse；miss → DB（枚举序）+ setex TTL 兜底。仿 HomeService.getTop10 读穿范式。
   */
  async getPublicCardSizes(): Promise<CardSizeSettings[]> {
    const cached = await this.redis.get(PUBLIC_CACHE_KEY)
    if (cached) return JSON.parse(cached) as CardSizeSettings[]

    const data = await this.listCardSizes()
    await this.redis.setex(PUBLIC_CACHE_KEY, PUBLIC_CACHE_TTL, JSON.stringify(data))
    return data
  }

  /**
   * 失效公开缓存（PUT 写提交后，ADR-215 D-215-6）。
   * **best-effort**：DB 写已生效、缓存为派生物 → unlink 失败结构化 warn + 不上抛
   * （区别于 home-cache-invalidation scheduler 上抛路径，Codex-R3）；陈旧由 TTL 自愈。
   */
  private async invalidatePublicCache(): Promise<void> {
    try {
      await this.redis.unlink(PUBLIC_CACHE_KEY)
    } catch (err) {
      baseLogger.warn(
        { err, key: PUBLIC_CACHE_KEY },
        '[CardSizeService] 公开缓存失效失败 — best-effort，TTL 自愈（D-215-6，不上抛）',
      )
    }
  }

  /**
   * PUT：全替换该档可编辑投影 + audit `card_size.update`（before/after 全行快照）。
   * @returns null = card_size 行缺失（seed 2 档恒存在；缺行 = 迁移漂移兜底 404）
   */
  async updateCardSize(
    sizeClass: CardSizeClass,
    input: UpdateCardSizeSettingsInput,
    actorId: string,
    requestId?: string,
  ): Promise<CardSizeSettings | null> {
    const before = await findCardSizeSettings(this.db, sizeClass)
    if (!before) return null

    const after = await updateCardSizeSettings(this.db, sizeClass, input)
    if (!after) return null

    this.auditSvc.write({
      actorId,
      actionType: 'card_size.update',
      targetKind: 'card_size',
      targetId: before.id, // D-215-2：锚定 settings 行 id（sizeClass key 非 UUID）
      beforeJsonb: before as unknown as Record<string, unknown>,
      afterJsonb: after as unknown as Record<string, unknown>,
      requestId: requestId ?? null,
    })

    // DB 写已提交 → 失效公开缓存（best-effort，D-215-6）；await 但内部不上抛，PUT 恒成功
    await this.invalidatePublicCache()

    return after
  }
}
