-- 110_videos_short_id_dash_cleanup.sql
-- 描述：重新生成含 `-` 的 videos.short_id 存量（nanoid 默认字母表遗留数据清洗）
-- 日期：2026-06-11
-- 任务卡：BUGFIX-SHORTID-DASH-B（SEQ-20260611-01；生成侧收口见 -A / apps/api/src/lib/short-id.ts）
-- 幂等：是（WHERE short_id LIKE '%-%' 重跑 0 行命中）
--
-- ⚠️ 事务：由 scripts/migrate.ts 外层 BEGIN/COMMIT 包裹，本文件内不写 BEGIN/COMMIT（105 先例）。
-- ⚠️ Down 路径：不可逆（旧值为随机串无业务语义，不留存映射；受影响 URL 本来就 404，无断链成本）。
--
-- 背景：CrawlerService 曾用 nanoid 默认字母表（含 `-`/`_`）生成 short_id，前台
--   extractShortId 按最后一个 `-` 切分 `<slug>-<shortId>`（ADR-002）→ shortId 含 `-`
--   即被切坏 → 详情/播放页必现 404。dev 库 4337 视频 526 行（12.1%）命中，含 9 个已公开。
-- 范围裁定：
--   - 仅清洗含 `-` 的行：这些行现有 URL 必 404，改 ID 零断链成本。
--   - 含 `_` 的行（约 516）不动：`_` 不破坏分隔协议、URL 合法，改之反断既有公开链接。
--   - lists.short_id 无生成路径（schema 先行无写入），不在范围。
--   - 纯数据迁移无 DDL，docs/architecture.md 不需同步。
-- ES 跟进：short_id 进 resovo_videos 索引（VideoIndexSyncService），migration 无法触达 ES，
--   由 scripts/resync-es-short-id.ts 在 migrate 后一次性重同步（按 ES 侧旧值含 `-` 圈定）。
-- updated_at touch：使 reconcile 类回溯任务（CHG-411 reconcileStale 等）能感知本次变更。
--
-- 引用方同步（2026-06-11 FIX 修订 ×2 / Codex stop-time review 两轮拦截「persisted
--   banner short_id references stale」+「still misses JSONB configs」）：
--   全仓持久化 video short_id 引用排查结论——
--   - home_banners.link_target（link_type='video' 时直存 short_id，home-banners.ts:96
--     JOIN 契约）→ **必须同事务同步**，否则重写后 banner 解引用断链；
--   - home_config_drafts.config->'banners'[].linkTarget（098 草稿整页 JSONB）→
--     **必须同步**：发布动作全量替换 home_banners，stale 值会写回正式表；
--   - home_publish_versions.config->'banners'[].linkTarget（097 版本快照）→
--     **必须同步**：回滚按快照恢复三表，stale 值会写回正式表。097「不可变归档」
--     指业务操作不删改历史；实体 ID 重写属 schema 级数据迁移，历史快照引用追随
--     更新才能保持回滚语义有效——不更新才是真破坏（回滚写回断链引用）；
--   - home_modules.content_ref_id = video.id UUID（HomeService.ts:43）不受影响；
--   - home_section_autofill_snapshots.candidates（096）以 videoId UUID 解引用，
--     videoSummary.slug 为 title slug 不含 shortId → 不受影响；
--   - audit / merge snapshot JSONB 不以 short_id 解引用，历史 stale 可接受。
--   修订时序说明：dev 已以初版应用（applied 不重跑）——dev 实证 link_type='video'
--   banner 0 行、drafts 0 行、versions 5 行 0 stale，初版与修订版在 dev 语义等价、
--   无对账缺口；修订版供 prod/后续环境完整执行。教训沉淀：重写被外部引用的 ID 的
--   migration，必须先排查并同事务同步全部持久化引用方——含直存列与 JSONB 配置快照。

DO $$
DECLARE
  r RECORD;
  new_id TEXT;
  -- 与 apps/api/src/lib/short-id.ts SHORT_ID_ALPHABET 一致（62 字符，禁 `-`/`_`）
  alphabet CONSTANT TEXT := '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
BEGIN
  FOR r IN SELECT id, short_id FROM videos WHERE short_id LIKE '%-%' LOOP
    -- 唯一冲突重试（videos_short_id_key UNIQUE；62^8 空间下碰撞概率可忽略，循环为防御性兜底）
    LOOP
      new_id := '';
      FOR i IN 1..8 LOOP
        new_id := new_id || substr(alphabet, floor(random() * 62)::int + 1, 1);
      END LOOP;
      EXIT WHEN NOT EXISTS (SELECT 1 FROM videos WHERE short_id = new_id);
    END LOOP;

    UPDATE videos
    SET short_id = new_id,
        updated_at = NOW()
    WHERE id = r.id;

    -- 引用方同步 ①：video banner 的 link_target 直存 short_id（见头注排查结论）
    UPDATE home_banners
    SET link_target = new_id,
        updated_at = NOW()
    WHERE link_type = 'video'
      AND link_target = r.short_id;

    -- 引用方同步 ②：home 草稿整页 JSONB（098）——发布全量替换会把 stale 值写回正式表。
    -- WITH ORDINALITY + ORDER BY 保数组序（banner 顺序业务相关，jsonb_agg 不保证默认序）。
    UPDATE home_config_drafts d
    SET config = jsonb_set(d.config, '{banners}', (
          SELECT jsonb_agg(
                   CASE WHEN b.value->>'linkType' = 'video'
                         AND b.value->>'linkTarget' = r.short_id
                        THEN jsonb_set(b.value, '{linkTarget}', to_jsonb(new_id))
                        ELSE b.value END
                   ORDER BY b.ord)
            FROM jsonb_array_elements(d.config->'banners') WITH ORDINALITY b(value, ord)
        ))
    WHERE EXISTS (
      SELECT 1 FROM jsonb_array_elements(d.config->'banners') b2
      WHERE b2->>'linkType' = 'video' AND b2->>'linkTarget' = r.short_id
    );

    -- 引用方同步 ③：发布版本快照 JSONB（097）——回滚按快照恢复三表，stale 值会写回。
    -- 不可变归档例外论证见头注。
    UPDATE home_publish_versions p
    SET config = jsonb_set(p.config, '{banners}', (
          SELECT jsonb_agg(
                   CASE WHEN b.value->>'linkType' = 'video'
                         AND b.value->>'linkTarget' = r.short_id
                        THEN jsonb_set(b.value, '{linkTarget}', to_jsonb(new_id))
                        ELSE b.value END
                   ORDER BY b.ord)
            FROM jsonb_array_elements(p.config->'banners') WITH ORDINALITY b(value, ord)
        ))
    WHERE EXISTS (
      SELECT 1 FROM jsonb_array_elements(p.config->'banners') b2
      WHERE b2->>'linkType' = 'video' AND b2->>'linkTarget' = r.short_id
    );
  END LOOP;
END $$;
