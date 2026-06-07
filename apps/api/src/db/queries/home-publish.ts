/**
 * home-publish.ts — home_config_drafts / home_publish_versions 表 DB 查询（ADR-185）
 * 所有 SQL 参数化，不拼接字符串（db-rules.md）
 *
 * publishHomeConfig 为单事务整页应用（D-185-3.2）：草稿乐观锁删除 → 三表全量
 * 替换 → 回读拍版本。banners/modules 走 DELETE + INSERT（id/created_at 保留——
 * audit 链与 appliedAt 派生依赖稳定 id/created_at）；settings 走按 section UPDATE
 * （seed 7 行恒存在不可删，id 为 audit 锚点，migration 095 约定）。
 */

import type { Pool, PoolClient } from 'pg'
import type {
  HomeConfigDraft,
  HomePageConfig,
  HomePublishSource,
  HomePublishVersion,
  HomePublishVersionSummary,
} from '@/types'

// ── DB 行类型 ────────────────────────────────────────────────────────────────

interface DbDraftRow {
  id: string
  scope: string
  config: HomePageConfig
  base_version_no: number | null
  created_by: string
  updated_by: string
  created_at: string
  updated_at: string
}

const DRAFT_COLUMNS = `id, scope, config, base_version_no, created_by, updated_by,
                       created_at::TEXT AS created_at, updated_at::TEXT AS updated_at`

