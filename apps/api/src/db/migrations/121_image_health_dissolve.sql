-- 121_image_health_dissolve.sql
-- 描述：图片健康「双真源溶解」（方案 C）schema——media_catalog 加 8 列健康判定真源：
--   4×<kind>_checked_at（最近一次确定性健康判定时间，worker 写）
--   4×<kind>_client_error_at（浏览器自过期信号，前台 beacon 写；7 天窗口判真破损）
--   健康判定自此收敛为 media_catalog 当前态，不再读 broken_image_events（后者降级纯遥测）。
-- 日期：2026-06-22
-- 决策真源：docs/decisions.md ADR-213（D-213-2/3/8，supersede ADR-212 / refine ADR-211 D-211-2）
-- 任务卡：IMGH-P4-0M / SEQ-20260621-02（方案 C 实施首卡 = schema 硬前置，时序 0M→A→A-SCAN门→C）
-- 子代理：arch-reviewer (claude-opus-4-8, a06695fa2c0aa033c) 方案 C 设计 CONDITIONAL-PASS（schema 跨 worker/internal/读端 3+ 消费方 → 强制 Opus）
-- 幂等：是（ADD COLUMN IF NOT EXISTS；回填 UPDATE 确定性可重入，0M 时 P4-B beacon 未上线无写冲突）
--
-- ⚠️ 事务：由 scripts/migrate.ts 外层 BEGIN/COMMIT 包裹，本文件内不写 BEGIN/COMMIT（105/112/115/119/120 先例）。
-- ⚠️ Down 路径：注释形式留存（项目约定）。
--   ALTER TABLE media_catalog
--     DROP COLUMN poster_checked_at, DROP COLUMN backdrop_checked_at,
--     DROP COLUMN logo_checked_at, DROP COLUMN banner_backdrop_checked_at,
--     DROP COLUMN poster_client_error_at, DROP COLUMN backdrop_client_error_at,
--     DROP COLUMN logo_client_error_at, DROP COLUMN banner_backdrop_client_error_at;
--
-- 语义（ADR-213）：
--   checked_at = 最近一次「确定性健康判定」（worker ok/low_quality/broken 出口写；瞬态出口不写，D-213-2/5）。
--     NULL = 从未巡检 → 读端 COALESCE(checked_at,'-infinity') < NOW()-STALE_CHECK_DAYS 判 'unknown'。
--     ⚠️ 本 migration 不回填 checked_at（留 NULL）——禁用通用 updated_at 代理（被任意非健康编辑刷新，
--        会让久未复检的 ok 行冒充刚验证、绕过 stale-ok 网，Codex round-3）。初始 unknown 桶由 P4-A 之后的
--        一次性真实健康扫描（A-SCAN）落真值排空（C 硬前置，Codex round-4）。
--   client_error_at = 浏览器最近上报失败时间（last-write-wins，自过期）；仅 4 受治理 kind，
--     stills/thumbnail 不在 problem-images 板范围 → 不加信号列（D-213-3 / ADV-213-6）。

-- ── 1. media_catalog 加 8 列（均 nullable，无 CHECK/索引；staleness 低频 admin 读）──────────
ALTER TABLE media_catalog
  ADD COLUMN IF NOT EXISTS poster_checked_at               TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS backdrop_checked_at             TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS logo_checked_at                 TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS banner_backdrop_checked_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS poster_client_error_at          TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS backdrop_client_error_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS logo_client_error_at            TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS banner_backdrop_client_error_at TIMESTAMPTZ;

COMMENT ON COLUMN media_catalog.poster_checked_at
  IS 'ADR-213 D-213-2：poster 最近一次确定性健康判定时间（worker ok/low_quality/broken 出口写；瞬态不写）。NULL=从未巡检→读端判 unknown。禁用 updated_at 回填代理。';
COMMENT ON COLUMN media_catalog.poster_client_error_at
  IS 'ADR-213 D-213-3：poster 浏览器最近上报加载失败时间（前台 beacon last-write-wins，自过期）；读端 NOW()-7d 窗口内计入真破损（client_error）。';

