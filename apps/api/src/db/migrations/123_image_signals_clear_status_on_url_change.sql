-- 123_image_signals_clear_status_on_url_change.sql
-- 描述：扩展 122 的「URL 变更清信号」触发器函数——除两个时间戳（client_error_at/checked_at）外，
--   一并重置 URL 替换后失效的其余 **url 派生列**：
--     ① <kind>_status（健康真源）——旧 URL 的 status 对新 URL 失效：旧 'ok' 掩盖未验证新图、
--        旧 'broken' 误判新图（Codex stop-gate：「URL changes still leave stale status behind」）。
--        **尊重显式写**：仅当调用方未在同一 UPDATE 改 status（NEW.status IS NOT DISTINCT FROM OLD.status）
--        时才重置——不覆盖 apply-candidate/rescan 等显式 pending_review；worker 写 verified status 不改 url、
--        永不触发本分支。重置值：URL 非空→'pending_review'（待 worker 重验）/ 空→'missing'。
--     ② <kind>_blurhash / <kind>_primary_color / poster_width / poster_height（渲染占位/尺寸缓存）——
--        旧图派生，URL 替换后 stale 且 worker 仅拾 NULL 行再生（listMissingBlurhashUrls）→ 不清则陈旧
--        占位永久残留。清为 NULL → blurhash worker 对新图重生、尺寸下次健康检查重测。
--   ADR-213 D-213-10（Codex stop-gate 续）：122 仅清 2 时间戳、未扫全 url 派生列；本迁移 CREATE OR REPLACE
--   同名函数补齐（触发器 trg_media_catalog_clear_image_signals 由 122 创建并绑定本函数名，替换即生效）。
-- 日期：2026-06-22
-- 决策真源：docs/decisions.md ADR-213 D-213-10
-- 任务卡：SEQ-20260621-02（方案 C 收尾·Codex stop-gate 续）
-- 幂等：是（CREATE OR REPLACE FUNCTION，无表/列/触发器结构改动）。
--
-- ⚠️ 事务：由 scripts/migrate.ts 外层包裹。Down：恢复为 122 的函数体（仅清 2 时间戳）；触发器无需动。
-- 列清单核对（migration 026/048）：poster 有 blurhash/primary_color/width/height；backdrop 有 blurhash/
--   primary_color；logo 无渲染派生列；banner_backdrop 仅 blurhash。status CHECK 四 kind 均含 pending_review/missing。

CREATE OR REPLACE FUNCTION clear_media_catalog_image_signals_on_url_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- poster（URL 列历史名 cover_url）
  IF NEW.cover_url IS DISTINCT FROM OLD.cover_url THEN
    NEW.poster_client_error_at := NULL;
    NEW.poster_checked_at := NULL;
    NEW.poster_blurhash := NULL;
    NEW.poster_primary_color := NULL;
    NEW.poster_width := NULL;
    NEW.poster_height := NULL;
    IF NEW.poster_status IS NOT DISTINCT FROM OLD.poster_status THEN
      NEW.poster_status := CASE WHEN btrim(COALESCE(NEW.cover_url, '')) = '' THEN 'missing' ELSE 'pending_review' END;
    END IF;
  END IF;

  IF NEW.backdrop_url IS DISTINCT FROM OLD.backdrop_url THEN
    NEW.backdrop_client_error_at := NULL;
    NEW.backdrop_checked_at := NULL;
    NEW.backdrop_blurhash := NULL;
    NEW.backdrop_primary_color := NULL;
    IF NEW.backdrop_status IS NOT DISTINCT FROM OLD.backdrop_status THEN
      NEW.backdrop_status := CASE WHEN btrim(COALESCE(NEW.backdrop_url, '')) = '' THEN 'missing' ELSE 'pending_review' END;
    END IF;
  END IF;

  IF NEW.logo_url IS DISTINCT FROM OLD.logo_url THEN
    NEW.logo_client_error_at := NULL;
    NEW.logo_checked_at := NULL;
    IF NEW.logo_status IS NOT DISTINCT FROM OLD.logo_status THEN
      NEW.logo_status := CASE WHEN btrim(COALESCE(NEW.logo_url, '')) = '' THEN 'missing' ELSE 'pending_review' END;
    END IF;
  END IF;

  IF NEW.banner_backdrop_url IS DISTINCT FROM OLD.banner_backdrop_url THEN
    NEW.banner_backdrop_client_error_at := NULL;
    NEW.banner_backdrop_checked_at := NULL;
    NEW.banner_backdrop_blurhash := NULL;
    IF NEW.banner_backdrop_status IS NOT DISTINCT FROM OLD.banner_backdrop_status THEN
      NEW.banner_backdrop_status := CASE WHEN btrim(COALESCE(NEW.banner_backdrop_url, '')) = '' THEN 'missing' ELSE 'pending_review' END;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- 验证：函数存在（触发器 122 已绑定，替换即生效）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'clear_media_catalog_image_signals_on_url_change'
  ) THEN
    RAISE EXCEPTION 'migration 123 失败：clear_media_catalog_image_signals_on_url_change 函数缺失';
  END IF;
END $$;