function mapDraft(row: DbDraftRow): HomeConfigDraft {
  return {
    id: row.id,
    scope: row.scope,
    config: row.config,
    baseVersionNo: row.base_version_no,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

// ── 草稿 CRUD（端点 #1–#3；全局单行 scope='global'）─────────────────────────

export async function findHomeConfigDraft(db: Pool): Promise<HomeConfigDraft | null> {
  const result = await db.query<DbDraftRow>(
    `SELECT ${DRAFT_COLUMNS} FROM home_config_drafts WHERE scope = 'global'`,
  )
  return result.rows[0] ? mapDraft(result.rows[0]) : null
}

/**
 * 整页草稿保存（PUT 整体替换语义，D-185-3.1）。
 * 创建时锚定 base_version_no = 当前最新版本号（冷启动 NULL）；
 * 冲突更新不重置锚（陈旧检测语义——重锚须 DELETE 后重建草稿）。
 */
export async function upsertHomeConfigDraft(
  db: Pool,
  params: { config: HomePageConfig; actorId: string },
): Promise<HomeConfigDraft> {
  const result = await db.query<DbDraftRow>(
    `INSERT INTO home_config_drafts (scope, config, base_version_no, created_by, updated_by)
     VALUES ('global', $1, (SELECT MAX(version_no) FROM home_publish_versions), $2, $2)
     ON CONFLICT (scope) DO UPDATE
       SET config = EXCLUDED.config,
           updated_by = EXCLUDED.updated_by
     RETURNING ${DRAFT_COLUMNS}`,
    [JSON.stringify(params.config), params.actorId],
  )
  return mapDraft(result.rows[0])
}

export async function deleteHomeConfigDraft(db: Pool): Promise<boolean> {
  const result = await db.query(
    `DELETE FROM home_config_drafts WHERE scope = 'global'`,
  )
  return (result.rowCount ?? 0) > 0
}

// ── 版本辅助（陈旧检测信号源，D-185-2.2）────────────────────────────────────

export async function findLatestVersionNo(db: Pool): Promise<number | null> {
  const result = await db.query<{ max: number | null }>(
    `SELECT MAX(version_no)::INT AS max FROM home_publish_versions`,
  )
  return result.rows[0]?.max ?? null
}

/** 三真源表最近写入时间（双信号之二：直写晚于草稿 → 陈旧；PG GREATEST 忽略 NULL） */
export async function findTruthTablesMaxUpdatedAt(db: Pool): Promise<string | null> {
  const result = await db.query<{ max_updated: string | null }>(
    `SELECT GREATEST(
       (SELECT MAX(updated_at) FROM home_banners),
       (SELECT MAX(updated_at) FROM home_modules),
       (SELECT MAX(updated_at) FROM home_section_settings)
     )::TEXT AS max_updated`,
  )
  return result.rows[0]?.max_updated ?? null
}

// ── 版本读取（端点 #5/#6，CHG-HOME-AUDIT-ROLLBACK）───────────────────────────

interface DbVersionRow {
  id: string
  version_no: number
  source: HomePublishSource
  note: string | null
  published_by: string
  published_at: string
  config?: HomePageConfig
}

const VERSION_SUMMARY_COLUMNS = `id, version_no, source, note, published_by,
                                 published_at::TEXT AS published_at`

function mapVersionSummary(row: DbVersionRow): HomePublishVersionSummary {
  return {
    id: row.id,
    versionNo: row.version_no,
    source: row.source,
    note: row.note,
    publishedBy: row.published_by,
    publishedAt: row.published_at,
  }
}

/** 分页列表（轻量行不含 config 载荷，D-185-3.3）；version_no DESC（新在前） */
export async function listHomePublishVersions(
  db: Pool,
  params: { page: number; limit: number },
): Promise<{ rows: HomePublishVersionSummary[]; total: number }> {
  const offset = (params.page - 1) * params.limit
  const [rows, count] = await Promise.all([
    db.query<DbVersionRow>(
      `SELECT ${VERSION_SUMMARY_COLUMNS} FROM home_publish_versions
        ORDER BY version_no DESC LIMIT $1 OFFSET $2`,
      [params.limit, offset],
    ),
    db.query<{ count: string }>(`SELECT COUNT(*) FROM home_publish_versions`),
  ])
  return {
    rows: rows.rows.map(mapVersionSummary),
    total: parseInt(count.rows[0]?.count ?? '0', 10),
  }
}

/** 详情含全量 config（端点 #6 = diff 数据源——diff 计算归消费端，D-185-4.2） */
export async function findHomePublishVersionByNo(
  db: Pool,
  versionNo: number,
): Promise<HomePublishVersion | null> {
  const result = await db.query<DbVersionRow & { config: HomePageConfig }>(
    `SELECT ${VERSION_SUMMARY_COLUMNS}, config FROM home_publish_versions
      WHERE version_no = $1`,
    [versionNo],
  )
  const row = result.rows[0]
  return row ? { ...mapVersionSummary(row), config: row.config } : null
}

/** 版本总数（D-185-1.5 后半：< 2 无可回滚目标） */
export async function countHomePublishVersions(db: Pool): Promise<number> {
  const result = await db.query<{ count: string }>(`SELECT COUNT(*) FROM home_publish_versions`)
  return parseInt(result.rows[0]?.count ?? '0', 10)
}

// ── 整页状态回读（发布事务内 prev/published 快照源）──────────────────────────
// 时间戳统一 ms 截断：config 经 JS 管道（Date → ISO）只承载 ms 精度，pg 微秒
// 原样透出会让恒等 round-trip 产生伪 diff（dev 实测）；快照间 diff（卡 26 消费端）
// 与 audit sectionsChanged 摘要都依赖文本稳定性。

async function readHomePageState(client: PoolClient): Promise<HomePageConfig> {
  const [banners, modules, settings] = await Promise.all([
    client.query<{
      id: string; title: Record<string, string>; image_url: string; link_type: string
      link_target: string; sort_order: number; active_from: string | null
      active_to: string | null; is_active: boolean; brand_scope: string
      brand_slug: string | null; created_at: string; updated_at: string
    }>(
      `SELECT id, title, image_url, link_type, link_target, sort_order,
              date_trunc('milliseconds', active_from)::TEXT AS active_from,
              date_trunc('milliseconds', active_to)::TEXT   AS active_to,
              is_active, brand_scope, brand_slug,
              date_trunc('milliseconds', created_at)::TEXT  AS created_at,
              date_trunc('milliseconds', updated_at)::TEXT  AS updated_at
         FROM home_banners ORDER BY sort_order ASC, created_at ASC`,
    ),
    client.query<{
      id: string; slot: string; brand_scope: string; brand_slug: string | null
      ordering: number; content_ref_type: string; content_ref_id: string
      title: Record<string, string>; image_url: string | null
      start_at: string | null; end_at: string | null; enabled: boolean
      metadata: Record<string, unknown>; created_at: string; updated_at: string
    }>(
      `SELECT id, slot, brand_scope, brand_slug, ordering, content_ref_type, content_ref_id,
              title, image_url,
              date_trunc('milliseconds', start_at)::TEXT   AS start_at,
              date_trunc('milliseconds', end_at)::TEXT     AS end_at,
              enabled, metadata,
              date_trunc('milliseconds', created_at)::TEXT AS created_at,
              date_trunc('milliseconds', updated_at)::TEXT AS updated_at
         FROM home_modules ORDER BY slot ASC, ordering ASC, created_at ASC`,
    ),
    client.query<{
      id: string; section: string; autofill_mode: string
      refresh_interval_minutes: number | null; display_count: number
      allow_duplicates: boolean; pinned_limit: number | null
      settings: Record<string, unknown>; updated_at: string
    }>(
      `SELECT id, section, autofill_mode, refresh_interval_minutes, display_count,
              allow_duplicates, pinned_limit, settings,
              date_trunc('milliseconds', updated_at)::TEXT AS updated_at
         FROM home_section_settings ORDER BY section ASC`,
    ),
  ])

  return {
    banners: banners.rows.map((r) => ({
      id: r.id,
      title: r.title,
      imageUrl: r.image_url,
      linkType: r.link_type as HomePageConfig['banners'][number]['linkType'],
      linkTarget: r.link_target,
      sortOrder: r.sort_order,
      activeFrom: r.active_from,
      activeTo: r.active_to,
      isActive: r.is_active,
      brandScope: r.brand_scope as HomePageConfig['banners'][number]['brandScope'],
      brandSlug: r.brand_slug,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    })),
    modules: modules.rows.map((r) => ({
      id: r.id,
      slot: r.slot as HomePageConfig['modules'][number]['slot'],
      brandScope: r.brand_scope as HomePageConfig['modules'][number]['brandScope'],
      brandSlug: r.brand_slug,
      ordering: r.ordering,
      contentRefType: r.content_ref_type as HomePageConfig['modules'][number]['contentRefType'],
      contentRefId: r.content_ref_id,
      title: r.title ?? {},
      imageUrl: r.image_url,
      startAt: r.start_at,
      endAt: r.end_at,
      enabled: r.enabled,
      metadata: r.metadata ?? {},
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    })),
    settings: settings.rows.map((r) => ({
      id: r.id,
      section: r.section as HomePageConfig['settings'][number]['section'],
      autofillMode: r.autofill_mode as HomePageConfig['settings'][number]['autofillMode'],
      refreshIntervalMinutes: r.refresh_interval_minutes,
      displayCount: r.display_count,
      allowDuplicates: r.allow_duplicates,
      pinnedLimit: r.pinned_limit,
      settings: r.settings ?? {},
      updatedAt: r.updated_at,
    })),
  }
}

// ── 发布事务（端点 #4；卡 26 rollback 复用——draftId 省略时跳过草稿删除）──────

export interface PublishHomeConfigResult {
  versionId: string
  versionNo: number
  /** 应用前三表状态（audit sectionsChanged 摘要源，D-185-4.1） */
  prevConfig: HomePageConfig
  /** 应用后回读三表（版本快照本体——id/时间戳恒全量） */
  publishedConfig: HomePageConfig
}

/**
 * 单事务：草稿乐观锁删除（id + updated_at 双匹配，并发改写/丢弃 → null）→
 * 三表全量替换 → 回读拍版本（source='publish'|'rollback'）。
 * 缓存失效钩子归事务外（D-185-5，CHG-HOME-CACHE-INVALIDATE 实装）。
 *
 * @returns null = 草稿已被并发修改或丢弃（service 层转 409 STATE_CONFLICT）
 */
export async function publishHomeConfig(
  db: Pool,
  params: {
    /** publish 路径必传（事务内乐观锁删草稿）；rollback（卡 26）省略 */
    draft?: { id: string; updatedAt: string }
    config: HomePageConfig
    source: HomePublishSource
    note: string | null
    actorId: string
  },
): Promise<PublishHomeConfigResult | null> {
  const client = await db.connect()
  try {
    await client.query('BEGIN')

    // 草稿乐观锁先行：内容被并发 PUT / 已被丢弃 / 已被并发发布 → 整体放弃
    if (params.draft) {
      const del = await client.query(
        `DELETE FROM home_config_drafts WHERE id = $1 AND updated_at = $2::timestamptz`,
        [params.draft.id, params.draft.updatedAt],
      )
      if ((del.rowCount ?? 0) === 0) {
        await client.query('ROLLBACK')
        return null
      }
    }

    const prevConfig = await readHomePageState(client)

    // 三表全量替换①：home_banners（id/created_at 保留，新行生成）
    await client.query(`DELETE FROM home_banners`)
    for (const b of params.config.banners) {
      await client.query(
        `INSERT INTO home_banners
           (id, title, image_url, link_type, link_target, sort_order,
            active_from, active_to, is_active, brand_scope, brand_slug, created_at, updated_at)
         VALUES (COALESCE($1::uuid, gen_random_uuid()), $2, $3, $4, $5, $6,
                 $7, $8, $9, $10, $11, COALESCE($12::timestamptz, NOW()), NOW())`,
        [
          b.id ?? null,
          JSON.stringify(b.title),
          b.imageUrl,
          b.linkType,
          b.linkTarget,
          b.sortOrder,
          b.activeFrom,
          b.activeTo,
          b.isActive,
          b.brandScope,
          b.brandSlug,
          b.createdAt ?? null,
        ],
      )
    }

    // 三表全量替换②：home_modules（created_at 保留——appliedAt 派生依赖，D-182-4.5）
    await client.query(`DELETE FROM home_modules`)
    for (const m of params.config.modules) {
      await client.query(
        `INSERT INTO home_modules
           (id, slot, brand_scope, brand_slug, ordering, content_ref_type, content_ref_id,
            title, image_url, start_at, end_at, enabled, metadata, created_at, updated_at)
         VALUES (COALESCE($1::uuid, gen_random_uuid()), $2, $3, $4, $5, $6, $7,
                 $8, $9, $10, $11, $12, $13, COALESCE($14::timestamptz, NOW()), NOW())`,
        [
          m.id ?? null,
          m.slot,
          m.brandScope,
          m.brandSlug,
          m.ordering,
          m.contentRefType,
          m.contentRefId,
          JSON.stringify(m.title ?? {}),
          m.imageUrl,
          m.startAt,
          m.endAt,
          m.enabled,
          JSON.stringify(m.metadata ?? {}),
          m.createdAt ?? null,
        ],
      )
    }

    // 三表全量替换③：home_section_settings（按 section UPDATE——seed 行不可删，id 稳定）
    for (const s of params.config.settings) {
      await client.query(
        `UPDATE home_section_settings
            SET autofill_mode = $2, refresh_interval_minutes = $3, display_count = $4,
                allow_duplicates = $5, pinned_limit = $6, settings = $7
          WHERE section = $1`,
        [
          s.section,
          s.autofillMode,
          s.refreshIntervalMinutes,
          s.displayCount,
          s.allowDuplicates,
          s.pinnedLimit,
          JSON.stringify(s.settings ?? {}),
        ],
      )
    }

    // 回读拍版本（快照恒携全量 id/时间戳）
    const publishedConfig = await readHomePageState(client)
    const version = await client.query<{ id: string; version_no: number }>(
      `INSERT INTO home_publish_versions (source, note, config, published_by)
       VALUES ($1, $2, $3, $4)
       RETURNING id, version_no`,
      [params.source, params.note, JSON.stringify(publishedConfig), params.actorId],
    )

    await client.query('COMMIT')
    return {
      versionId: version.rows[0].id,
      versionNo: version.rows[0].version_no,
      prevConfig,
      publishedConfig,
    }
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}