-- ── 2. 回填 <kind>_client_error_at（带当前 URL 守卫，D-213-8④ / Codex round-2 R2-HIGH-1）─────
-- 仅当未解决 client_load_error 的 url = catalog 当前 <kind>_url（poster=cover_url 历史名）且在 7 天
-- 窗口内才 seed → 排除「已替换 URL 的旧事件」给当前图制造 7 天假阳性（抵消「误报上线即消失」）。
-- 7 天对齐 TS 常量 CLIENT_ERROR_WINDOW_DAYS（imageHealth.scan.ts；SQL 不可 import TS，文档化对齐）。

UPDATE media_catalog mc SET poster_client_error_at = sub.last_seen
FROM (
  SELECT v.catalog_id, MAX(b.last_seen_at) AS last_seen
  FROM broken_image_events b
  JOIN videos v ON v.id = b.video_id
  JOIN media_catalog m2 ON m2.id = v.catalog_id
  WHERE b.image_kind = 'poster'
    AND b.event_type = 'client_load_error'
    AND b.resolved_at IS NULL
    AND b.last_seen_at >= NOW() - INTERVAL '7 days'
    AND b.url = m2.cover_url
  GROUP BY v.catalog_id
) sub
WHERE mc.id = sub.catalog_id;

UPDATE media_catalog mc SET backdrop_client_error_at = sub.last_seen
FROM (
  SELECT v.catalog_id, MAX(b.last_seen_at) AS last_seen
  FROM broken_image_events b
  JOIN videos v ON v.id = b.video_id
  JOIN media_catalog m2 ON m2.id = v.catalog_id
  WHERE b.image_kind = 'backdrop'
    AND b.event_type = 'client_load_error'
    AND b.resolved_at IS NULL
    AND b.last_seen_at >= NOW() - INTERVAL '7 days'
    AND b.url = m2.backdrop_url
  GROUP BY v.catalog_id
) sub
WHERE mc.id = sub.catalog_id;

UPDATE media_catalog mc SET logo_client_error_at = sub.last_seen
FROM (
  SELECT v.catalog_id, MAX(b.last_seen_at) AS last_seen
  FROM broken_image_events b
  JOIN videos v ON v.id = b.video_id
  JOIN media_catalog m2 ON m2.id = v.catalog_id
  WHERE b.image_kind = 'logo'
    AND b.event_type = 'client_load_error'
    AND b.resolved_at IS NULL
    AND b.last_seen_at >= NOW() - INTERVAL '7 days'
    AND b.url = m2.logo_url
  GROUP BY v.catalog_id
) sub
WHERE mc.id = sub.catalog_id;

UPDATE media_catalog mc SET banner_backdrop_client_error_at = sub.last_seen
FROM (
  SELECT v.catalog_id, MAX(b.last_seen_at) AS last_seen
  FROM broken_image_events b
  JOIN videos v ON v.id = b.video_id
  JOIN media_catalog m2 ON m2.id = v.catalog_id
  WHERE b.image_kind = 'banner_backdrop'
    AND b.event_type = 'client_load_error'
    AND b.resolved_at IS NULL
    AND b.last_seen_at >= NOW() - INTERVAL '7 days'
    AND b.url = m2.banner_backdrop_url
  GROUP BY v.catalog_id
) sub
WHERE mc.id = sub.catalog_id;

-- ── 3. 验证：8 列存在（对齐 089/120 验证块范式）───────────────────────────────
DO $$
DECLARE
  missing TEXT;
BEGIN
  SELECT string_agg(c, ', ') INTO missing
  FROM unnest(ARRAY[
    'poster_checked_at','backdrop_checked_at','logo_checked_at','banner_backdrop_checked_at',
    'poster_client_error_at','backdrop_client_error_at','logo_client_error_at','banner_backdrop_client_error_at'
  ]) AS c
  WHERE NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'media_catalog' AND column_name = c
  );
  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'migration 121 失败：media_catalog 缺列 %', missing;
  END IF;
END $$;
