-- 122_image_signals_clear_on_url_change.sql
-- 描述：图片 URL 替换时清除该 kind 的健康信号（<kind>_client_error_at + <kind>_checked_at）。
--   ADR-213 D-213-10（Codex stop-gate 修订）：client_error_at / checked_at 是裸时间戳、**不记录对应哪个 URL**。
--   写入侧有 URL 守卫（beacon + 121 回填仅在 url=当前 <kind>_url 时写），但信号写入后 URL 被替换
--   （apply-candidate / 手填 / crawler / enrichment）则旧信号失效却残留 → 读端 problemFilterSqlV2 把
--   **已替换的新图**继续判 client_error（≤7d 假阳性，正是 dissolve 要消的那类）/ fresh-ok（masks 未验证新图）。
--   修复：BEFORE UPDATE 触发器——<kind>_url 变更即 NULL 掉该 kind 的两个信号列（**路径无关**，新 URL 回到「未知/未检」，
--   待 worker（A-SCAN / P4-S 周期巡检）重新评估）。**不靠 worker 服务端复检清 client_error**——后者会让低保真
--   服务端信号覆盖高保真浏览器信号（防盗链/CORS/格式 → 服务端 ok 但浏览器裂），重新引入假阴性。
-- 日期：2026-06-22
-- 决策真源：docs/decisions.md ADR-213 D-213-10（refine D-213-3/6/7）
-- 任务卡：SEQ-20260621-02（方案 C 收尾·Codex stop-gate 修订）
-- 幂等：是（CREATE OR REPLACE FUNCTION + DROP TRIGGER IF EXISTS + CREATE TRIGGER）。
--
-- ⚠️ 事务：由 scripts/migrate.ts 外层 BEGIN/COMMIT 包裹，本文件内不写 BEGIN/COMMIT。
-- ⚠️ Down 路径（注释留存）：
--   DROP TRIGGER IF EXISTS trg_media_catalog_clear_image_signals ON media_catalog;
--   DROP FUNCTION IF EXISTS clear_media_catalog_image_signals_on_url_change();
--
-- 与既有触发器关系：media_catalog 已有 BEFORE UPDATE trg_media_catalog_updated_at（026，维护 updated_at）。
--   本触发器与之独立（触不同列），BEFORE UPDATE 多触发器按 tgname 字母序触发，互不依赖、无冲突。
--   不干扰 worker（updateCatalogImageStatus 只改 status/checked_at、不改 url → 不触发清除，checked_at=NOW() 生效）
--   与 beacon（markCatalogClientError 只匹配 url、不改 url → 不触发清除，client_error_at=NOW() 生效）。

CREATE OR REPLACE FUNCTION clear_media_catalog_image_signals_on_url_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- 信号时间戳描述「旧 URL」的健康——URL 变更后对新 URL 无意义，置 NULL（新图回到未知/未检，待重新评估）。
  -- poster 的 URL 列历史名为 cover_url（信号列用 poster_ 前缀）。IS DISTINCT FROM 正确处理 NULL（增/删图）。
  IF NEW.cover_url IS DISTINCT FROM OLD.cover_url THEN
    NEW.poster_client_error_at := NULL;
    NEW.poster_checked_at := NULL;
  END IF;
  IF NEW.backdrop_url IS DISTINCT FROM OLD.backdrop_url THEN
    NEW.backdrop_client_error_at := NULL;
    NEW.backdrop_checked_at := NULL;
  END IF;
  IF NEW.logo_url IS DISTINCT FROM OLD.logo_url THEN
    NEW.logo_client_error_at := NULL;
    NEW.logo_checked_at := NULL;
  END IF;
  IF NEW.banner_backdrop_url IS DISTINCT FROM OLD.banner_backdrop_url THEN
    NEW.banner_backdrop_client_error_at := NULL;
    NEW.banner_backdrop_checked_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_media_catalog_clear_image_signals ON media_catalog;

CREATE TRIGGER trg_media_catalog_clear_image_signals
BEFORE UPDATE ON media_catalog
FOR EACH ROW
EXECUTE FUNCTION clear_media_catalog_image_signals_on_url_change();

-- 验证：触发器存在
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_media_catalog_clear_image_signals'
  ) THEN
    RAISE EXCEPTION 'migration 122 失败：trg_media_catalog_clear_image_signals 未创建';
  END IF;
END $$;
