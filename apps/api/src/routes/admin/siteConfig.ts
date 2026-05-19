/**
 * admin/siteConfig.ts — 站点配置 + 配置文件 API
 * CHG-34: admin only
 *
 * GET  /admin/system/settings      — 读取所有站点配置键值
 * POST /admin/system/settings      — 批量写入站点配置
 * GET  /admin/system/config        — 读取配置文件 JSON 字符串
 * POST /admin/system/config        — 保存配置文件（同时解析写入 crawler_sites）
 */

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { db } from '@/api/lib/postgres'
import * as systemSettingsQueries from '@/api/db/queries/systemSettings'
import * as crawlerSitesQueries from '@/api/db/queries/crawlerSites'
import { getSchedulerStatus } from '@/api/workers/maintenanceScheduler'
import { AuditLogService } from '@/api/services/AuditLogService'
import type { SystemSettingKey } from '@/types'

const SiteSettingsBodySchema = z.object({
  siteName:             z.string().max(100).optional(),
  siteAnnouncement:     z.string().max(1000).optional(),
  doubanProxy:          z.string().max(500).optional(),
  doubanCookie:         z.string().max(2000).optional(),
  showAdultContent:     z.boolean().optional(),
  contentFilterEnabled: z.boolean().optional(),
  videoProxyEnabled:    z.boolean().optional(),
  videoProxyUrl:        z.string().max(500).optional(),
  autoCrawlEnabled:     z.boolean().optional(),
  autoCrawlMaxPerRun:   z.number().int().min(1).max(1000).optional(),
  autoCrawlRecentOnly:  z.boolean().optional(),
  autoCrawlRecentDays:  z.number().int().min(1).max(365).optional(),
})

const ConfigFileBodySchema = z.object({
  configFile:      z.string(),
  subscriptionUrl: z.string().optional(),
})

// ── 配置文件格式（api_site 字段解析到 crawler_sites） ──────────

interface ConfigFileSite {
  name: string
  api?: string
  /** 兼容部分配置使用 api_url/url 字段 */
  api_url?: string
  url?: string
  detail?: string
  is_adult?: boolean
  type?: 'vod' | 'shortdrama'
  format?: 'json' | 'xml'
  weight?: number
}

interface ConfigFileJson {
  crawler_sites?: Record<string, ConfigFileSite>
  /** 兼容 LunaTV 格式 */
  api_site?: Record<string, ConfigFileSite>
}

function isValidHttpUrl(input: string): boolean {
  try {
    const url = new URL(input)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

export async function adminSiteConfigRoutes(fastify: FastifyInstance) {
  const auth = [fastify.authenticate, fastify.requireRole(['admin'])]
  const auditSvc = new AuditLogService(db)  // CHG-SN-6-RETRO-3-A

  // ── GET /admin/system/settings ──────────────────────────────

  fastify.get('/admin/system/settings', { preHandler: auth }, async (_request, reply) => {
    const raw = await systemSettingsQueries.getAllSettings(db)
    const settings = systemSettingsQueries.deserializeSiteSettings(raw)
    return reply.send({ data: settings })
  })

  // ── POST /admin/system/settings ─────────────────────────────

  fastify.post('/admin/system/settings', { preHandler: auth }, async (request, reply) => {
    const parsed = SiteSettingsBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(400).send({
        error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? '参数错误', status: 400 },
      })
    }

    const d = parsed.data
    const pairs: Partial<Record<SystemSettingKey, string>> = {}
    if (d.siteName !== undefined)             pairs.site_name             = d.siteName
    if (d.siteAnnouncement !== undefined)     pairs.site_announcement     = d.siteAnnouncement
    if (d.doubanProxy !== undefined)          pairs.douban_proxy          = d.doubanProxy
    if (d.doubanCookie !== undefined)         pairs.douban_cookie         = d.doubanCookie
    if (d.showAdultContent !== undefined)     pairs.show_adult_content    = String(d.showAdultContent)
    if (d.contentFilterEnabled !== undefined) pairs.content_filter_enabled = String(d.contentFilterEnabled)
    if (d.videoProxyEnabled !== undefined)    pairs.video_proxy_enabled   = String(d.videoProxyEnabled)
    if (d.videoProxyUrl !== undefined)        pairs.video_proxy_url       = d.videoProxyUrl
    if (d.autoCrawlEnabled !== undefined)     pairs.auto_crawl_enabled    = String(d.autoCrawlEnabled)
    if (d.autoCrawlMaxPerRun !== undefined)   pairs.auto_crawl_max_per_run = String(d.autoCrawlMaxPerRun)
    if (d.autoCrawlRecentOnly !== undefined)  pairs.auto_crawl_recent_only = String(d.autoCrawlRecentOnly)
    if (d.autoCrawlRecentDays !== undefined)  pairs.auto_crawl_recent_days = String(d.autoCrawlRecentDays)

    // CHG-SN-6-RETRO-3-A：审计 — 写 admin_audit_log（system.settings_update / ultrareview P0-3）
    // beforeJsonb: 当前 settings 子集（仅本次更新的 key 旧值）；afterJsonb: 新值（zod 校验后子集）
    const updatedKeys = Object.keys(pairs)
    let beforeSubset: Record<string, string | null> = {}
    if (updatedKeys.length > 0) {
      const currentRaw = await systemSettingsQueries.getAllSettings(db)
      beforeSubset = Object.fromEntries(updatedKeys.map((k) => [k, currentRaw[k as SystemSettingKey] ?? null]))
    }

    await systemSettingsQueries.setManySettings(db, pairs)

    auditSvc.write({
      actorId: request.user!.userId,
      actionType: 'system.settings_update',
      targetKind: 'system',
      targetId: null,
      beforeJsonb: beforeSubset,
      afterJsonb: pairs as Record<string, unknown>,
      requestId: request.id,
    })

    return reply.send({ data: { ok: true } })
  })

  // ── GET /admin/system/config ────────────────────────────────

  fastify.get('/admin/system/config', { preHandler: auth }, async (_request, reply) => {
    const raw = await systemSettingsQueries.getSetting(db, 'config_file')
    const subscriptionUrl = await systemSettingsQueries.getSetting(db, 'config_file_url')
    return reply.send({
      data: {
        configFile: raw ?? '',
        subscriptionUrl: subscriptionUrl ?? '',
      },
    })
  })

  // ── POST /admin/system/config ───────────────────────────────

  fastify.post('/admin/system/config', { preHandler: auth }, async (request, reply) => {
    const parsed = ConfigFileBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(400).send({
        error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? '参数错误', status: 400 },
      })
    }

    const { configFile, subscriptionUrl } = parsed.data

    // 验证 JSON 合法性
    let configJson: ConfigFileJson
    try {
      configJson = JSON.parse(configFile) as ConfigFileJson
    } catch {
      return reply.code(400).send({
        error: { code: 'INVALID_JSON', message: '配置文件不是合法的 JSON', status: 400 },
      })
    }

    // 保存原始文件
    await systemSettingsQueries.setSetting(db, 'config_file', configFile)
    if (subscriptionUrl !== undefined) {
      const normalized = subscriptionUrl.trim()
      if (normalized.length > 0 && !isValidHttpUrl(normalized)) {
        return reply.code(400).send({
          error: { code: 'INVALID_SUBSCRIPTION_URL', message: '订阅 URL 必须是合法的 http/https 地址', status: 400 },
        })
      }
      await systemSettingsQueries.setSetting(db, 'config_file_url', normalized)
    }

    // 同步 crawler_sites（兼容 crawler_sites 和 api_site 两个字段名）
    const sites: Record<string, ConfigFileSite> = configJson.crawler_sites ?? configJson.api_site ?? {}
    let synced = 0
    let skipped = 0
    const validKeys: string[] = []
    for (const [key, site] of Object.entries(sites)) {
      const apiUrl = site.api ?? site.api_url ?? site.url
      if (!site.name || !apiUrl) {
        skipped++
        continue
      }
      await crawlerSitesQueries.upsertCrawlerSite(db, {
        key,
        name:       site.name,
        apiUrl,
        detail:     site.detail,
        sourceType: site.type ?? 'vod',
        format:     site.format ?? 'json',
        weight:     site.weight ?? 50,
        isAdult:    site.is_adult ?? false,
        fromConfig: true,
      })
      synced++
      validKeys.push(key)
    }

    // CHG-SN-7-MISC-CRAWLER-CONFIG-ORPHAN-DELETE：同步删除配置文件中已移除的 fromConfig=true 孤儿
    // 修复用户反馈"变更配置文件没和采集站点同步" — 即移除 key 后 DB 残留无法清理
    const orphanDeletedKeys = await crawlerSitesQueries.deleteCrawlerSitesFromConfigOrphans(db, validKeys)

    // CHG-SN-6-RETRO-3-A：审计 — 写 admin_audit_log（system.config_update / ultrareview P0-3）
    // beforeJsonb: configFile 长度 + 当前 subscriptionUrl；afterJsonb: 新长度 + sites 同步统计
    auditSvc.write({
      actorId: request.user!.userId,
      actionType: 'system.config_update',
      targetKind: 'system',
      targetId: null,
      beforeJsonb: { configFileLength: configFile.length },
      afterJsonb: {
        configFileLength: configFile.length,
        subscriptionUrl: subscriptionUrl ?? null,
        crawlerSitesSynced: synced,
        crawlerSitesSkipped: skipped,
        crawlerSitesOrphanDeleted: orphanDeletedKeys.length,
        orphanDeletedKeys,
      },
      requestId: request.id,
    })

    return reply.send({
      data: {
        ok: true,
        synced,
        skipped,
        orphanDeleted: orphanDeletedKeys.length,
        orphanDeletedKeys,
      },
    })
  })

  // ── GET /admin/system/scheduler-status ───────────────────────
  // CHG-408: 返回 maintenance scheduler 各定时器状态
  fastify.get('/admin/system/scheduler-status', { preHandler: auth }, async (_request, reply) => {
    const schedulers = getSchedulerStatus()
    const globalEnabled = process.env.MAINTENANCE_SCHEDULER_ENABLED !== 'false'
    return reply.send({ data: { enabled: globalEnabled, schedulers } })
  })
}
